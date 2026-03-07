from sqlalchemy import String, Integer, Text, DateTime, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, timezone
from app.database import Base


class DocumentJob(Base):
    """Tracks each document generation request — the full wizard answers + output files."""
    __tablename__ = "document_jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    # Clio matter
    clio_matter_id: Mapped[int] = mapped_column(Integer)
    clio_matter_label: Mapped[str] = mapped_column(String(500))

    # Document type (living_will_single_female, hc_poa_single, trust_single, etc.)
    document_type: Mapped[str] = mapped_column(String(100))

    # All wizard answers stored as JSON — the source of truth for regeneration
    wizard_data: Mapped[dict] = mapped_column(JSON, default=dict)

    # Generated file paths
    docx_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    pdf_path: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Clio upload status
    clio_document_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    clio_uploaded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    status: Mapped[str] = mapped_column(String(50), default="draft")  # draft | generated | uploaded

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])
