"""
Seed document types into the DB from the canonical list.
Run on startup if the table is empty.

Template variant model (simplified — no gender columns):
  template_single  — used for single-client matters
  template_joint   — used for joint/married matters (falls back to template_single)
  template_default — catch-all regardless of structure

Gender / pronoun handling is done inside the Word templates via Jinja2
{% if is_female %} blocks. The template file itself does not change.
"""
from sqlalchemy.orm import Session
from app.models.document_type import DocumentType

# matter_type values:
#   estate_planning | probate | guardianship_conservatorship | trust_administration | all

# Canonical ordered list — matches Hillary's requested order exactly.
# template_single / template_joint point at the actual .docx filenames on disk.
# A document with only one template (no structural difference) uses template_default.
SEED_DATA = [
    {
        "label": "Engagement Letter",
        "wizard_key": "engagement_letter",
        "matter_type": "all",
        "clio_field_id": 15903668,
        "template_default": "__Engagement Letter - Flat Rate.docx",
        "sort_order": 10,
    },
    {
        "label": "Trust",
        "wizard_key": "trust",
        "matter_type": "estate_planning",
        "clio_field_id": 15903683,
        "template_single": "__Single - Trust.docx",
        "sort_order": 20,
    },
    {
        "label": "Certificate of Trust",
        "wizard_key": "certificate_of_trust",
        "matter_type": "estate_planning",
        "clio_field_id": None,
        "template_single": "__Single - Certificate of Trust.docx",
        "sort_order": 30,
    },
    {
        "label": "Trust Amendment",
        "wizard_key": "trust_amendment",
        "matter_type": "estate_planning",
        "clio_field_id": 15903803,
        "sort_order": 40,
    },
    {
        "label": "Pourover Will",
        "wizard_key": "pourover_will",
        "matter_type": "estate_planning",
        "clio_field_id": 15903698,
        "template_single": "__Single - Pourover Will.docx",
        "sort_order": 50,
    },
    {
        "label": "Will (No Trust)",
        "wizard_key": "will_no_trust",
        "matter_type": "estate_planning",
        "clio_field_id": 15903713,
        "sort_order": 60,
    },
    {
        "label": "Health Care POA",
        "wizard_key": "hc_poa",
        "matter_type": "estate_planning",
        "clio_field_id": 15903728,
        "template_single": "__Single - HC POA.docx",
        "sort_order": 70,
    },
    {
        "label": "General Financial POA",
        "wizard_key": "general_poa",
        "matter_type": "estate_planning",
        "clio_field_id": 15903743,
        "template_single": "__Single - General POA.docx",
        "sort_order": 80,
    },
    {
        "label": "Living Will",
        "wizard_key": "living_will",
        "matter_type": "estate_planning",
        "clio_field_id": 15903833,
        "template_single": "__Single - Living Will.docx",
        "template_joint": "__Married - Living Will.docx",
        "sort_order": 90,
    },
    {
        "label": "AZ Healthcare Directives Registry",
        "wizard_key": "az_hcdr",
        "matter_type": "estate_planning",
        "clio_field_id": None,
        "sort_order": 100,
    },
    {
        "label": "Special Warranty Deed",
        "wizard_key": "special_warranty_deed",
        "matter_type": "estate_planning",
        "clio_field_id": 15903758,
        "sort_order": 110,
    },
    {
        "label": "Beneficiary Deed",
        "wizard_key": "beneficiary_deed",
        "matter_type": "estate_planning",
        "clio_field_id": 15903773,
        "sort_order": 120,
    },
    {
        "label": "LLC Articles of Amendment",
        "wizard_key": "llc_articles",
        "matter_type": "estate_planning",
        "clio_field_id": None,
        "sort_order": 130,
    },
    {
        "label": "Waiver",
        "wizard_key": "waiver",
        "matter_type": "estate_planning",
        "clio_field_id": None,
        "template_default": "__Trust -  Waiver.docx",
        "sort_order": 140,
    },
    {
        "label": "Portfolio Pages (Trust)",
        "wizard_key": "portfolio_trust",
        "matter_type": "estate_planning",
        "clio_field_id": None,
        "sort_order": 150,
    },
    {
        "label": "Portfolio Pages (No Trust)",
        "wizard_key": "portfolio_no_trust",
        "matter_type": "estate_planning",
        "clio_field_id": None,
        "sort_order": 160,
    },
    {
        "label": "Closing Letter",
        "wizard_key": "closing_letter",
        "matter_type": "all",
        "clio_field_id": 15903788,
        "template_single": "__Single - Closing Summary Letter.docx",
        "sort_order": 170,
    },
]

# matter_type backfill map — wizard_key -> matter_type
MATTER_TYPE_BACKFILL: dict[str, str] = {item["wizard_key"]: item["matter_type"] for item in SEED_DATA}

# Old gendered filenames → canonical new name
# Used to migrate existing rows that used the old column names.
_GENDER_MIGRATION: dict[str, dict[str, str]] = {
    "trust":              {"template_single": "__Single - Trust.docx"},
    "certificate_of_trust": {"template_single": "__Single - Certificate of Trust.docx"},
    "pourover_will":      {"template_single": "__Single - Pourover Will.docx"},
    "hc_poa":             {"template_single": "__Single - HC POA.docx"},
    "general_poa":        {"template_single": "__Single - General POA.docx"},
    "living_will":        {"template_single": "__Single - Living Will.docx",
                          "template_joint":  "__Married - Living Will.docx"},
    "closing_letter":     {"template_single": "__Single - Closing Summary Letter.docx"},
}


def seed_document_types(db: Session) -> None:
    """Insert seed data if table is empty, then run migrations on existing rows."""
    if db.query(DocumentType).count() == 0:
        for item in SEED_DATA:
            db.add(DocumentType(
                label=item["label"],
                wizard_key=item["wizard_key"],
                matter_type=item["matter_type"],
                clio_field_id=item.get("clio_field_id"),
                template_default=item.get("template_default"),
                template_single=item.get("template_single"),
                template_joint=item.get("template_joint"),
                sort_order=item["sort_order"],
                active=True,
            ))
        db.commit()
    else:
        changed = False
        for dt in db.query(DocumentType).all():
            # Backfill matter_type
            canonical_type = MATTER_TYPE_BACKFILL.get(dt.wizard_key)
            if canonical_type and dt.matter_type != canonical_type:
                dt.matter_type = canonical_type
                changed = True

            # Migrate: if template_single is not set but one of the old gendered columns is,
            # copy the value across. SQLAlchemy will ignore unknown attributes gracefully.
            if not dt.template_single:
                migration = _GENDER_MIGRATION.get(dt.wizard_key, {})
                new_single = migration.get("template_single")
                new_joint = migration.get("template_joint")
                if new_single:
                    dt.template_single = new_single
                    changed = True
                if new_joint and not dt.template_joint:
                    dt.template_joint = new_joint
                    changed = True

        if changed:
            db.commit()
