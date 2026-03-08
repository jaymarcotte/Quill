"""
Seed document types into the DB from the canonical list.
Run on startup if the table is empty.
Also runs backfill_matter_type() to patch any existing rows missing matter_type.
"""
from sqlalchemy.orm import Session
from app.models.document_type import DocumentType

# matter_type values:
#   estate_planning | probate | guardianship_conservatorship | trust_administration | all

# Canonical ordered list — matches Hillary's requested order exactly.
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
        "template_single_male": "__Single - Trust.docx",
        "template_single_female": "__Single - Trust.docx",
        "sort_order": 20,
    },
    {
        "label": "Certificate of Trust",
        "wizard_key": "certificate_of_trust",
        "matter_type": "estate_planning",
        "clio_field_id": None,
        "template_single_male": "__Single - Certificate of Trust.docx",
        "template_single_female": "__Single - Certificate of Trust.docx",
        "sort_order": 30,
    },
    {
        "label": "Trust Amendment",
        "wizard_key": "trust_amendment",
        "matter_type": "estate_planning",
        "clio_field_id": 15903803,
        "template_default": None,
        "sort_order": 40,
    },
    {
        "label": "Pourover Will",
        "wizard_key": "pourover_will",
        "matter_type": "estate_planning",
        "clio_field_id": 15903698,
        "template_single_male": "__Single - Male - Pourover Will.docx",
        "template_single_female": "__Single - Female - Pourover Will.docx",
        "sort_order": 50,
    },
    {
        "label": "Will (No Trust)",
        "wizard_key": "will_no_trust",
        "matter_type": "estate_planning",
        "clio_field_id": 15903713,
        "template_default": None,
        "sort_order": 60,
    },
    {
        "label": "Health Care POA",
        "wizard_key": "hc_poa",
        "matter_type": "estate_planning",
        "clio_field_id": 15903728,
        "template_single_male": "__Single -Male -HC  POA.docx",
        "template_single_female": "__Single - Female - HC POA.docx",
        "sort_order": 70,
    },
    {
        "label": "General Financial POA",
        "wizard_key": "general_poa",
        "matter_type": "estate_planning",
        "clio_field_id": 15903743,
        "template_single_male": "__Single -Male -General POA.docx",
        "template_single_female": "__Single - Female - General POA.docx",
        "sort_order": 80,
    },
    {
        "label": "Living Will",
        "wizard_key": "living_will",
        "matter_type": "estate_planning",
        "clio_field_id": 15903833,
        "template_single_male": "__Single -Male - Living Will.docx",
        "template_single_female": "__Single - Female - Living Will.docx",
        "template_joint_male": "__Married - Male - Living Will.docx",
        "template_joint_female": "__Married - Female  - Living Will.docx",
        "sort_order": 90,
    },
    {
        "label": "AZ Healthcare Directives Registry",
        "wizard_key": "az_hcdr",
        "matter_type": "estate_planning",
        "clio_field_id": None,
        "template_default": None,
        "sort_order": 100,
    },
    {
        "label": "Special Warranty Deed",
        "wizard_key": "special_warranty_deed",
        "matter_type": "estate_planning",
        "clio_field_id": 15903758,
        "template_default": None,
        "sort_order": 110,
    },
    {
        "label": "Beneficiary Deed",
        "wizard_key": "beneficiary_deed",
        "matter_type": "estate_planning",
        "clio_field_id": 15903773,
        "template_default": None,
        "sort_order": 120,
    },
    {
        "label": "LLC Articles of Amendment",
        "wizard_key": "llc_articles",
        "matter_type": "estate_planning",
        "clio_field_id": None,
        "template_default": None,
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
        "template_default": None,
        "sort_order": 150,
    },
    {
        "label": "Portfolio Pages (No Trust)",
        "wizard_key": "portfolio_no_trust",
        "matter_type": "estate_planning",
        "clio_field_id": None,
        "template_default": None,
        "sort_order": 160,
    },
    {
        "label": "Closing Letter",
        "wizard_key": "closing_letter",
        "matter_type": "all",
        "clio_field_id": 15903788,
        "template_single_male": "__Single - Closing Summary Letter.docx",
        "template_single_female": "__Single - Closing Summary Letter.docx",
        "sort_order": 170,
    },
]

# matter_type backfill map — wizard_key -> matter_type
# Used to patch existing rows that predate the matter_type column.
MATTER_TYPE_BACKFILL: dict[str, str] = {item["wizard_key"]: item["matter_type"] for item in SEED_DATA}


def seed_document_types(db: Session) -> None:
    """Insert seed data if table is empty, then backfill matter_type on existing rows."""
    if db.query(DocumentType).count() == 0:
        for item in SEED_DATA:
            db.add(DocumentType(
                label=item["label"],
                wizard_key=item["wizard_key"],
                matter_type=item["matter_type"],
                clio_field_id=item.get("clio_field_id"),
                template_default=item.get("template_default"),
                template_single_male=item.get("template_single_male"),
                template_single_female=item.get("template_single_female"),
                template_joint_male=item.get("template_joint_male"),
                template_joint_female=item.get("template_joint_female"),
                sort_order=item["sort_order"],
                active=True,
            ))
        db.commit()
    else:
        # Backfill matter_type on any existing rows still set to default "estate_planning"
        # This handles the upgrade case where the column was just added.
        changed = False
        for dt in db.query(DocumentType).all():
            canonical = MATTER_TYPE_BACKFILL.get(dt.wizard_key)
            if canonical and dt.matter_type != canonical:
                dt.matter_type = canonical
                changed = True
        if changed:
            db.commit()
