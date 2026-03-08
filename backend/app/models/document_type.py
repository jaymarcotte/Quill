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

    # Clio custom field ID for the document checkbox (e.g. 15903833 for Living Will)
    # NULL means no Clio checkbox maps to this doc type
    clio_field_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Template filenames per variant. NULL = no template assigned yet.
    # For gender/structure variants we store each separately.
    template_single_male: Mapped[str | None] = mapped_column(Text, nullable=True)
    template_single_female: Mapped[str | None] = mapped_column(Text, nullable=True)
    template_joint_male: Mapped[str | None] = mapped_column(Text, nullable=True)
    template_joint_female: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Some docs have only one template regardless of gender/structure
    template_default: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Display order in the wizard (lower = first)
    sort_order: Mapped[int] = mapped_column(Integer, default=100)

    # Whether this doc type is active/visible in the wizard
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    def get_template(self, structure: str = "single", is_female: bool = False) -> str | None:
        """Return the best-matching template filename for the given structure/gender."""
        if self.template_default:
            return self.template_default
        if structure == "joint":
            return self.template_joint_female if is_female else self.template_joint_male
        return self.template_single_female if is_female else self.template_single_male
