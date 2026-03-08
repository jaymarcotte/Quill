"""
Fields API — serves both:
  GET /api/fields/quill         — Quill custom fields (editable)
  POST/PATCH/DELETE             — CRUD for Quill fields
  GET /api/fields/clio          — Clio fields (read-only, from Clio API)
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.models.quill_field import QuillField
from app.models.user import User
from app.api.auth import get_current_user, get_current_user_clio_client
from app.services.clio import ClioClient

router = APIRouter(prefix="/fields", tags=["fields"])


# --- Quill Fields ---

class QuillFieldCreate(BaseModel):
    variable_name: str
    label: str
    category: str = "General"
    applies_to: str = "all"
    description: Optional[str] = None
    example: Optional[str] = None
    sort_order: int = 100


class QuillFieldUpdate(BaseModel):
    label: Optional[str] = None
    category: Optional[str] = None
    applies_to: Optional[str] = None
    description: Optional[str] = None
    example: Optional[str] = None
    sort_order: Optional[int] = None
    active: Optional[bool] = None


def _serialize_quill(f: QuillField) -> dict:
    return {
        "id": f.id,
        "variable_name": f.variable_name,
        "label": f.label,
        "category": f.category,
        "applies_to": f.applies_to,
        "description": f.description,
        "example": f.example,
        "active": f.active,
        "sort_order": f.sort_order,
        "template_syntax": f"{{{{ {f.variable_name} }}}}",
    }


@router.get("/quill")
async def list_quill_fields(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    fields = (
        db.query(QuillField)
        .order_by(QuillField.category, QuillField.sort_order, QuillField.id)
        .all()
    )
    return {"data": [_serialize_quill(f) for f in fields]}


@router.post("/quill")
async def create_quill_field(
    body: QuillFieldCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = db.query(QuillField).filter(QuillField.variable_name == body.variable_name).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"variable_name '{body.variable_name}' already exists")
    f = QuillField(**body.model_dump())
    db.add(f)
    db.commit()
    db.refresh(f)
    return {"data": _serialize_quill(f)}


@router.patch("/quill/{field_id}")
async def update_quill_field(
    field_id: int,
    body: QuillFieldUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    f = db.get(QuillField, field_id)
    if not f:
        raise HTTPException(status_code=404, detail="Field not found")
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(f, key, value)
    db.commit()
    db.refresh(f)
    return {"data": _serialize_quill(f)}


@router.delete("/quill/{field_id}")
async def delete_quill_field(
    field_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    f = db.get(QuillField, field_id)
    if not f:
        raise HTTPException(status_code=404, detail="Field not found")
    db.delete(f)
    db.commit()
    return {"status": "ok"}


# --- Clio Standard Fields (hardcoded, read-only) ---

# Standard Clio API fields available on every matter/contact without custom fields.
CLIO_STANDARD_FIELDS = [
    # Contact fields
    {"group": "Contact", "name": "Full Name", "variable_name": "client_name", "source": "contact", "field_type": "text"},
    {"group": "Contact", "name": "First Name", "variable_name": "client_first_name", "source": "contact", "field_type": "text"},
    {"group": "Contact", "name": "Last Name", "variable_name": "client_last_name", "source": "contact", "field_type": "text"},
    {"group": "Contact", "name": "Name Prefix (Mr./Ms./Dr.)", "variable_name": "client_prefix", "source": "contact", "field_type": "text"},
    {"group": "Contact", "name": "Email Address", "variable_name": "client_email", "source": "contact", "field_type": "email"},
    {"group": "Contact", "name": "Phone Number", "variable_name": "client_phone", "source": "contact", "field_type": "phone"},
    {"group": "Contact", "name": "Address — Street", "variable_name": "client_address_street", "source": "contact", "field_type": "text"},
    {"group": "Contact", "name": "Address — City", "variable_name": "client_address_city", "source": "contact", "field_type": "text"},
    {"group": "Contact", "name": "Address — State", "variable_name": "client_address_state", "source": "contact", "field_type": "text"},
    {"group": "Contact", "name": "Address — Zip", "variable_name": "client_address_zip", "source": "contact", "field_type": "text"},
    # Spouse / Joint fields (second contact on matter)
    {"group": "Spouse / Joint", "name": "Spouse Full Name", "variable_name": "spouse_name", "source": "contact", "field_type": "text"},
    {"group": "Spouse / Joint", "name": "Spouse First Name", "variable_name": "spouse_first_name", "source": "contact", "field_type": "text"},
    {"group": "Spouse / Joint", "name": "Spouse Last Name", "variable_name": "spouse_last_name", "source": "contact", "field_type": "text"},
    {"group": "Spouse / Joint", "name": "Spouse Email", "variable_name": "spouse_email", "source": "contact", "field_type": "email"},
    {"group": "Spouse / Joint", "name": "Spouse Phone", "variable_name": "spouse_phone", "source": "contact", "field_type": "phone"},
    # Matter fields
    {"group": "Matter", "name": "Matter Number", "variable_name": "matter_number", "source": "matter", "field_type": "text"},
    {"group": "Matter", "name": "Matter Description", "variable_name": "matter_description", "source": "matter", "field_type": "text"},
    {"group": "Matter", "name": "Matter Status", "variable_name": "matter_status", "source": "matter", "field_type": "text"},
    {"group": "Matter", "name": "Open Date", "variable_name": "matter_open_date", "source": "matter", "field_type": "date"},
    {"group": "Matter", "name": "Practice Area", "variable_name": "matter_practice_area", "source": "matter", "field_type": "text"},
    # Firm / Attorney
    {"group": "Firm", "name": "Attorney Name", "variable_name": "attorney_name", "source": "matter", "field_type": "text"},
    {"group": "Firm", "name": "Firm Name", "variable_name": "firm_name", "source": "matter", "field_type": "text"},
    {"group": "Firm", "name": "Today's Date", "variable_name": "today_date", "source": "system", "field_type": "date"},
    {"group": "Firm", "name": "Document Date (long form)", "variable_name": "doc_date_long", "source": "system", "field_type": "text"},
]


@router.get("/clio-standard")
async def list_clio_standard_fields(
    current_user: User = Depends(get_current_user),
):
    """Return the hardcoded standard Clio/system fields available in all templates."""
    result = []
    for i, f in enumerate(CLIO_STANDARD_FIELDS):
        result.append({
            "id": f"std_{i}",
            "name": f["name"],
            "group": f["group"],
            "field_type": f["field_type"],
            "source": f["source"],
            "variable_name": f["variable_name"],
            "template_syntax": f"{{{{ {f['variable_name']} }}}}",
        })
    return {"data": result}


# --- Clio Fields (read-only, live from Clio API) ---

@router.get("/clio")
async def list_clio_fields(
    clio: ClioClient = Depends(get_current_user_clio_client),
):
    """
    Return all Clio custom fields (contact + matter) with their
    Quill variable name so they can be referenced in templates.
    """
    contact_fields, _ = await clio.get(
        "custom_fields",
        params={"fields": "id,name,field_type,parent_type,picklist_options{id,option}", "limit": 200, "parent_type": "Contact"},
    )
    matter_fields, _ = await clio.get(
        "custom_fields",
        params={"fields": "id,name,field_type,parent_type,picklist_options{id,option}", "limit": 200, "parent_type": "Matter"},
    )

    def to_variable(name: str) -> str:
        """Convert a Clio field name to a snake_case variable name."""
        import re
        s = name.lower().strip()
        s = re.sub(r"[^a-z0-9]+", "_", s)
        s = s.strip("_")
        return f"clio_{s}"

    def serialize_field(f: dict, source: str) -> dict:
        opts = [o["option"] for o in f.get("picklist_options", [])]
        vname = to_variable(f["name"])
        return {
            "id": f["id"],
            "name": f["name"],
            "field_type": f["field_type"],
            "source": source,  # "contact" | "matter"
            "variable_name": vname,
            "template_syntax": f"{{{{ {vname} }}}}",
            "picklist_options": opts,
        }

    result = []
    for f in contact_fields.get("data", []):
        result.append(serialize_field(f, "contact"))
    for f in matter_fields.get("data", []):
        result.append(serialize_field(f, "matter"))

    return {"data": result}
