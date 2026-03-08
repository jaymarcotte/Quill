"""
Clio field discovery endpoint.
Hit GET /api/clio/fields after connecting your Clio account to see all
custom field IDs, names, types, and models available in Hillary's Clio account.
Use the IDs to populate clio_field_map.py.
"""
from fastapi import APIRouter, Depends
from app.api.auth import get_current_user_clio_client
from app.services.clio import ClioClient

router = APIRouter(prefix="/clio", tags=["clio"])


@router.get("/fields")
async def list_clio_custom_fields(clio: ClioClient = Depends(get_current_user_clio_client)):
    """
    Return all custom fields defined in Hillary's Clio account.
    Use this to discover field IDs for mapping to Quill template variables.
    """
    data, status_code = await clio.get(
        "custom_fields",
        params={"fields": "id,name,field_type,model_type,parent_type", "limit": 200},
    )
    fields = data.get("data", [])
    return {
        "count": len(fields),
        "fields": [
            {
                "id": f.get("id"),
                "name": f.get("name"),
                "field_type": f.get("field_type"),
                "model_type": f.get("model_type"),
                "parent_type": f.get("parent_type"),
            }
            for f in fields
        ],
    }
