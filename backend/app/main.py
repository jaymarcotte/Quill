import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base, SessionLocal
from app.api import auth, matters, contacts, documents, clio_fields, templates, document_types, fields
from app.models import document_type as _dt_model  # ensure model is registered
from app.models import quill_field as _qf_model    # ensure model is registered
from app.services.seed_document_types import seed_document_types
from app.services.seed_quill_fields import seed_quill_fields

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup (use Alembic for migrations in production)
    Base.metadata.create_all(bind=engine)
    # Seed document types if table is empty
    db = SessionLocal()
    try:
        seed_document_types(db)
        seed_quill_fields(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="Quill",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(matters.router, prefix="/api")
app.include_router(contacts.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(clio_fields.router, prefix="/api")
app.include_router(templates.router, prefix="/api")
app.include_router(document_types.router, prefix="/api")
app.include_router(fields.router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok", "app": "Quill v1"}
