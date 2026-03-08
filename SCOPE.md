# Quill — Rolling Scope of Work

> This document is the authoritative product vision and build order for Quill.
> It is updated after every completed feature. The README.md is the technical reference.
> Together they are the handoff document for any developer picking this up.

**Last updated:** 2026-03-08
**Current phase:** Phase 1 — Core Estate Planning MVP

---

## 1. Project Summary

Quill is a document automation system for an estate planning law firm. It uses Clio Manage as the primary source of truth, supplements it with structured wizard inputs where Clio is insufficient, and generates attorney-ready Word and PDF documents while preserving all Microsoft Word formatting.

---

## 2. Business Goal

A lawyer or staff user should be able to:

1. Start from a Clio matter
2. Identify the matter type
3. Pull core client, matter, and contact data from Clio automatically
4. Answer only what Clio does not already know
5. Select documents to generate
6. Assign contacts to roles within each document
7. Apply optional clauses and conditional text
8. Preview a review summary
9. Generate Word (.docx) and PDF files with minimal post-generation editing
10. Optionally upload finalized documents back to the Clio matter folder

---

## 3. Core Design Decisions (Non-Negotiable)

| Decision | Rationale |
|---|---|
| **Word stays the template editor** | Complex legal formatting — headers, footers, numbering, tables — cannot survive a browser round-trip. Word owns layout. |
| **Quill is an orchestration layer** | Quill fills gaps, runs the wizard, and merges data. It does not replace Word or Clio. |
| **Clio is the source of truth for legal data** | If a field is reusable across matters, it belongs in Clio. |
| **Quill holds only ephemeral or document-specific data** | Wizard answers, role assignments, optional clauses, pricing selections. |
| **No drag-and-drop browser document editor** | Damages formatting fidelity on complex legal documents. |

---

## 4. Phase Plan

### Phase 1 — Core Estate Planning MVP
**Goal:** Staff can open a Clio matter, answer a short wizard, and generate all standard estate planning documents with minimal manual editing afterward.

### Phase 2 — Template and Admin Self-Service
**Goal:** Hillary or Sheryl can manage templates, view field references, and update firm settings without a developer.

### Phase 3 — Clio Sync Maturity
**Goal:** Generated documents upload to Clio. Structured answers write back to Clio where appropriate. Auto-population improves.

### Phase 4 — Advanced Usability
**Goal:** Joint-estate completion, conditional clause library, better preview, reporting.

---

## 5. Build Order (Current Priority)

Work through these in sequence. Check off each when complete and update README backlog.

### Phase 1

- [x] Clio OAuth connect
- [x] Matter browser
- [x] Multi-step wizard scaffold (Setup, Documents, Trust, Living Will, Review)
- [x] DB-driven document types with per-variant template resolution
- [x] Word generation via docxtpl + LibreOffice PDF conversion
- [x] Document download (docx + pdf)
- [x] Firm rate schedule in Settings (5 named rates)
- [x] Fee step in wizard when Engagement Letter selected
- [x] `attorney_rate`, `rate_type`, `rate_description` template variables
- [ ] **NEXT: Clio auto-populate** — read `custom_field_values` already on the matter and fill wizard state automatically (trust_name, structure, is_female, document checkboxes, agents, trustees)
- [ ] Matter-type-first wizard entry — select Estate Planning / Probate / etc. before Setup
- [ ] Expanded pronoun model — She/Her, He/Him, They/Them, and how they affect template grammar
- [ ] Wizard: HC POA step — inputs for hc_agent_1, hc_agent_2, hc_agent_structure
- [ ] Wizard: General POA step — inputs for poa_agent_1a, poa_agent_1b, poa_andor, poa_agent_2, poa_agent_3
- [ ] Wizard: Trust trustees step — trustee_1, trustee_2, trustee_structure, trustee_2a/2b
- [ ] Wizard: Trust beneficiaries step — child_1/2/3, beneficiaries list
- [ ] Wizard: Closing Letter step — has_brokerage, has_llc, has_special_warranty_deed, other_account_name
- [ ] Contact-role assignment — assign matter contacts to per-document roles (trustee, agent, beneficiary, spouse, child)
- [ ] Upload-to-Clio toggle in Review step (already in backend, just needs UI)

### Phase 2

- [ ] Document type manager UI — upload/download templates per variant from the UI (backend done)
- [ ] Field reference panel — all `{{ variable }}` with copy-to-clipboard for Hillary editing templates in Word
- [ ] Matter-type filtering — wizard Documents step only shows types matching the matter's practice area

### Phase 3

- [ ] Upload-to-Clio fully tested and enabled
- [ ] Write structured answers back to Clio custom fields where appropriate
- [ ] Improved Clio auto-population (contact pronoun field, judicial officer, etc.)

### Phase 4

- [ ] Joint estate template rollout (married templates uploaded and tested)
- [ ] Conditional clause library (reusable optional text blocks)
- [ ] Audit trail of generated documents
- [ ] Better preview (rendered summary, not full Word preview)

---

## 6. Data Model — What Lives Where

### Clio (source of truth for legal data)

| Data | Clio Location |
|---|---|
| Matter identity, number, status | Matter standard fields |
| Primary client name, address, contact | Contact standard fields |
| Matter practice area | Matter standard field |
| Trust name | Custom field 14358376 |
| Estate structure (single/joint) | Custom field 15902438 |
| Pronoun / he/she | Custom field 14358646 |
| Client 2 / spouse | Custom fields 5315491, 14358211, 15903653 |
| Document selection checkboxes | Custom fields 15903668–15903833 |
| HC agent structure | Custom field 14078733 |
| POA agents | Custom fields 14759332, 14759377, 13845063, 13845093 |
| Trustees | Custom field 14759662 |
| Children | Custom fields 14078358, 14078583 |

### Quill (wizard-session and firm config)

| Data | Location |
|---|---|
| Firm rate schedule | `firm_settings` table |
| Document types + template assignments | `document_type` table |
| Quill field definitions | `quill_field` table |
| Generated document job history | `document_job` table |
| Per-session wizard answers not in Clio | wizard_data JSON on document_job |

---

## 7. Template Variable Reference (Quick Summary)

All variables available in every template. Full reference in README.md.

| Category | Key Variables |
|---|---|
| Client | `client_name`, `client_first_name`, `client_last_name`, `client_prefix`, `client_email`, `client_address` |
| Joint | `is_female`, `husband_name`, `wife_name` |
| Trust | `trust_name`, `trustee_1`, `trustee_2`, `trustee_structure`, `child_1`, `child_2`, `child_3`, `beneficiaries` |
| HC POA | `hc_agent_1`, `hc_agent_2`, `hc_agent_structure` |
| General POA | `poa_agent_1a`, `poa_agent_1b`, `poa_andor`, `poa_agent_2`, `poa_agent_3` |
| Living Will | `is_female`, `include_pregnancy_clause` |
| Closing | `has_brokerage`, `has_llc`, `has_special_warranty_deed`, `selected_documents` |
| Engagement | `attorney_rate`, `rate_type`, `rate_description` |
| System | `date_verbose`, `date_year` |

---

## 8. Open Questions (Needs Hillary Input)

These must be answered before certain features can be built:

1. **Pronoun model** — Beyond She/Her and He/Him: does "They/Them" require different legal grammar in templates? Which specific pronouns in the documents change (he/she/they, his/her/their, himself/herself/themselves)?
2. **Pregnancy clause** — Is this driven by biological sex, pronoun selection, or a separate explicit legal-status question?
3. **Contact roles per document** — Which roles apply to which document types? E.g. does a Trustee role assignment apply to Trust + Certificate of Trust + Pourover Will all at once, or independently?
4. **Role reuse** — If someone is assigned as Trustee for one matter, should that assignment be saved and suggested for the next similar matter?
5. **Joint matter templates** — Which documents have married/joint variants? Are they separate files or does one template handle both with conditionals?
6. **Matter type list** — Is the full list: Estate Planning, Probate, Guardianship/Conservatorship, Trust Administration? Any others?
7. **Document preview** — Is a review summary (current) sufficient for Phase 1, or does Hillary need to see a rendered document preview before generating?
8. **Clio upload timing** — Upload immediately after generation, or as a separate manual action from the Documents page?

---

## 9. Acceptance Criteria for Phase 1

Phase 1 is complete when a staff user can:

- [ ] Open a Clio matter
- [ ] Have estate structure, trust name, pronouns, and document selection pre-filled from Clio
- [ ] Confirm or adjust single/joint and pronoun settings
- [ ] Add and manage matter contacts
- [ ] Select one or more documents
- [ ] Enter required data for each selected document (agents, trustees, beneficiaries)
- [ ] Select a fee structure when generating an Engagement Letter
- [ ] Review a complete summary of all selections
- [ ] Generate attorney-ready DOCX and PDF files
- [ ] Make minimal or no manual edits for standard single-estate cases

---

## 10. Development Conventions

- **After every completed feature:** update README.md backlog checkboxes + this SCOPE.md checklist, then `git add -A && git commit && git push`
- **Template files:** live in `backend/app/templates_docx/`, mounted live into Docker — edits take effect without rebuild
- **New DB columns:** handled by SQLAlchemy `create_all` on startup (no Alembic yet — add Alembic before production)
- **No emojis** in UI unless explicitly requested
- **Slate color palette** throughout frontend
- **Read files before editing** — never assume structure
