from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from app.services.clio import ClioClient
from app.api.auth import get_current_user_clio_client

router = APIRouter(prefix="/contacts", tags=["contacts"])


class ContactUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    prefix: Optional[str] = None
    # Address
    street: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = None
    postal_code: Optional[str] = None
    # Phone / email (primary)
    phone: Optional[str] = None
    email: Optional[str] = None
    # Custom fields (stored by Clio custom field ID)
    middle_name: Optional[str] = None
    pronoun_id: Optional[int] = None   # Clio picklist option ID
    special_notes: Optional[str] = None


class ContactCreate(BaseModel):
    first_name: str
    last_name: Optional[str] = None
    prefix: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


class MatterRelationshipAdd(BaseModel):
    contact_id: int
    description: Optional[str] = None  # The "Link" label e.g. "Client 2", "Beneficiary"


@router.get("/search")
async def search_contacts(
    q: str = Query(..., min_length=2),
    clio: ClioClient = Depends(get_current_user_clio_client),
):
    """Search contacts — returns rich card data for disambiguation."""
    results = await clio.search_contacts_rich(q)
    return results


@router.get("/{contact_id}")
async def get_contact(
    contact_id: int,
    clio: ClioClient = Depends(get_current_user_clio_client),
):
    contact = await clio.get_contact_full(contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {"data": contact}


@router.patch("/{contact_id}")
async def update_contact(
    contact_id: int,
    body: ContactUpdate,
    clio: ClioClient = Depends(get_current_user_clio_client),
):
    """Update contact fields and save directly to Clio."""
    result = await clio.update_contact(contact_id, body.model_dump(exclude_none=True))
    if not result:
        raise HTTPException(status_code=400, detail="Failed to update contact in Clio")
    return {"data": result}


@router.post("")
async def create_contact(
    body: ContactCreate,
    clio: ClioClient = Depends(get_current_user_clio_client),
):
    """Create a new contact in Clio."""
    result = await clio.create_contact(body.model_dump(exclude_none=True))
    if not result:
        raise HTTPException(status_code=400, detail="Failed to create contact in Clio")
    return {"data": result}


@router.post("/matter/{matter_id}/relationships")
async def add_matter_relationship(
    matter_id: int,
    body: MatterRelationshipAdd,
    clio: ClioClient = Depends(get_current_user_clio_client),
):
    """Link a contact to a matter with an optional description label."""
    result = await clio.add_matter_relationship(matter_id, body.contact_id, body.description)
    if not result:
        raise HTTPException(status_code=400, detail="Failed to add relationship in Clio")
    return {"data": result}


@router.delete("/matter/{matter_id}/relationships/{relationship_id}")
async def remove_matter_relationship(
    matter_id: int,
    relationship_id: int,
    clio: ClioClient = Depends(get_current_user_clio_client),
):
    """Remove a contact-matter link."""
    ok = await clio.remove_matter_relationship(relationship_id)
    if not ok:
        raise HTTPException(status_code=400, detail="Failed to remove relationship in Clio")
    return {"status": "ok"}
