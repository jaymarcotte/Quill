"""
DocumentType — database-driven configuration for document types.
Replaces the hardcoded TEMPLATE_MAP in document_generator.py.
Hillary can add, reorder, rename, and assign templates from the UI.
"""
from sqlalchemy import String, Integer, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class DocumentType(Base):
    __tablename__ = "document_types"

    id: Mapped[int] = mapped_column(primary_key=True)

    # Wizard display label (e.g. "Living Will")
    label: Mapped[str] = mapped_column(String(200))

    # Internal key used by the wizard and document generator
    # e.g. "living_will", "trust", "hc_poa"
    wizard_key: Mapped[str] = mapped_column(String(100), unique=True, index=True)

    # Practice area / matter type this document belongs to.
    # estate_planning | probate | guardianship_conservatorship | trust_administration | all
    matter_type: Mapped[str] = mapped_column(String(100), default="estate_planning")

    # Clio custom field ID for the document checkbox (e.g. 15903833 for Living Will)
    # NULL means no Clio checkbox maps to this doc type
    clio_field_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Template filenames per variant. NULL = no template assigned yet.
    # Two structure variants + a catch-all default.
    # is_female / pronouns are handled inside the template via Jinja2 conditionals.
    template_single: Mapped[str | None] = mapped_column(Text, nullable=True)
    template_joint: Mapped[str | None] = mapped_column(Text, nullable=True)
    template_default: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Display order in the wizard (lower = first)
    sort_order: Mapped[int] = mapped_column(Integer, default=100)

    # Whether this doc type is active/visible in the wizard
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    def get_template(self, structure: str = "single") -> str | None:
        """Return the best-matching template filename for the given structure."""
        if structure == "joint" and self.template_joint:
            return self.template_joint
        if self.template_single:
            return self.template_single
        return self.template_default
