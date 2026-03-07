from sqlalchemy import String, Boolean, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime, timezone
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255))
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(50), default="assistant")  # lawyer | assistant
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Clio OAuth tokens (encrypted at rest in production)
    clio_access_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    clio_refresh_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    clio_token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
