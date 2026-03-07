from fastapi import APIRouter, Depends, HTTPException, Query
from app.services.clio import ClioClient
from app.api.auth import get_current_user_clio_client

router = APIRouter(prefix="/matters", tags=["matters"])


@router.get("")
async def list_matters(
    clio: ClioClient = Depends(get_current_user_clio_client),
):
    matters = await clio.get_matters()
    return {"data": matters}


@router.get("/{matter_id}")
async def get_matter(
    matter_id: int,
    clio: ClioClient = Depends(get_current_user_clio_client),
):
    matter = await clio.get_matter(matter_id)
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")
    return {"data": matter}


@router.get("/{matter_id}/relationships")
async def get_matter_relationships(
    matter_id: int,
    clio: ClioClient = Depends(get_current_user_clio_client),
):
    rels = await clio.get_matter_relationships(matter_id)
    return {"data": rels}
