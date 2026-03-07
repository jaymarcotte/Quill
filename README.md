# MattersMore

> Legal document automation for estate planning practices — built on top of Clio Manage.

MattersMore is a wizard-driven document generation platform that connects to [Clio Manage](https://www.clio.com/) via OAuth, guides lawyers and legal assistants through structured questions, and produces properly formatted Word (.docx) and PDF estate planning documents — populated with client data and uploaded back to the Clio matter.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15 + shadcn/ui + TypeScript |
| Backend | FastAPI (Python) |
| Database | PostgreSQL |
| Documents | docxtpl (Jinja2 for Word) + LibreOffice PDF |
| AI | Claude / Ollama (pluggable) |
| Deployment | Docker Compose |

## Ports

| Service | Port |
|---|---|
| Backend API | 8001 |
| Frontend (dev) | 5174 |
| PostgreSQL | 5433 |

Ports chosen to avoid conflict with other services on the same host.

## Quick Start

```bash
# 1. Copy and fill in environment variables
cp .env.example .env

# 2. Start development stack
docker compose --profile dev up --build

# 3. Create first user (run once)
curl -X POST http://localhost:8001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"hillary@example.com","full_name":"Hillary Gagnon","password":"yourpassword","role":"lawyer"}'

# 4. Connect Clio account
# Visit: http://localhost:8001/api/auth/clio/connect
```

Frontend: http://localhost:5174
API docs: http://localhost:8001/docs

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

## Document Templates

Word templates live in `backend/app/templates_docx/`. Files prefixed with `__` are templates (the prefix keeps them sorted to the top in file explorers and visually flags them as templates).

Templates use [Jinja2](https://jinja.palletsprojects.com/) syntax for variables and conditionals:

- `{{ client_name }}` — simple substitution (inherits Word run formatting)
- `{% if is_female %}...{% endif %}` — conditional blocks
- `{% for beneficiary in beneficiaries %}...{% endfor %}` — repeating blocks

## Synology Deployment

```bash
# On Synology via SSH
git clone https://github.com/jaymarcotte/MattersMore.git
cd MattersMore
cp .env.example .env
# edit .env with production values
docker compose --profile prod up -d --build
```

Configure Nginx reverse proxy + Let's Encrypt in DSM > Login Portal > Reverse Proxy.
