"""
Auth: JWT app login + Clio OAuth flow.
Each user has their own Clio tokens stored in the DB.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Annotated
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import RedirectResponse
import bcrypt
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.config import get_settings
from app.database import get_db
from app.models.user import User
from app.services.clio import ClioClient

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/auth", tags=["auth"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8  # 8 hours


# --- JWT helpers ---

def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": str(user_id), "exp": expire},
        settings.secret_key,
        algorithm=ALGORITHM,
    )


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


# --- Dependencies ---

async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub", 0))
    except (JWTError, ValueError):
        raise credentials_exception

    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise credentials_exception
    return user


async def get_current_user_clio_client(
    current_user: User = Depends(get_current_user),
) -> ClioClient:
    """Return a Clio client using the current user's stored token."""
    if not current_user.clio_access_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Clio account not connected. Please connect via /api/auth/clio/connect",
        )
    return ClioClient(current_user.clio_access_token)


# --- Routes ---

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    email: str
    full_name: str
    password: str
    role: str = "assistant"


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    clio_connected: bool

    class Config:
        from_attributes = True


@router.post("/token", response_model=TokenResponse)
async def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    return TokenResponse(access_token=create_access_token(user.id))


@router.post("/register", response_model=UserResponse)
async def register(data: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=data.email,
        full_name=data.full_name,
        hashed_password=hash_password(data.password),
        role=data.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        clio_connected=bool(user.clio_access_token),
    )


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        clio_connected=bool(current_user.clio_access_token),
    )


# --- Clio OAuth ---

@router.get("/clio/connect")
async def clio_connect(current_user: User = Depends(get_current_user)):
    """Redirect user to Clio OAuth authorization page."""
    params = {
        "response_type": "code",
        "client_id": settings.clio_client_id,
        "redirect_uri": settings.clio_redirect_uri,
        "state": str(current_user.id),
    }
    from urllib.parse import urlencode
    url = f"{settings.clio_auth_url}?{urlencode(params)}"
    return RedirectResponse(url)


@router.get("/clio/callback")
async def clio_callback(
    code: str,
    state: str,
    db: Session = Depends(get_db),
):
    """Clio redirects here after authorization. Exchange code for tokens."""
    user_id = int(state)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid state")

    async with httpx.AsyncClient() as client:
        r = await client.post(
            settings.clio_token_url,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": settings.clio_redirect_uri,
                "client_id": settings.clio_client_id,
                "client_secret": settings.clio_client_secret,
            },
        )
        r.raise_for_status()
        token_data = r.json()

    user.clio_access_token = token_data["access_token"]
    user.clio_refresh_token = token_data.get("refresh_token")
    if token_data.get("expires_in"):
        user.clio_token_expires_at = datetime.now(timezone.utc) + timedelta(
            seconds=token_data["expires_in"]
        )
    db.commit()

    # Redirect to frontend
    return RedirectResponse(url="http://localhost:5174/settings?clio=connected")
