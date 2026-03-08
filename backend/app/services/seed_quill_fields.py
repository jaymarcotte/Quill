"""Seed Quill custom fields — all variables currently in document_generator.py build_context()."""
from sqlalchemy.orm import Session
from app.models.quill_field import QuillField

SEED_DATA = [
    # --- Client ---
    {"variable_name": "client_name", "label": "Client Full Name", "category": "Client",
     "applies_to": "all", "example": "Jay Marcotte",
     "description": "Client 1 full display name from Clio contact.", "sort_order": 10},
    {"variable_name": "client_first_name", "label": "Client First Name", "category": "Client",
     "applies_to": "all", "example": "Jay", "sort_order": 20},
    {"variable_name": "client_last_name", "label": "Client Last Name", "category": "Client",
     "applies_to": "all", "example": "Marcotte", "sort_order": 30},
    {"variable_name": "client_prefix", "label": "Client Prefix", "category": "Client",
     "applies_to": "all", "example": "Mr.", "sort_order": 40},
    {"variable_name": "client_email", "label": "Client Email", "category": "Client",
     "applies_to": "all", "example": "jay@jlmarcotte.com", "sort_order": 50},
    {"variable_name": "client_address", "label": "Client Full Address (block)", "category": "Client",
     "applies_to": "all", "example": "1717 E Morten Ave\nPhoenix, AZ 85020",
     "description": "Multi-line address block.", "sort_order": 60},
    {"variable_name": "client_address_street", "label": "Client Street", "category": "Client",
     "applies_to": "all", "example": "1717 E Morten Ave, Unit 24", "sort_order": 70},
    {"variable_name": "client_address_city", "label": "Client City", "category": "Client",
     "applies_to": "all", "example": "Phoenix", "sort_order": 80},
    {"variable_name": "client_address_state", "label": "Client State", "category": "Client",
     "applies_to": "all", "example": "AZ", "sort_order": 90},
    {"variable_name": "client_address_zip", "label": "Client ZIP", "category": "Client",
     "applies_to": "all", "example": "85020", "sort_order": 100},
    {"variable_name": "is_female", "label": "Client is Female (boolean)", "category": "Client",
     "applies_to": "all", "example": "true / false",
     "description": "Use with {% if is_female %} blocks for pronoun-sensitive language.", "sort_order": 110},

    # --- Joint / Spouse ---
    {"variable_name": "husband_name", "label": "Husband / Client 2 Name", "category": "Joint",
     "applies_to": "trust,pourover_will,closing_letter", "example": "James Smith", "sort_order": 10},
    {"variable_name": "wife_name", "label": "Wife / Client 1 Name (joint)", "category": "Joint",
     "applies_to": "trust,pourover_will,closing_letter", "example": "Jane Smith", "sort_order": 20},

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
    {"variable_name": "pregnancy_clause", "label": "Pregnancy Clause (legacy)", "category": "Living Will",
     "applies_to": "living_will",
     "description": "Legacy variable — always empty string. Use {% if is_female %} block in template instead.",
     "example": "", "sort_order": 10},

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
    {"variable_name": "attorney_rate", "label": "Attorney Rate / Fee", "category": "Engagement",
     "applies_to": "engagement_letter", "example": "$3,500 flat fee", "sort_order": 10},

    # --- System ---
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
    {"variable_name": "client_matter_name", "label": "Client Matter Name (alias)", "category": "System",
     "applies_to": "all", "example": "Jay Marcotte",
     "description": "Alias for client_name — used in some signature block templates.", "sort_order": 40},
]


def seed_quill_fields(db: Session) -> None:
    """Insert seed data if table is empty."""
    if db.query(QuillField).count() > 0:
        return
    for item in SEED_DATA:
        db.add(QuillField(**item))
    db.commit()
