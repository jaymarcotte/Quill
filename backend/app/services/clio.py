"""Clio API client — ported and cleaned up from the original Flask app."""
import logging
from typing import Any
import httpx
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class ClioClient:
    def __init__(self, access_token: str):
        self.access_token = access_token
        self.base_url = settings.clio_api_base.rstrip("/")
        self.headers = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    async def get(self, endpoint: str, params: dict | None = None) -> tuple[dict, int]:
        url = f"{self.base_url}/{endpoint.strip('/')}"
        async with httpx.AsyncClient(timeout=30) as client:
            try:
                r = await client.get(url, headers=self.headers, params=params)
                r.raise_for_status()
                return (r.json() if r.status_code != 204 else {}), r.status_code
            except httpx.HTTPStatusError as e:
                logger.error(f"Clio GET {url} => {e.response.status_code}: {e.response.text[:200]}")
                try:
                    return e.response.json(), e.response.status_code
                except Exception:
                    return {"error": e.response.text}, e.response.status_code
            except httpx.RequestError as e:
                logger.error(f"Clio GET {url} request error: {e}")
                return {"error": str(e)}, 500

    async def patch(self, endpoint: str, payload: dict, etag: str) -> tuple[dict, int]:
        url = f"{self.base_url}/{endpoint.strip('/')}"
        headers = {**self.headers, "If-Match": etag}
        async with httpx.AsyncClient(timeout=30) as client:
            try:
                r = await client.patch(url, headers=headers, json=payload)
                r.raise_for_status()
                return r.json(), r.status_code
            except httpx.HTTPStatusError as e:
                logger.error(f"Clio PATCH {url} => {e.response.status_code}: {e.response.text[:200]}")
                try:
                    return e.response.json(), e.response.status_code
                except Exception:
                    return {"error": e.response.text}, e.response.status_code

    async def post(self, endpoint: str, payload: dict) -> tuple[dict, int]:
        url = f"{self.base_url}/{endpoint.strip('/')}"
        async with httpx.AsyncClient(timeout=30) as client:
            try:
                r = await client.post(url, headers=self.headers, json=payload)
                r.raise_for_status()
                return r.json(), r.status_code
            except httpx.HTTPStatusError as e:
                logger.error(f"Clio POST {url} => {e.response.status_code}: {e.response.text[:200]}")
                try:
                    return e.response.json(), e.response.status_code
                except Exception:
                    return {"error": e.response.text}, e.response.status_code

    # --- Matters ---

    async def get_matters(self, status: str = "open,pending") -> list[dict]:
        """Fetch all open/pending matters with pagination."""
        matters = []
        page_token = None
        while True:
            params: dict[str, Any] = {
                "fields": "id,display_number,description,status,client{id,name}",
                "order": "display_number(asc)",
                "limit": 200,
                "status": status,
            }
            if page_token:
                params["page_token"] = page_token
            data, status_code = await self.get("matters", params=params)
            if status_code != 200:
                logger.error(f"Failed to fetch matters: {status_code}")
                break
            page_matters = data.get("data", [])
            matters.extend(page_matters)
            page_token = data.get("meta", {}).get("next_page_token")
            if not page_token:
                break
        return matters

    async def get_matter(self, matter_id: int) -> dict | None:
        fields = "id,etag,display_number,description,status,client{id,name},custom_field_values{id,etag,field_name,value}"
        data, status_code = await self.get(f"matters/{matter_id}", params={"fields": fields})
        if status_code == 200:
            return data.get("data")
        return None

    # --- Contacts ---

    async def search_contacts(self, query: str, limit: int = 20) -> list[dict]:
        params = {
            "query": query,
            "fields": "id,name,first_name,last_name,prefix,email_addresses{address},phone_numbers{number}",
            "limit": limit,
            "order": "name(asc)",
        }
        data, status_code = await self.get("contacts", params=params)
        if status_code == 200:
            return data.get("data", [])
        return []

    async def get_contact(self, contact_id: int) -> dict | None:
        fields = "id,etag,name,first_name,last_name,prefix,date_of_birth,email_addresses{address,type},phone_numbers{number,type},addresses{street,city,state,zip,country,type},custom_field_values{id,etag,field_name,value}"
        data, status_code = await self.get(f"contacts/{contact_id}", params={"fields": fields})
        if status_code == 200:
            return data.get("data")
        return None

    async def get_matter_relationships(self, matter_id: int) -> list[dict]:
        params = {
            "matter_id": matter_id,
            "fields": "id,description,contact{id,name}",
        }
        data, status_code = await self.get("relationships", params=params)
        if status_code == 200:
            return data.get("data", [])
        return []

    # --- Document upload to Clio ---

    async def upload_document(
        self, matter_id: int, file_bytes: bytes, filename: str, content_type: str
    ) -> dict | None:
        """Upload a document to a Clio matter."""
        # Step 1: Create document record
        payload = {
            "data": {
                "name": filename,
                "parent": {"id": matter_id, "type": "Matter"},
            }
        }
        doc_data, status_code = await self.post("documents", payload)
        if status_code not in (200, 201):
            logger.error(f"Failed to create Clio document record: {status_code}")
            return None

        doc = doc_data.get("data", {})
        doc_id = doc.get("id")
        upload_url = doc.get("latest_document_version", {}).get("put_url")

        if not upload_url or not doc_id:
            logger.error("Clio document record missing upload URL or ID")
            return None

        # Step 2: Upload file bytes to the presigned URL
        async with httpx.AsyncClient(timeout=60) as client:
            try:
                r = await client.put(
                    upload_url,
                    content=file_bytes,
                    headers={"Content-Type": content_type},
                )
                r.raise_for_status()
            except httpx.HTTPStatusError as e:
                logger.error(f"Clio file upload failed: {e.response.status_code}")
                return None

        # Step 3: Mark upload complete
        etag_data, _ = await self.get(f"documents/{doc_id}", params={"fields": "etag"})
        etag = etag_data.get("data", {}).get("etag", "")
        await self.patch(
            f"documents/{doc_id}",
            {"data": {"fully_uploaded": True}},
            etag,
        )

        return doc
