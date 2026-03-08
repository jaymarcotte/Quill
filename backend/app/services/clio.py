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

    async def search_contacts_rich(self, query: str, limit: int = 20) -> list[dict]:
        """Search contacts — returns rich card data for disambiguation (name, email, phone, city/state)."""
        params = {
            "query": query,
            "fields": "id,name,first_name,last_name,prefix,email_addresses{address},phone_numbers{number},addresses{street,city,province,postal_code}",
            "limit": limit,
            "order": "name(asc)",
        }
        data, status_code = await self.get("contacts", params=params)
        if status_code != 200:
            return []
        results = []
        for c in data.get("data", []):
            emails = [e["address"] for e in c.get("email_addresses", []) if e.get("address")]
            phones = [p["number"] for p in c.get("phone_numbers", []) if p.get("number")]
            addrs = c.get("addresses", [])
            city_state = ""
            if addrs:
                a = addrs[0]
                parts = [a.get("city", ""), a.get("province", "")]
                city_state = ", ".join(p for p in parts if p)
            results.append({
                "id": c["id"],
                "name": c.get("name", ""),
                "first_name": c.get("first_name", ""),
                "last_name": c.get("last_name", ""),
                "prefix": c.get("prefix", ""),
                "email": emails[0] if emails else "",
                "phone": phones[0] if phones else "",
                "city_state": city_state,
            })
        return results

    async def get_contact(self, contact_id: int) -> dict | None:
        fields = "id,etag,name,first_name,last_name,prefix,email_addresses{address},phone_numbers{number},addresses{street,city,province,postal_code},custom_field_values{id,etag,field_name,value}"
        data, status_code = await self.get(f"contacts/{contact_id}", params={"fields": fields})
        if status_code == 200:
            return data.get("data")
        return None

    async def get_contact_full(self, contact_id: int) -> dict | None:
        """Get contact with all fields normalized for the edit popover."""
        fields = "id,etag,name,first_name,last_name,prefix,email_addresses{address},phone_numbers{number},addresses{street,city,province,postal_code},custom_field_values{id,etag,field_name,value,picklist_option{id,option}}"
        data, status_code = await self.get(f"contacts/{contact_id}", params={"fields": fields})
        if status_code != 200:
            return None
        c = data.get("data", {})
        emails = [e["address"] for e in c.get("email_addresses", []) if e.get("address")]
        phones = [p["number"] for p in c.get("phone_numbers", []) if p.get("number")]
        addrs = c.get("addresses", [])
        addr = addrs[0] if addrs else {}

        # Extract custom fields into a flat dict
        custom: dict = {}
        for cf in c.get("custom_field_values", []):
            name = cf.get("field_name", "")
            val = cf.get("value")
            opt = cf.get("picklist_option")
            if opt:
                val = opt.get("option", val)
            custom[name] = val

        return {
            "id": c["id"],
            "etag": c.get("etag", ""),
            "name": c.get("name", ""),
            "first_name": c.get("first_name", ""),
            "last_name": c.get("last_name", ""),
            "prefix": c.get("prefix", ""),
            "email": emails[0] if emails else "",
            "phone": phones[0] if phones else "",
            "street": addr.get("street", ""),
            "city": addr.get("city", ""),
            "province": addr.get("province", ""),
            "postal_code": addr.get("postal_code", ""),
            "middle_name": custom.get("Middle Name", ""),
            "pronoun": custom.get("Pronoun", ""),
            "special_notes": custom.get("Special Notes", ""),
            "custom_field_values": c.get("custom_field_values", []),
        }

    async def update_contact(self, contact_id: int, updates: dict) -> dict | None:
        """PATCH contact fields back to Clio."""
        # First get etag
        etag_data, status = await self.get(f"contacts/{contact_id}", params={"fields": "id,etag"})
        if status != 200:
            return None
        etag = etag_data.get("data", {}).get("etag", "")

        # Build Clio PATCH payload
        payload: dict = {"data": {}}

        if "first_name" in updates:
            payload["data"]["first_name"] = updates["first_name"]
        if "last_name" in updates:
            payload["data"]["last_name"] = updates["last_name"]
        if "prefix" in updates:
            payload["data"]["prefix"] = updates["prefix"]

        # Address update
        addr_fields = {k: updates[k] for k in ["street", "city", "province", "postal_code"] if k in updates}
        if addr_fields:
            # Get existing address id
            addr_data, _ = await self.get(f"contacts/{contact_id}", params={"fields": "addresses{id}"})
            addrs = addr_data.get("data", {}).get("addresses", [])
            if addrs:
                payload["data"]["addresses"] = [{"id": addrs[0]["id"], **addr_fields}]
            else:
                payload["data"]["addresses"] = [addr_fields]

        # Phone update
        if "phone" in updates:
            ph_data, _ = await self.get(f"contacts/{contact_id}", params={"fields": "phone_numbers{id}"})
            phones = ph_data.get("data", {}).get("phone_numbers", [])
            if phones:
                payload["data"]["phone_numbers"] = [{"id": phones[0]["id"], "number": updates["phone"]}]
            else:
                payload["data"]["phone_numbers"] = [{"number": updates["phone"], "type": "work"}]

        # Email update
        if "email" in updates:
            em_data, _ = await self.get(f"contacts/{contact_id}", params={"fields": "email_addresses{id}"})
            emails = em_data.get("data", {}).get("email_addresses", [])
            if emails:
                payload["data"]["email_addresses"] = [{"id": emails[0]["id"], "address": updates["email"]}]
            else:
                payload["data"]["email_addresses"] = [{"address": updates["email"], "type": "work"}]

        # Custom fields — Middle Name (13844763), Special Notes (13844793), Pronoun (15902693)
        custom_updates = []
        CUSTOM_FIELD_IDS = {
            "middle_name": 13844763,
            "special_notes": 13844793,
            "pronoun_id": 15902693,
        }
        # Get existing custom field value IDs
        cf_data, _ = await self.get(f"contacts/{contact_id}", params={"fields": "custom_field_values{id,etag,value}"})
        cf_list = cf_data.get("data", {}).get("custom_field_values", [])

        for key, cf_id in CUSTOM_FIELD_IDS.items():
            if key not in updates:
                continue
            value = updates[key]
            # Find existing record
            existing = next((x for x in cf_list if x.get("id") and str(x.get("id")) == str(cf_id)), None)
            if existing:
                custom_updates.append({"id": existing["id"], "value": value})
            else:
                custom_updates.append({"custom_field": {"id": cf_id}, "value": value})

        if custom_updates:
            payload["data"]["custom_field_values"] = custom_updates

        if not payload["data"]:
            return {"status": "no_changes"}

        result, status = await self.patch(f"contacts/{contact_id}", payload, etag)
        if status in (200, 201):
            return result.get("data")
        logger.error(f"Contact update failed: {status} {result}")
        return None

    async def create_contact(self, data: dict) -> dict | None:
        """Create a new contact in Clio."""
        payload: dict = {
            "data": {
                "type": "Person",
                "first_name": data.get("first_name", ""),
            }
        }
        if data.get("last_name"):
            payload["data"]["last_name"] = data["last_name"]
        if data.get("prefix"):
            payload["data"]["prefix"] = data["prefix"]
        if data.get("phone"):
            payload["data"]["phone_numbers"] = [{"number": data["phone"], "type": "work"}]
        if data.get("email"):
            payload["data"]["email_addresses"] = [{"address": data["email"], "type": "work"}]

        result, status = await self.post("contacts", payload)
        if status in (200, 201):
            return result.get("data")
        logger.error(f"Contact create failed: {status} {result}")
        return None

    async def add_matter_relationship(self, matter_id: int, contact_id: int, description: str | None = None) -> dict | None:
        """Link a contact to a matter."""
        payload = {
            "data": {
                "contact": {"id": contact_id},
                "matter": {"id": matter_id},
            }
        }
        if description:
            payload["data"]["description"] = description
        result, status = await self.post("relationships", payload)
        if status in (200, 201):
            return result.get("data")
        logger.error(f"Add relationship failed: {status} {result}")
        return None

    async def remove_matter_relationship(self, relationship_id: int) -> bool:
        """Remove a contact-matter link by relationship ID."""
        url = f"{self.base_url}/relationships/{relationship_id}"
        async with httpx.AsyncClient(timeout=30) as client:
            try:
                r = await client.delete(url, headers=self.headers)
                return r.status_code in (200, 204)
            except Exception as e:
                logger.error(f"Remove relationship failed: {e}")
                return False

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
