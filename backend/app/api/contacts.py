from fastapi import APIRouter, Depends, HTTPException, Query
from app.services.clio import ClioClient
from app.api.auth import get_current_user_clio_client

router = APIRouter(prefix="/contacts", tags=["contacts"])


@router.get("/search")
async def search_contacts(
    q: str = Query(..., min_length=2),
    clio: ClioClient = Depends(get_current_user_clio_client),
):
    results = await clio.search_contacts(q)
    # Return slim shape for typeahead
    return [{"id": c["id"], "text": c.get("name", "")} for c in results]


@router.get("/{contact_id}")
async def get_contact(
    contact_id: int,
    clio: ClioClient = Depends(get_current_user_clio_client),
):
    contact = await clio.get_contact(contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {"data": contact}
