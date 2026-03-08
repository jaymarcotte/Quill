"""Template management API — list, download, and replace .docx templates."""
import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from app.api.auth import get_current_user
from app.models.user import User
from app.services.document_generator import TEMPLATE_MAP
from app.config import get_settings

router = APIRouter(prefix="/templates", tags=["templates"])
settings = get_settings()


@router.get("")
async def list_templates(current_user: User = Depends(get_current_user)):
    """List all templates with file metadata."""
    result = []
    for key, filename in TEMPLATE_MAP.items():
        path = os.path.join(settings.templates_dir, filename)
        exists = os.path.exists(path)
        result.append({
            "key": key,
            "filename": filename,
            "exists": exists,
            "size_kb": round(os.path.getsize(path) / 1024, 1) if exists else None,
            "modified": os.path.getmtime(path) if exists else None,
        })
    return {"data": result}


@router.get("/{key}/download")
async def download_template(key: str, current_user: User = Depends(get_current_user)):
    filename = TEMPLATE_MAP.get(key)
    if not filename:
        raise HTTPException(status_code=404, detail="Unknown template key")
    path = os.path.join(settings.templates_dir, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Template file not found on disk")
    return FileResponse(
        path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=filename,
    )


@router.post("/{key}/upload")
async def upload_template(
    key: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    filename = TEMPLATE_MAP.get(key)
    if not filename:
        raise HTTPException(status_code=404, detail="Unknown template key")
    if not file.filename or not file.filename.endswith(".docx"):
        raise HTTPException(status_code=400, detail="Must be a .docx file")
    path = os.path.join(settings.templates_dir, filename)
    content = await file.read()
    with open(path, "wb") as f:
        f.write(content)
    return {"status": "ok", "filename": filename, "size_kb": round(len(content) / 1024, 1)}
