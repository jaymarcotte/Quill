# Quill

> Estate planning document automation for Hillary P. Gagnon, Attorney at Law.
> Connects to Clio Manage via OAuth, guides staff through a structured wizard,
> generates populated Word (.docx) + PDF estate planning documents, and can upload
> completed files back to the Clio matter folder.

**Product vision and build order:** See [SCOPE.md](SCOPE.md)
**After each feature:** update README backlog + SCOPE.md checklist + `git push`

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 + shadcn/ui + TypeScript |
| Backend | FastAPI (Python 3.12) |
| Database | PostgreSQL 17 + pgvector |
| Documents | docxtpl (Jinja2 for Word) + LibreOffice headless PDF |
| Deployment | Docker Compose |

## Ports

| Service | Port |
|---|---|
| Backend API | 8001 |
| Frontend (dev) | 5174 |
| Frontend (prod via nginx) | 80 / 443 |
| PostgreSQL | 5433 |

---

## Quick Start

```bash
# 1. Copy and fill in environment variables
cp .env.example .env
# Edit .env — add CLIO_CLIENT_ID, CLIO_CLIENT_SECRET

# 2. Start development stack (hot-reload)
docker compose --profile dev up --build

# 3. Create first user (run once)
curl -X POST http://localhost:8001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"hillary@example.com","full_name":"Hillary Gagnon","password":"yourpassword","role":"lawyer"}'

# 4. Open the app and connect Clio
# http://localhost:5174  →  Settings → Connect Clio Account
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
   (use production domain for Synology deployment)
3. Request scopes: `matters`, `contacts`, `documents`, `custom_field_values`
4. Copy **Client ID** and **Client Secret** into `.env`
5. Restart backend: `docker compose restart backend`
6. Visit **Settings → Connect Clio Account** in the app

To verify Hillary's connected custom fields:
```
GET http://localhost:8001/api/clio/fields
Authorization: Bearer <jwt-token>
```

---

## App Pages (what exists today)

| Route | Purpose | Status |
|---|---|---|
| `/matters` | Browse Clio matters, open wizard | Done |
| `/wizard/[matterId]` | Multi-step document generation wizard | Done |
| `/documents` | View generated document jobs, download docx/pdf | Done |
| `/templates` | Upload/download template .docx files (old TEMPLATE_MAP approach) | Done — superseded by /fields |
| `/fields` | View all Quill + Clio field variable reference | Done |
| `/settings` | Clio OAuth connect, user info | Done |

---

## Wizard Steps

The wizard is at `/wizard/[matterId]` and walks through:

1. **Setup** — Client 1 + Client 2 contact cards (search or create in Clio); pronouns (He/Him, She/Her, They/Them) auto-populated from Clio contact on selection; pregnancy clause shown inline when She/Her; estate structure (single/joint)
2. **Documents** — Select which documents to generate (checkbox list from DB)
3. **Trust** *(conditional — appears only if Trust is selected)* — Trust name
4. **Living Will** *(conditional — appears only if Living Will is selected)* — Review only; uses Setup data
5. **Review** — Summary of all selections before generating
6. **Generate** — Fires parallel `POST /api/documents/generate` for each selected document

**Pregnancy clause:** Explicit Yes/No question shown only when `is_female = true`. Stored as `include_pregnancy_clause` boolean in wizard_data. Templates should use `{% if is_female %}` blocks.

---

## Document Type System (DB-Driven)

Document types are stored in the `document_types` table and managed via:

- **UI:** `/fields` page (future — template upload per variant is in `/fields`)
- **API:** `GET/POST/PATCH/DELETE /api/document-types`
- **Seed:** `backend/app/services/seed_document_types.py` — runs on startup if table is empty

Each `DocumentType` record has:

| Column | Purpose |
|---|---|
| `wizard_key` | Short identifier used by wizard: `living_will`, `hc_poa`, etc. |
| `label` | Display name: "Living Will", "Health Care POA" |
| `matter_type` | `estate_planning` / `probate` / `guardianship_conservatorship` / `trust_administration` / `all` |
| `clio_field_id` | Clio custom field ID (checkbox) — used to auto-pre-select docs from Clio matter |
| `template_default` | Fallback template filename |
| `template_single_male` | Template for single/male client |
| `template_single_female` | Template for single/female client |
| `template_joint_male` | Template for joint/male primary client |
| `template_joint_female` | Template for joint/female primary client |
| `sort_order` | Display order in wizard |
| `active` | Whether shown in wizard |

### Template Resolution Logic (backend)

When generating, `_resolve_template()` in `backend/app/api/documents.py` picks the best available template:

1. `template_{structure}_{gender}` (exact match)
2. `template_{structure}_male` (same structure, opposite gender)
3. `template_{structure}_female`
4. `template_single_male` (fall back to single)
5. `template_single_female`
6. `template_default`

Returns HTTP 400 with a clear error if no template file exists on disk.

### Document Types (current seed list)

| wizard_key | Label | Clio Field ID |
|---|---|---|
| `engagement_letter` | Engagement Letter | 15903668 |
| `trust` | Trust | 15903683 |
| `certificate_of_trust` | Certificate of Trust | — |
| `trust_amendment` | Trust Amendment | 15903803 |
| `pourover_will` | Pourover Will | 15903698 |
| `will_no_trust` | Will (No Trust) | 15903713 |
| `hc_poa` | Health Care POA | 15903728 |
| `general_poa` | General Financial POA | 15903743 |
| `living_will` | Living Will | 15903833 |
| `az_hcdr` | AZ Healthcare Directives Registry | — |
| `special_warranty_deed` | Special Warranty Deed | 15903758 |
| `beneficiary_deed` | Beneficiary Deed | 15903773 |
| `llc_articles` | LLC Articles of Amendment | — |
| `waiver` | Waiver | — |
| `portfolio_trust` | Portfolio Pages (Trust) | — |
| `portfolio_no_trust` | Portfolio Pages (No Trust) | — |
| `closing_letter` | Closing Letter | 15903788 |

---

## Hillary's Clio Custom Fields (Discovered)

136 custom fields in her Clio account. Key fields for document generation:

### Contact Fields

| Clio ID | Name | Quill Variable |
|---|---|---|
| 13844763 | Middle Name | `client_middle_name` *(not yet in context)* |
| 13844778 / 10937688 | Social Security Number | `ssn` *(not yet in context)* |
| 13844733 | Birth Date | `birth_date` *(not yet in context)* |
| 6869176 | DOB | `dob` *(not yet in context)* |
| 15902693 | Pronoun | `pronoun` *(can auto-set is_female)* |

### Matter Fields (Key for Wizard Auto-Population)

| Clio ID | Name | Quill Variable / Purpose |
|---|---|---|
| 5315476 | Client 1 | Primary client contact |
| "Principal Client 2" (field_name) | Client 2 / Principal Client 2 | value = Clio contact ID; fetched via getContact |
| 14358376 | Trust Name | `trust_name` — auto-populate wizard |
| 14358646 | he/she | `is_female` — auto-set pronoun from Clio |
| 13844883 | Husband | `husband_name` |
| 13845003 | Wife | `wife_name` |
| 14078358 | Child 1 | `child_1` |
| 14078583 | Child 2 | `child_2` |
| 14759332 | Poa1b | `poa_agent_1b` |
| 14759377 | Poa2 | `poa_agent_2` |
| 13845063 | FIN POA 1b | `poa_agent_1b` (alt) |
| 13845093 | FIN POA 3 | `poa_agent_3` |
| 13845108 | Joint Authority | `poa_joint_authority` |
| 14759662 | Trustee 2 | `trustee_2` |
| 14759617 | Trust Bene 3 | `beneficiaries` |
| 15902438 | Estate Structure | `structure` — `single` / `joint` |
| 14078733 | HC Agent Statement | `hc_agent_structure` |

### Document Checkbox Fields (Auto-Pre-Select Wizard)

These Clio fields are checkboxes on the matter — when checked, the corresponding document should be pre-selected in the wizard. Already mapped in `CLIO_FIELD_TO_KEY` in `wizard/[matterId]/page.tsx`:

| Clio ID | Name | wizard_key |
|---|---|---|
| 15903668 | Document: Engagement Letter | `engagement_letter` |
| 15903683 | Document: Trust | `trust` |
| 15903698 | Document: Pourover Will | `pourover_will` |
| 15903713 | Document: Will | `will_no_trust` |
| 15903728 | Document: Health Care POA | `hc_poa` |
| 15903743 | Document: Financial POA | `general_poa` |
| 15903758 | Document: Special Warranty Deed | `special_warranty_deed` |
| 15903773 | Document: Beneficiary Deed | `beneficiary_deed` |
| 15903788 | Document: Closing Letter | `closing_letter` |
| 15903803 | Document: Trust Amendment | `trust_amendment` |
| 15903833 | Document: Living Will | `living_will` |

---

## Template Variables Reference

Templates use [docxtpl](https://docxtpl.readthedocs.io/) (Jinja2 inside Word).

```
{{ client_name }}              — simple variable (inherits Word run formatting)
{% if is_female %}             — conditional block
  ...pregnancy clause...
{% endif %}
{% for b in beneficiaries %}   — repeating block
  {{ b.name }} — {{ b.share }}
{% endfor %}
```

**Key rule:** Word owns all fonts, styles, formatting. Quill only injects data.

### Client Variables

| Variable | Source | Example |
|---|---|---|
| `client_name` | Clio contact | "Jane Smith" |
| `client_matter_name` | Alias of client_name | "Jane Smith" |
| `client_first_name` | Clio contact | "Jane" |
| `client_last_name` | Clio contact | "Smith" |
| `client_prefix` | Clio contact | "Ms." |
| `client_email` | Clio contact | "jane@email.com" |
| `client_address` | Clio contact (assembled) | "123 Main St\nPhoenix, AZ 85001" |
| `client_address_street` | Clio contact | "123 Main St" |
| `client_address_city` | Clio contact | "Phoenix" |
| `client_address_state` | Clio contact | "AZ" |
| `client_address_zip` | Clio contact | "85001" |

### Joint / Spouse Variables

| Variable | Source | Example |
|---|---|---|
| `is_female` | Wizard Setup | `true` / `false` |
| `husband_name` | Wizard / Clio custom | "James Smith" |
| `wife_name` | Wizard / Clio custom | "Jane Smith" |

### Trust Variables

| Variable | Source | Example |
|---|---|---|
| `trust_name` | Wizard Trust step | "The Smith Family Trust" |
| `trustee_1` | Wizard | "Jane Smith" |
| `trustee_2` | Wizard | "James Smith" |
| `trustee_2a` | Wizard | "James Smith" |
| `trustee_2b` | Wizard | "Kenzee Smith" |
| `trustee_structure` | Wizard | `sequential` / `co_trustees` |
| `child_1` | Wizard | "Kenzee Smith" |
| `child_2` | Wizard | "Bryce Smith" |
| `child_3` | Wizard | "" |
| `beneficiaries` | Wizard | `[{name, share, relationship}]` |

### Health Care POA Variables

| Variable | Source | Example |
|---|---|---|
| `hc_agent_1` | Wizard | "Kenzee Smith" |
| `hc_agent_2` | Wizard | "Bryce Smith" |
| `hc_agent_structure` | Wizard | `single` / `co_agents` / `primary_successor` |

### General / Financial POA Variables

| Variable | Source | Example |
|---|---|---|
| `poa_agent_1a` | Wizard | "Kenzee Smith" |
| `poa_agent_1b` | Wizard | "Bryce Smith" |
| `poa_andor` | Wizard | `and/or` |
| `poa_joint_authority` | Wizard | Clause text |
| `poa_agent_2` | Wizard | "Hillary Gagnon" |
| `poa_agent_3` | Wizard | "" |
| `poa_has_co_agents` | Wizard | `true` / `false` |

### Living Will Variables

| Variable | Source | Notes |
|---|---|---|
| `is_female` | Wizard Setup | Use `{% if is_female %}` for pregnancy clause block |
| `include_pregnancy_clause` | Wizard Setup | Explicit boolean — use as secondary guard |
| `pregnancy_clause` | Legacy | Always `""` — do not use; use `{% if is_female %}` instead |

### Closing / Engagement Letter Variables

| Variable | Source | Example |
|---|---|---|
| `attorney_rate` | Wizard | "$3,500 flat fee" |
| `has_brokerage` | Wizard | `true` / `false` |
| `has_other_accounts` | Wizard | `true` / `false` |
| `other_account_name` | Wizard | "Fidelity IRA" |
| `has_llc` | Wizard | `true` / `false` |
| `has_special_warranty_deed` | Wizard | `true` / `false` |
| `selected_documents` | Wizard | `['trust','hc_poa','living_will']` |

### System Variables (auto-generated)

| Variable | Example |
|---|---|
| `date_verbose` | "March 8, 2026" |
| `date_year` | "2026" |

---

## API Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/token` | Login (returns JWT) |
| POST | `/api/auth/register` | Create user |
| GET | `/api/auth/me` | Current user info |
| GET | `/api/auth/clio/connect` | Start Clio OAuth flow |
| GET | `/api/matters` | List Clio matters |
| GET | `/api/matters/{id}` | Get single matter |
| GET | `/api/contacts/search` | Search Clio contacts |
| GET | `/api/contacts/{id}` | Get contact detail |
| POST | `/api/documents/generate` | Generate document(s) |
| GET | `/api/documents` | List generated document jobs |
| GET | `/api/documents/{id}/download/docx` | Download generated .docx |
| GET | `/api/documents/{id}/download/pdf` | Download generated PDF |
| GET | `/api/document-types` | List all document types (DB) |
| POST | `/api/document-types` | Create document type |
| PATCH | `/api/document-types/{id}` | Update document type |
| DELETE | `/api/document-types/{id}` | Delete document type |
| POST | `/api/document-types/{id}/upload/{variant}` | Upload template for a variant |
| GET | `/api/document-types/{id}/download/{variant}` | Download template for a variant |
| GET | `/api/fields/quill` | List Quill block variables |
| GET | `/api/fields/clio` | List Clio custom fields (from DB cache) |
| GET | `/api/fields/clio-standard` | List Clio standard fields reference |
| GET | `/api/clio/fields` | Live-fetch Hillary's Clio custom fields |

---

## Architecture Notes

- **No Clio = no matters.** Matters page requires a connected Clio account.
- **Template volume mount.** `backend/app/templates_docx/` is mounted live into Docker — template file edits take effect immediately without rebuild.
- **DB-driven document types.** Templates are assigned per-variant in the DB. The generate endpoint resolves the best available template automatically.
- **LibreOffice headless** runs inside the backend container for PDF conversion. `generate_pdf: true` in the API request triggers it.
- **pgvector ready.** Extension installed but not yet used. Reserved for future semantic search.
- **Token storage.** Clio OAuth tokens stored per-user in the DB. Refresh rotation handled on each API call.

---

## Deploying to Synology NAS

```bash
git clone https://github.com/jaymarcotte/Quill.git
cd Quill
cp .env.example .env
# Edit .env with production values
docker compose --profile prod up -d --build
```

Set **Clio Redirect URI** to: `https://yourdomain.com/api/auth/clio/callback`

---

## What Still Needs to Be Built

See [SCOPE.md](SCOPE.md) for the full prioritized build order with checkboxes.
Resume from the first unchecked item in SCOPE.md Phase 1.

### 1. Wizard: Auto-Populate from Clio Custom Fields
**Priority: High — build next**
When a matter opens in the wizard, Quill should read Hillary's Clio custom fields on the matter and pre-fill wizard answers automatically. Fields to auto-populate:

- `trust_name` ← Clio field 14358376
- `is_female` ← Clio field 14358646 (`he/she` picklist)
- `structure` ← Clio field 15902438 (`Estate Structure` picklist: single/joint)
- `hc_agent_1` / `hc_agent_2` ← Clio field 14078733 (`HC Agent Statement`)
- `poa_agent_1b` ← Clio fields 14759332, 13845063
- `poa_agent_2` ← Clio field 14759377
- `poa_agent_3` ← Clio field 13845093
- `poa_joint_authority` ← Clio field 13845108
- `trustee_2` ← Clio field 14759662
- `child_1` / `child_2` ← Clio fields 14078358, 14078583 (contact type)
- Document pre-selection ← Clio checkbox fields 15903668–15903833 (partially wired in frontend, but Clio API must return `custom_field_values` on the matter)

The matter API call in `backend/app/api/matters.py` needs to include `custom_field_values{field_name,value}` in the Clio fields selector.

### 2. Wizard: Missing Data-Entry Steps
**Priority: High**
These steps are defined in the wizard structure but show no input fields yet — users must fill them manually after download:

- **HC POA step** — inputs for `hc_agent_1`, `hc_agent_2`, `hc_agent_structure`
- **General POA step** — inputs for `poa_agent_1a`, `poa_agent_1b`, `poa_andor`, `poa_agent_2`, `poa_agent_3`, `poa_has_co_agents`
- **Trust (trustees)** — inputs for `trustee_1`, `trustee_2`, `trustee_structure`, `trustee_2a`, `trustee_2b`
- **Trust (beneficiaries)** — dynamic list: `child_1`, `child_2`, `child_3`, `beneficiaries`
- **Closing Letter step** — toggles for `has_brokerage`, `has_llc`, `has_special_warranty_deed`, `other_account_name`
- **Engagement Letter step** — input for `attorney_rate`

### 3. Document Type Manager UI (Template Upload per Variant)
**Priority: High**
The `/fields` page exists but does not yet show the document type table with template upload buttons per variant. The backend endpoints (`POST /api/document-types/{id}/upload/{variant}`, `GET /api/document-types/{id}/download/{variant}`) are fully built. The UI just needs to call them.

This replaces the old `/templates` page (which used the now-deprecated static TEMPLATE_MAP).

Design: table of document types, each row expandable to show variants (single_male, single_female, joint_male, joint_female, default) with Upload / Download buttons and a file-exists indicator.

### 4. Field Reference Panel
**Priority: Medium**
A clean page (or panel on `/fields`) where Hillary can see every `{{ variable_name }}` available with description and example value, and copy it to clipboard with one click. This is what she uses when editing templates in Word.

All data already exists in `GET /api/fields/quill` and `GET /api/fields/clio-standard`. Just needs a clean read-only UI with copy buttons.

### 5. Clio Upload After Generation
**Priority: Medium**
The `upload_to_clio: true` flag exists in the generate API and the `_upload_to_clio` background task is implemented. But the wizard always sends `upload_to_clio: false`. Add a toggle in the Review step ("Upload to Clio after generating: Yes / No").

### 6. Matter Type Filtering in Wizard
**Priority: Medium**
The `matter_type` column exists on `DocumentType` but the wizard shows all document types regardless of the matter's practice area. Filter the Documents step to only show types matching the matter's practice area (estate_planning, probate, etc.).

### 8. Joint Estate Support
**Priority: Low — depends on Hillary's templates**
The wizard has a `structure: "joint"` option and the DB supports `template_joint_*` variants, but no joint templates have been uploaded yet. Once Hillary provides joint/married versions of her templates, upload them via the document type manager and they'll resolve automatically.

### 9. Joint Estate Template Rollout
**Priority: Medium**
The wizard supports joint/married structure and the DB has `template_joint_*` slots, but no joint templates have been uploaded yet. Awaiting Hillary's joint document variants.

---

## Getting Back on Track

If the project drifts, these are the source-of-truth anchors:

1. **This README** — architecture, field mapping, template variable reference, backlog
2. **`backend/app/services/document_generator.py`** — canonical `build_context()`: all variables available to every template
3. **`backend/app/services/seed_document_types.py`** — canonical list of all document types and their template filenames
4. **`backend/app/services/seed_quill_fields.py`** — canonical list of all Quill-only variables
5. **`GET /docs`** — FastAPI interactive docs at http://localhost:8001/docs
6. **`GET /api/clio/fields`** — live dump of Hillary's Clio custom fields (requires connected account)
