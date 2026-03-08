"""
Document generation service using docxtpl (Jinja2 for Word).
The Word .docx file owns all fonts/styles/formatting.
We only inject data — formatting is preserved automatically.
"""
import os
import logging
import subprocess
from pathlib import Path
from datetime import datetime
from docxtpl import DocxTemplate
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Maps document_type key -> template filename
TEMPLATE_MAP = {
    "living_will_single_female": "__Single - Female - Living Will.docx",
    "living_will_single_male": "__Single -Male - Living Will.docx",
    "living_will_married_female": "__Married - Female  - Living Will.docx",
    "living_will_married_male": "__Married - Male - Living Will.docx",
    "hc_poa_single_female": "__Single - Female - HC POA.docx",
    "hc_poa_single_male": "__Single -Male -HC  POA.docx",
    "general_poa_single_female": "__Single - Female - General POA.docx",
    "general_poa_single_male": "__Single -Male -General POA.docx",
    "pourover_will_single_female": "__Single - Female - Pourover Will.docx",
    "pourover_will_single_male": "__Single - Male - Pourover Will.docx",
    "trust_single": "__Single - Trust.docx",
    "certificate_of_trust_single": "__Single - Certificate of Trust.docx",
    "engagement_letter": "__Engagement Letter - Flat Rate.docx",
    "closing_letter_single": "__Single - Closing Summary Letter.docx",
    "email_drafts_single": "__Single - Email with Drafts - Trust.docx",
    "email_drafts_married": "__Married - Email with Drafts - Trust.docx",
    "trust_waiver": "__Trust -  Waiver.docx",
}


def build_context(document_type: str, wizard_data: dict) -> dict:
    """
    Build the Jinja2 context dict from wizard answers.
    All templates share the same context keys — unused keys are simply ignored.
    """
    client = wizard_data.get("client", {})
    client_2 = wizard_data.get("client_2", {})
    address = client.get("address", {})

    # Format full address block
    address_parts = [
        address.get("street", ""),
        f"{address.get('city', '')}, {address.get('state', '')} {address.get('zip', '')}".strip(", "),
    ]
    full_address = "\n".join(p for p in address_parts if p.strip(", "))

    # Date formatting
    now = datetime.now()
    months = ["January","February","March","April","May","June",
               "July","August","September","October","November","December"]
    date_verbose = f"{months[now.month - 1]} {now.day}, {now.year}"

    ctx = {
        # Client 1
        # client_matter_name is an alias some templates use in signature blocks
        "client_name": client.get("name", ""),
        "client_matter_name": client.get("name", ""),
        "client_first_name": client.get("first_name", ""),
        "client_last_name": client.get("last_name", ""),
        "client_prefix": client.get("prefix", ""),
        "client_email": client.get("email", ""),
        "client_address": full_address,
        "client_address_street": address.get("street", ""),
        "client_address_city": address.get("city", ""),
        "client_address_state": address.get("state", ""),
        "client_address_zip": address.get("zip", ""),

        # Client 2 (Joint)
        "husband_name": wizard_data.get("husband_name", client_2.get("name", "")),
        "wife_name": wizard_data.get("wife_name", client.get("name", "")),

        # Matter / Trust
        "trust_name": wizard_data.get("trust_name", ""),
        "attorney_rate": wizard_data.get("attorney_rate", ""),
        "rate_type": wizard_data.get("rate_type", ""),
        "rate_description": wizard_data.get("rate_description", ""),

        # Dates
        "date_verbose": date_verbose,
        "date_year": str(now.year),

        # Conditionals
        "is_female": wizard_data.get("is_female", False),
        # pregnancy_clause: legacy variable — template should use {% if is_female %} block instead.
        # This empty string prevents the old {{ pregnancy_clause }} tag from printing anything.
        "pregnancy_clause": "",

        # HC POA agents
        "hc_agent_1": wizard_data.get("hc_agent_1", ""),
        "hc_agent_2": wizard_data.get("hc_agent_2", ""),
        "hc_agent_structure": wizard_data.get("hc_agent_structure", "single"),
        # single | co_agents | primary_successor

        # General POA agents
        "poa_agent_1a": wizard_data.get("poa_agent_1a", ""),
        "poa_agent_1b": wizard_data.get("poa_agent_1b", ""),
        "poa_andor": wizard_data.get("poa_andor", "and/or"),
        "poa_joint_authority": wizard_data.get("poa_joint_authority", ""),
        "poa_agent_2": wizard_data.get("poa_agent_2", ""),
        "poa_agent_3": wizard_data.get("poa_agent_3", ""),
        "poa_has_co_agents": wizard_data.get("poa_has_co_agents", False),

        # Trust trustees
        "trustee_1": wizard_data.get("trustee_1", ""),
        "trustee_2": wizard_data.get("trustee_2", ""),
        "trustee_2a": wizard_data.get("trustee_2a", ""),
        "trustee_2b": wizard_data.get("trustee_2b", ""),
        "trustee_structure": wizard_data.get("trustee_structure", "sequential"),
        # sequential | co_trustees

        # Trust beneficiaries / children
        "child_1": wizard_data.get("child_1", ""),
        "child_2": wizard_data.get("child_2", ""),
        "child_3": wizard_data.get("child_3", ""),
        "beneficiaries": wizard_data.get("beneficiaries", []),

        # Closing letter optional sections
        "has_brokerage": wizard_data.get("has_brokerage", False),
        "has_other_accounts": wizard_data.get("has_other_accounts", False),
        "other_account_name": wizard_data.get("other_account_name", ""),
        "has_llc": wizard_data.get("has_llc", False),
        "has_special_warranty_deed": wizard_data.get("has_special_warranty_deed", False),

        # Document list for email/closing letter
        "selected_documents": wizard_data.get("selected_documents", []),
    }

    return ctx


def generate_docx(template_filename: str, wizard_data: dict, output_filename: str) -> str:
    """
    Render a template with wizard data and write the output .docx.
    template_filename is the bare filename (e.g. '__Single - Trust.docx'), not a type key.
    Returns the full path to the generated file.
    """
    template_path = os.path.join(settings.templates_dir, template_filename)
    if not os.path.exists(template_path):
        raise FileNotFoundError(f"Template not found: {template_path}")

    os.makedirs(settings.output_dir, exist_ok=True)
    output_path = os.path.join(settings.output_dir, output_filename)

    ctx = build_context(template_filename, wizard_data)

    tpl = DocxTemplate(template_path)
    tpl.render(ctx)
    tpl.save(output_path)

    logger.info(f"Generated {template_filename} -> {output_path}")
    return output_path


def convert_to_pdf(docx_path: str) -> str:
    """
    Convert a .docx to PDF using LibreOffice headless (best fidelity).
    Returns path to generated PDF.
    """
    output_dir = os.path.dirname(docx_path)
    try:
        subprocess.run(
            [
                "libreoffice",
                "--headless",
                "--convert-to", "pdf",
                "--outdir", output_dir,
                docx_path,
            ],
            check=True,
            capture_output=True,
            timeout=60,
        )
    except FileNotFoundError:
        raise RuntimeError(
            "LibreOffice not found. Ensure it is installed in the Docker image."
        )
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"PDF conversion failed: {e.stderr.decode()}")

    pdf_path = docx_path.replace(".docx", ".pdf")
    if not os.path.exists(pdf_path):
        raise RuntimeError(f"PDF not created at expected path: {pdf_path}")

    return pdf_path
