"""
Seed document types into the DB from the canonical list.
Run on startup if the table is empty.
"""
from sqlalchemy.orm import Session
from app.models.document_type import DocumentType

# Canonical ordered list — matches Hillary's requested order exactly.
# clio_field_id = the Clio matter custom field checkbox ID (discovered from API).
SEED_DATA = [
    {
        "label": "Engagement Letter",
        "wizard_key": "engagement_letter",
        "clio_field_id": 15903668,
        "template_default": "__Engagement Letter - Flat Rate.docx",
        "sort_order": 10,
    },
    {
        "label": "Trust",
        "wizard_key": "trust",
        "clio_field_id": 15903683,
        "template_single_male": "__Single - Trust.docx",
        "template_single_female": "__Single - Trust.docx",
        "sort_order": 20,
    },
    {
        "label": "Certificate of Trust",
        "wizard_key": "certificate_of_trust",
        "clio_field_id": None,
        "template_single_male": "__Single - Certificate of Trust.docx",
        "template_single_female": "__Single - Certificate of Trust.docx",
        "sort_order": 30,
    },
    {
        "label": "Trust Amendment",
        "wizard_key": "trust_amendment",
        "clio_field_id": 15903803,
        "template_default": None,  # No template yet
        "sort_order": 40,
    },
    {
        "label": "Pourover Will",
        "wizard_key": "pourover_will",
        "clio_field_id": 15903698,
        "template_single_male": "__Single - Male - Pourover Will.docx",
        "template_single_female": "__Single - Female - Pourover Will.docx",
        "sort_order": 50,
    },
    {
        "label": "Will (No Trust)",
        "wizard_key": "will_no_trust",
        "clio_field_id": 15903713,
        "template_default": None,  # No template yet
        "sort_order": 60,
    },
    {
        "label": "Health Care POA",
        "wizard_key": "hc_poa",
        "clio_field_id": 15903728,
        "template_single_male": "__Single -Male -HC  POA.docx",
        "template_single_female": "__Single - Female - HC POA.docx",
        "sort_order": 70,
    },
    {
        "label": "General Financial POA",
        "wizard_key": "general_poa",
        "clio_field_id": 15903743,
        "template_single_male": "__Single -Male -General POA.docx",
        "template_single_female": "__Single - Female - General POA.docx",
        "sort_order": 80,
    },
    {
        "label": "Living Will",
        "wizard_key": "living_will",
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
        "clio_field_id": None,
        "template_default": None,
        "sort_order": 100,
    },
    {
        "label": "Special Warranty Deed",
        "wizard_key": "special_warranty_deed",
        "clio_field_id": 15903758,
        "template_default": None,
        "sort_order": 110,
    },
    {
        "label": "Beneficiary Deed",
        "wizard_key": "beneficiary_deed",
        "clio_field_id": 15903773,
        "template_default": None,
        "sort_order": 120,
    },
    {
        "label": "LLC Articles of Amendment",
        "wizard_key": "llc_articles",
        "clio_field_id": None,
        "template_default": None,
        "sort_order": 130,
    },
    {
        "label": "Waiver",
        "wizard_key": "waiver",
        "clio_field_id": None,
        "template_default": "__Trust -  Waiver.docx",
        "sort_order": 140,
    },
    {
        "label": "Portfolio Pages (Trust)",
        "wizard_key": "portfolio_trust",
        "clio_field_id": None,
        "template_default": None,
        "sort_order": 150,
    },
    {
        "label": "Portfolio Pages (No Trust)",
        "wizard_key": "portfolio_no_trust",
        "clio_field_id": None,
        "template_default": None,
        "sort_order": 160,
    },
    {
        "label": "Closing Letter",
        "wizard_key": "closing_letter",
        "clio_field_id": 15903788,
        "template_single_male": "__Single - Closing Summary Letter.docx",
        "template_single_female": "__Single - Closing Summary Letter.docx",
        "sort_order": 170,
    },
]


def seed_document_types(db: Session) -> None:
    """Insert seed data if table is empty."""
    if db.query(DocumentType).count() > 0:
        return
    for item in SEED_DATA:
        db.add(DocumentType(
            label=item["label"],
            wizard_key=item["wizard_key"],
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
