from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime, timezone
from app.database import Base


class FirmSettings(Base):
    __tablename__ = "firm_settings"

    id: Mapped[int] = mapped_column(primary_key=True)

    # Fee schedule — stored as display strings e.g. "$3,500" or "$350/hour"
    rate_flat_joint_trust: Mapped[str] = mapped_column(String(50), default="")
    rate_flat_individual_trust: Mapped[str] = mapped_column(String(50), default="")
    rate_flat_joint_will: Mapped[str] = mapped_column(String(50), default="")
    rate_flat_individual_will: Mapped[str] = mapped_column(String(50), default="")
    rate_hourly: Mapped[str] = mapped_column(String(50), default="")

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
