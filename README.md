# Quill

> Estate planning document automation for Hillary P. Gagnon, Attorney at Law.
> Connects to Clio Manage via OAuth, guides staff through a structured wizard,
> generates populated Word (.docx) + PDF estate planning documents, and uploads
> completed files back to the Clio matter folder.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 + shadcn/ui + TypeScript |
| Backend | FastAPI (Python 3.12) |
| Database | PostgreSQL 17 + pgvector |
| Documents | docxtpl (Jinja2 for Word) + LibreOffice headless PDF |
| AI | Claude (Anthropic) / Ollama (local fallback) |
| Deployment | Docker Compose |

## Ports

| Service | Port |
|---|---|
| Backend API | 8001 |
| Frontend (dev) | 5174 |
| PostgreSQL | 5433 |

Ports chosen to avoid conflict with other services on the same host.

---

## Quick Start

```bash
# 1. Copy and fill in environment variables
cp .env.example .env
# Edit .env — add CLIO_CLIENT_ID, CLIO_CLIENT_SECRET, ANTHROPIC_API_KEY

# 2. Start development stack
docker compose --profile dev up --build

# 3. Create first user (run once)
curl -X POST http://localhost:8001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"hillary@quill.com","full_name":"Hillary Gagnon","password":"yourpassword","role":"lawyer"}'

# 4. Open the app and connect Clio
# Frontend:  http://localhost:5174
# Settings → Connect Clio Account
```

API docs: http://localhost:8001/docs

---

## Local Development (without Docker)

```bash
# Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --port 8001 --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev -- -p 5174
```

---

## Clio OAuth Setup

1. Log into Clio → **Settings → Developer → API Keys → Create App**
2. Set **Redirect URI** to `http://localhost:8001/api/auth/clio/callback`
   (use your production domain for Synology deployment)
3. Request scopes: `matters`, `contacts`, `documents`, `custom_field_values`
4. Copy **Client ID** and **Client Secret** into `.env`
5. Restart backend: `docker compose restart backend`
6. Visit **Settings → Connect Clio Account** in the app

To discover Hillary's custom fields after connecting:

```
GET http://localhost:8001/api/clio/fields
Authorization: Bearer <your-jwt-token>
```

Returns all custom field IDs, names, types, and models. Use this to fill in
`backend/app/services/clio_field_map.py` with the real field IDs.

---

## Data Model: Where Fields Come From

The wizard blends data from three sources:

### 1. Clio Standard Fields (auto-populated)

Pulled automatically when a matter is opened in the wizard:

| Clio Field | Quill Template Variable |
|---|---|
| `contact.name` | `client_name`, `client_matter_name` |
| `contact.first_name` | `client_first_name` |
| `contact.last_name` | `client_last_name` |
| `contact.prefix` | `client_prefix` |
| `contact.email_addresses[0]` | `client_email` |
| `contact.addresses[0].street` | `client_address_street` |
| `contact.addresses[0].city` | `client_address_city` |
| `contact.addresses[0].state` | `client_address_state` |
| `contact.addresses[0].zip` | `client_address_zip` |
| `matter.display_number` | (matter label in UI) |
| Auto-generated | `date_verbose`, `date_year` |

### 2. Clio Custom Fields (mapped after field discovery)

Hillary's practice-specific fields stored in Clio on Contact or Matter records.
After connecting Clio, hit `GET /api/clio/fields` to get IDs, then update
`backend/app/services/clio_field_map.py`:

```python
CLIO_CUSTOM_FIELD_MAP = {
    123456: "spouse_name",
    123457: "trust_name",
    123458: "poa_agent_1a",
    # add more as discovered
}
```

The wizard will auto-populate any mapped fields — users only see them if Clio
doesn't already have a value.

### 3. Quill-Only Fields (wizard always asks)

Things that don't exist in Clio at all:

| Field | Type | Purpose |
|---|---|---|
| `is_female` | bool | Triggers pregnancy clause block in Living Will |
| `hc_agent_structure` | enum | `single` / `co_agents` / `primary_successor` |
| `hc_agent_1` | string | Primary HC POA agent name |
| `hc_agent_2` | string | Successor / co-agent |
| `poa_agent_1a` | string | Primary General POA agent |
| `poa_agent_1b` | string | Co-agent (if joint authority) |
| `poa_has_co_agents` | bool | Joint authority toggle |
| `poa_andor` | string | "and" / "or" / "and/or" |
| `poa_agent_2`, `poa_agent_3` | string | Successor POA agents |
| `trustee_structure` | enum | `sequential` / `co_trustees` |
| `trustee_1` | string | Primary trustee |
| `trustee_2`, `trustee_2a`, `trustee_2b` | string | Successor / co-trustees |
| `beneficiaries` | list | `[{name, share, relationship}]` |
| `has_brokerage` | bool | Closing letter optional section |
| `has_llc` | bool | Closing letter optional section |
| `has_special_warranty_deed` | bool | Closing letter optional section |
| `other_account_name` | string | Closing letter optional section |
| `selected_documents` | list | Document list for email/closing letter |

---

## Document Templates

Word templates live in `backend/app/templates_docx/`. Files prefixed with `__`
are templates (prefix sorts them to the top in file explorers).

Templates use [Jinja2](https://jinja.palletsprojects.com/) syntax:

```
{{ client_name }}              — simple variable (inherits run's Word formatting)
{% if is_female %}             — conditional block
  ...pregnancy clause text...
{% endif %}
{% for b in beneficiaries %}   — repeating block
  {{ b.name }} — {{ b.share }}%
{% endfor %}
```

**Key rule:** The Word file owns all fonts, styles, and formatting. Quill only
injects data. `docxtpl` replaces `{{ variable }}` within the existing Word run,
so bold stays bold, font stays the same.

### Template Map

| Key | Template File |
|---|---|
| `living_will_single_female` | `__Single - Female - Living Will.docx` |
| `living_will_single_male` | `__Single - Male - Living Will.docx` |
| `living_will_married_female` | `__Married - Female - Living Will.docx` |
| `living_will_married_male` | `__Married - Male - Living Will.docx` |
| `hc_poa_single_female` | `__Single - Female - HC POA.docx` |
| `hc_poa_single_male` | `__Single - Male - HC POA.docx` |
| `general_poa_single_female` | `__Single - Female - General POA.docx` |
| `general_poa_single_male` | `__Single - Male - General POA.docx` |
| `pourover_will_single_female` | `__Single - Female - Pourover Will.docx` |
| `pourover_will_single_male` | `__Single - Male - Pourover Will.docx` |
| `trust_single` | `__Single - Trust.docx` |
| `certificate_of_trust_single` | `__Single - Certificate of Trust.docx` |
| `engagement_letter` | `__Engagement Letter - Flat Rate.docx` |
| `closing_letter_single` | `__Single - Closing Summary Letter.docx` |
| `email_drafts_single` | `__Single - Email with Drafts - Trust.docx` |
| `email_drafts_married` | `__Married - Email with Drafts - Trust.docx` |
| `trust_waiver` | `__Trust - Waiver.docx` |

---

## Users & Roles

| Role | Access |
|---|---|
| `lawyer` | Full access — all matters, generate, upload to Clio |
| `assistant` | Same as lawyer (role-based restrictions TBD) |

Create additional users via the register endpoint. Each user connects their own
Clio account independently via Settings.

---

## Synology Deployment

```bash
# On Synology via SSH
git clone https://github.com/jaymarcotte/Quill.git
cd Quill
cp .env.example .env
# Edit .env with production values and production Clio redirect URI
docker compose --profile prod up -d --build
```

Set **Clio Redirect URI** in your Clio app to your production domain:
`https://yourdomain.com/api/auth/clio/callback`

Configure Nginx reverse proxy + Let's Encrypt in DSM → Login Portal → Reverse Proxy.

---

## Architecture Notes

- **No Clio = no matters.** The Matters page requires a connected Clio account.
  Settings page shows connection status and the connect button.
- **pgvector ready.** `CREATE EXTENSION vector;` in a future migration enables
  semantic search across documents and client notes. No performance impact until used.
- **LibreOffice headless** runs inside the backend Docker container for PDF conversion.
  The `generate_pdf: true` flag in the API request triggers it.
- **Template volume mount.** `backend/app/templates_docx/` is mounted live into
  Docker — template edits take effect immediately without a rebuild.
- **Token storage.** Clio OAuth tokens are stored per-user in the database.
  Refresh token rotation is handled on each API call.

---

## Getting Back on Track

If the project drifts, these are the source-of-truth anchors:

1. **This README** — architecture, field mapping, template variable reference
2. **`backend/app/services/document_generator.py`** — canonical list of all Quill template variables
3. **`backend/app/services/clio.py`** — all Clio API calls and field selectors
4. **`GET /api/clio/fields`** — live dump of Hillary's actual Clio custom fields (requires connected account)
5. **`GET /docs`** — FastAPI interactive API docs at http://localhost:8001/docs
