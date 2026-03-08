"""
QuillField — custom fields that Quill collects in the wizard and injects into templates.
These are fields that do NOT come from Clio (Clio fields are read directly from the API).
Hillary can add new fields here; they appear on the Field Reference page with copy-to-clipboard.
"""
from sqlalchemy import String, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class QuillField(Base):
    __tablename__ = "quill_fields"

    id: Mapped[int] = mapped_column(primary_key=True)

    # The variable name used inside {{ }} in Word templates
    variable_name: Mapped[str] = mapped_column(String(100), unique=True, index=True)

    # Human-readable label shown in the wizard and field reference
    label: Mapped[str] = mapped_column(String(200))

    # Which document(s) this field applies to — comma-separated wizard_keys or "all"
    applies_to: Mapped[str] = mapped_column(String(500), default="all")

    # Category for grouping on the Field Reference page
    # e.g. "Client", "Trust", "HC POA", "General POA", "Closing", "System"
    category: Mapped[str] = mapped_column(String(100), default="General")

    # Description shown in the field reference tooltip / help text
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Example value shown in the field reference
    example: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Whether this field is actively collected in the wizard
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Sort order within category
    sort_order: Mapped[int] = mapped_column(default=100)
