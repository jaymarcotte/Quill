"""
Document type configuration API.
Allows Hillary to manage document types: add, edit, reorder, assign templates.
"""
import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.models.document_type import DocumentType
from app.models.user import User
from app.api.auth import get_current_user
from app.config import get_settings

router = APIRouter(prefix="/document-types", tags=["document-types"])
settings = get_settings()


class DocumentTypeCreate(BaseModel):
    label: str
    wizard_key: str
    clio_field_id: Optional[int] = None
    template_default: Optional[str] = None
    template_single_male: Optional[str] = None
    template_single_female: Optional[str] = None
    template_joint_male: Optional[str] = None
    template_joint_female: Optional[str] = None
    sort_order: int = 100
    active: bool = True


class DocumentTypeUpdate(BaseModel):
    label: Optional[str] = None
    clio_field_id: Optional[int] = None
    sort_order: Optional[int] = None
    active: Optional[bool] = None


class ReorderItem(BaseModel):
    id: int
    sort_order: int


def _serialize(dt: DocumentType) -> dict:
    return {
        "id": dt.id,
        "label": dt.label,
        "wizard_key": dt.wizard_key,
        "clio_field_id": dt.clio_field_id,
        "template_default": dt.template_default,
        "template_single_male": dt.template_single_male,
        "template_single_female": dt.template_single_female,
        "template_joint_male": dt.template_joint_male,
        "template_joint_female": dt.template_joint_female,
        "sort_order": dt.sort_order,
        "active": dt.active,
        # Which variants have templates on disk
        "has_template": any([
            dt.template_default and os.path.exists(os.path.join(settings.templates_dir, dt.template_default)),
            dt.template_single_male and os.path.exists(os.path.join(settings.templates_dir, dt.template_single_male)),
            dt.template_single_female and os.path.exists(os.path.join(settings.templates_dir, dt.template_single_female)),
        ]),
    }


@router.get("")
async def list_document_types(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    types = db.query(DocumentType).order_by(DocumentType.sort_order, DocumentType.id).all()
    return {"data": [_serialize(t) for t in types]}


@router.post("")
async def create_document_type(
    body: DocumentTypeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = db.query(DocumentType).filter(DocumentType.wizard_key == body.wizard_key).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"wizard_key '{body.wizard_key}' already exists")
    dt = DocumentType(**body.model_dump())
    db.add(dt)
    db.commit()
    db.refresh(dt)
    return {"data": _serialize(dt)}


@router.patch("/{dt_id}")
async def update_document_type(
    dt_id: int,
    body: DocumentTypeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dt = db.get(DocumentType, dt_id)
    if not dt:
        raise HTTPException(status_code=404, detail="Document type not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(dt, field, value)
    db.commit()
    db.refresh(dt)
    return {"data": _serialize(dt)}


@router.post("/reorder")
async def reorder_document_types(
    items: list[ReorderItem],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    for item in items:
        dt = db.get(DocumentType, item.id)
        if dt:
            dt.sort_order = item.sort_order
    db.commit()
    return {"status": "ok"}


@router.delete("/{dt_id}")
async def delete_document_type(
    dt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dt = db.get(DocumentType, dt_id)
    if not dt:
        raise HTTPException(status_code=404, detail="Document type not found")
    db.delete(dt)
    db.commit()
    return {"status": "ok"}


@router.post("/{dt_id}/upload/{variant}")
async def upload_template_for_type(
    dt_id: int,
    variant: str,  # default | single_male | single_female | joint_male | joint_female
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a .docx template for a specific document type variant."""
    dt = db.get(DocumentType, dt_id)
    if not dt:
        raise HTTPException(status_code=404, detail="Document type not found")
    if not file.filename or not file.filename.endswith(".docx"):
        raise HTTPException(status_code=400, detail="Must be a .docx file")

    valid_variants = {"default", "single_male", "single_female", "joint_male", "joint_female"}
    if variant not in valid_variants:
        raise HTTPException(status_code=400, detail=f"variant must be one of {valid_variants}")

    # Build a clean filename: wizard_key_variant.docx
    filename = f"{dt.wizard_key}_{variant}.docx"
    path = os.path.join(settings.templates_dir, filename)
    content = await file.read()
    with open(path, "wb") as f:
        f.write(content)

    # Update the DB record
    setattr(dt, f"template_{variant}", filename)
    db.commit()

    return {"status": "ok", "filename": filename, "size_kb": round(len(content) / 1024, 1)}


@router.get("/{dt_id}/download/{variant}")
async def download_template_for_type(
    dt_id: int,
    variant: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dt = db.get(DocumentType, dt_id)
    if not dt:
        raise HTTPException(status_code=404, detail="Document type not found")

    filename = getattr(dt, f"template_{variant}", None)
    if not filename:
        raise HTTPException(status_code=404, detail="No template assigned for this variant")

    path = os.path.join(settings.templates_dir, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Template file not found on disk")

    return FileResponse(
        path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=filename,
    )
