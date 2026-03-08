"""
Seed Quill Blocks — complex/conditional variables that have no direct Clio equivalent.
These are NOT simple contact or matter fields; those live in Clio Standard or Clio Custom.
Quill Blocks are: conditional paragraphs, agent/trustee lists, computed text, flags, etc.
"""
from sqlalchemy.orm import Session
from app.models.quill_field import QuillField

# Variable names that belong to Clio Standard — purge if they were incorrectly seeded here.
CLIO_STANDARD_VARIABLE_NAMES = {
    "client_name", "client_first_name", "client_last_name", "client_prefix",
    "client_email", "client_phone",
    "client_address_street", "client_address_city", "client_address_state", "client_address_zip",
    "spouse_name", "spouse_first_name", "spouse_last_name", "spouse_email", "spouse_phone",
    "matter_number", "matter_description", "matter_status", "matter_open_date", "matter_practice_area",
    "attorney_name", "firm_name", "today_date", "doc_date_long",
    # alias that duplicates client_name
    "client_matter_name",
}

SEED_DATA = [
    # --- Joint / Spouse (wizard-computed, not raw Clio fields) ---
    {"variable_name": "husband_name", "label": "Husband / Client 2 Name", "category": "Joint",
     "applies_to": "trust,pourover_will,closing_letter", "example": "James Smith",
     "description": "Wizard-resolved name of the spouse/second client.", "sort_order": 10},
    {"variable_name": "wife_name", "label": "Wife / Client 1 Name (joint)", "category": "Joint",
     "applies_to": "trust,pourover_will,closing_letter", "example": "Jane Smith",
     "description": "Wizard-resolved name of the primary client in a joint matter.", "sort_order": 20},
    {"variable_name": "is_female", "label": "Client is Female (boolean)", "category": "Joint",
     "applies_to": "all", "example": "true / false",
     "description": "Use with {% if is_female %} blocks for pronoun-sensitive language.", "sort_order": 30},

    # --- Trust ---
    {"variable_name": "trust_name", "label": "Trust Name", "category": "Trust",
     "applies_to": "trust,certificate_of_trust,pourover_will,closing_letter,waiver",
     "example": "The Marcotte Family Trust", "sort_order": 10},
    {"variable_name": "trustee_1", "label": "Trustee 1", "category": "Trust",
     "applies_to": "trust,certificate_of_trust", "example": "Jay Marcotte", "sort_order": 20},
    {"variable_name": "trustee_2", "label": "Trustee 2 (successor)", "category": "Trust",
     "applies_to": "trust,certificate_of_trust", "example": "Kenzee Marcotte", "sort_order": 30},
    {"variable_name": "trustee_2a", "label": "Trustee 2a", "category": "Trust",
     "applies_to": "trust", "example": "Kenzee Marcotte", "sort_order": 40},
    {"variable_name": "trustee_2b", "label": "Trustee 2b", "category": "Trust",
     "applies_to": "trust", "example": "Bryce Marcotte", "sort_order": 50},
    {"variable_name": "trustee_structure", "label": "Trustee Structure", "category": "Trust",
     "applies_to": "trust",
     "example": "sequential / co_trustees",
     "description": "Use with {% if trustee_structure == 'co_trustees' %} blocks.", "sort_order": 60},
    {"variable_name": "child_1", "label": "Child 1 Name", "category": "Trust",
     "applies_to": "trust,pourover_will", "example": "Kenzee Marcotte", "sort_order": 70},
    {"variable_name": "child_2", "label": "Child 2 Name", "category": "Trust",
     "applies_to": "trust,pourover_will", "example": "Bryce Marcotte", "sort_order": 80},
    {"variable_name": "child_3", "label": "Child 3 Name", "category": "Trust",
     "applies_to": "trust,pourover_will", "example": "Third Child", "sort_order": 90},
    {"variable_name": "beneficiaries", "label": "Beneficiaries (list)", "category": "Trust",
     "applies_to": "trust",
     "description": "List of beneficiary dicts. Use with {% for b in beneficiaries %}.",
     "example": "[{name: 'Kenzee', share: '50%'}]", "sort_order": 100},
    {"variable_name": "client_address", "label": "Full Address Block (multi-line)", "category": "Trust",
     "applies_to": "all",
     "description": "Wizard-assembled multi-line address block (street, city, state, zip).",
     "example": "1717 E Morten Ave\nPhoenix, AZ 85020", "sort_order": 110},

    # --- Health Care POA ---
    {"variable_name": "hc_agent_1", "label": "HC Agent 1 (Primary)", "category": "HC POA",
     "applies_to": "hc_poa", "example": "Kenzee Marcotte", "sort_order": 10},
    {"variable_name": "hc_agent_2", "label": "HC Agent 2 (Successor)", "category": "HC POA",
     "applies_to": "hc_poa", "example": "Bryce Marcotte", "sort_order": 20},
    {"variable_name": "hc_agent_structure", "label": "HC Agent Structure", "category": "HC POA",
     "applies_to": "hc_poa",
     "example": "single / co_agents / primary_successor",
     "description": "Controls which agent language block is rendered.", "sort_order": 30},

    # --- General / Financial POA ---
    {"variable_name": "poa_agent_1a", "label": "POA Agent 1a", "category": "General POA",
     "applies_to": "general_poa", "example": "Kenzee Marcotte", "sort_order": 10},
    {"variable_name": "poa_agent_1b", "label": "POA Agent 1b (co-agent)", "category": "General POA",
     "applies_to": "general_poa", "example": "Bryce Marcotte", "sort_order": 20},
    {"variable_name": "poa_andor", "label": "POA Joint Authority Language", "category": "General POA",
     "applies_to": "general_poa", "example": "and/or",
     "description": "Inserted between agent names when co-agents exist.", "sort_order": 30},
    {"variable_name": "poa_joint_authority", "label": "POA Joint Authority Clause", "category": "General POA",
     "applies_to": "general_poa",
     "example": "with the power and authority to act jointly or individually", "sort_order": 40},
    {"variable_name": "poa_agent_2", "label": "POA Agent 2 (successor)", "category": "General POA",
     "applies_to": "general_poa", "example": "Hillary Gagnon", "sort_order": 50},
    {"variable_name": "poa_agent_3", "label": "POA Agent 3 (2nd successor)", "category": "General POA",
     "applies_to": "general_poa", "example": "", "sort_order": 60},
    {"variable_name": "poa_has_co_agents", "label": "POA Has Co-Agents (boolean)", "category": "General POA",
     "applies_to": "general_poa",
     "description": "Use with {% if poa_has_co_agents %} blocks.", "sort_order": 70},

    # --- Living Will ---
    {"variable_name": "pregnancy_clause", "label": "Pregnancy Clause", "category": "Living Will",
     "applies_to": "living_will",
     "description": "Conditional paragraph — rendered only for female clients via {% if is_female %} in template.",
     "example": "In the event of pregnancy...", "sort_order": 10},

    # --- Closing Letter ---
    {"variable_name": "has_brokerage", "label": "Has Brokerage Account (boolean)", "category": "Closing",
     "applies_to": "closing_letter", "example": "true / false", "sort_order": 10},
    {"variable_name": "has_other_accounts", "label": "Has Other Accounts (boolean)", "category": "Closing",
     "applies_to": "closing_letter", "example": "true / false", "sort_order": 20},
    {"variable_name": "other_account_name", "label": "Other Account Name", "category": "Closing",
     "applies_to": "closing_letter", "example": "Fidelity IRA", "sort_order": 30},
    {"variable_name": "has_llc", "label": "Has LLC (boolean)", "category": "Closing",
     "applies_to": "closing_letter", "example": "true / false", "sort_order": 40},
    {"variable_name": "has_special_warranty_deed", "label": "Has Special Warranty Deed (boolean)",
     "category": "Closing", "applies_to": "closing_letter", "example": "true / false", "sort_order": 50},

    # --- Engagement ---
    {"variable_name": "attorney_rate", "label": "Attorney Rate / Fee Amount", "category": "Engagement",
     "applies_to": "engagement_letter", "example": "$3,500",
     "description": "Dollar amount of the selected fee. Resolved from firm settings by rate_type.", "sort_order": 10},
    {"variable_name": "rate_type", "label": "Rate Type Key", "category": "Engagement",
     "applies_to": "engagement_letter",
     "example": "flat_individual_trust",
     "description": "Key string for the selected rate. Use with {% if rate_type == 'hourly' %} blocks.", "sort_order": 20},
    {"variable_name": "rate_description", "label": "Rate Description (prose)", "category": "Engagement",
     "applies_to": "engagement_letter",
     "example": "a flat fee of $3,500 for an individual trust-based estate plan",
     "description": "Full prose phrase ready to insert into the engagement letter body.", "sort_order": 30},

    # --- System (computed at generation time) ---
    {"variable_name": "date_verbose", "label": "Date (verbose)", "category": "System",
     "applies_to": "all", "example": "March 8, 2026",
     "description": "Auto-generated at document creation time.", "sort_order": 10},
    {"variable_name": "date_year", "label": "Year", "category": "System",
     "applies_to": "all", "example": "2026",
     "description": "4-digit year, auto-generated.", "sort_order": 20},
    {"variable_name": "selected_documents", "label": "Selected Documents (list)", "category": "System",
     "applies_to": "closing_letter,engagement_letter",
     "description": "List of wizard_key strings for selected docs. Use in closing/engagement letter loops.",
     "example": "['trust','hc_poa','living_will']", "sort_order": 30},
]


def seed_quill_fields(db: Session) -> None:
    """
    Seed Quill blocks, purging any rows that were incorrectly seeded
    with Clio Standard variable names (client_name, etc.).
    """
    # 1. Purge any incorrectly seeded Clio Standard variables
    purged = (
        db.query(QuillField)
        .filter(QuillField.variable_name.in_(CLIO_STANDARD_VARIABLE_NAMES))
        .all()
    )
    if purged:
        for row in purged:
            db.delete(row)
        db.commit()

    # 2. Seed missing rows
    existing_keys = {f.variable_name for f in db.query(QuillField).all()}
    for item in SEED_DATA:
        if item["variable_name"] not in existing_keys:
            db.add(QuillField(**item))
    db.commit()
