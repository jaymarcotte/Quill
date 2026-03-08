"""Firm-wide settings API — fee schedule and practice configuration."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import Optional
from app.database import get_db
from app.models.firm_settings import FirmSettings
from app.models.user import User
from app.api.auth import get_current_user

router = APIRouter(prefix="/firm-settings", tags=["firm-settings"])

# Rate type metadata — key, label, description template
RATE_TYPES = [
    {
        "key": "flat_joint_trust",
        "label": "Joint Trust Estate Plan",
        "description_template": "a flat fee of {amount} for a joint trust-based estate plan",
    },
    {
        "key": "flat_individual_trust",
        "label": "Individual Trust Estate Plan",
        "description_template": "a flat fee of {amount} for an individual trust-based estate plan",
    },
    {
        "key": "flat_joint_will",
        "label": "Joint Will & Beneficiary Deed",
        "description_template": "a flat fee of {amount} for a joint will-based estate plan including a beneficiary deed",
    },
    {
        "key": "flat_individual_will",
        "label": "Individual Will & Beneficiary Deed",
        "description_template": "a flat fee of {amount} for an individual will-based estate plan including a beneficiary deed",
    },
    {
        "key": "hourly",
        "label": "Hourly Rate",
        "description_template": "an hourly basis at the rate of {amount} per hour",
    },
]


def _get_or_create(db: Session) -> FirmSettings:
    row = db.query(FirmSettings).first()
    if not row:
        row = FirmSettings()
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def _serialize(row: FirmSettings) -> dict:
    rates = {rt["key"]: getattr(row, f"rate_{rt['key']}", "") for rt in RATE_TYPES}
    return {
        "rates": rates,
        "rate_types": RATE_TYPES,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


class RatesUpdate(BaseModel):
    rate_flat_joint_trust: Optional[str] = None
    rate_flat_individual_trust: Optional[str] = None
    rate_flat_joint_will: Optional[str] = None
    rate_flat_individual_will: Optional[str] = None
    rate_hourly: Optional[str] = None


@router.get("")
async def get_firm_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = _get_or_create(db)
    return {"data": _serialize(row)}


@router.patch("")
async def update_firm_settings(
    body: RatesUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = _get_or_create(db)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(row, field, value)
    row.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    return {"data": _serialize(row)}


@router.get("/rate-description")
async def get_rate_description(
    rate_key: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the resolved attorney_rate and rate_description for a given rate_key."""
    row = _get_or_create(db)
    rt = next((r for r in RATE_TYPES if r["key"] == rate_key), None)
    if not rt:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"Unknown rate key: {rate_key}")
    amount = getattr(row, f"rate_{rate_key}", "") or ""
    description = rt["description_template"].format(amount=amount) if amount else ""
    return {
        "rate_key": rate_key,
        "attorney_rate": amount,
        "rate_type": rate_key,
        "rate_description": description,
        "label": rt["label"],
    }
