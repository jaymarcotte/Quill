import os
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.document_job import DocumentJob
from app.models.user import User
from app.services.document_generator import generate_docx, convert_to_pdf, TEMPLATE_MAP
from app.services.clio import ClioClient
from app.api.auth import get_current_user, get_current_user_clio_client

router = APIRouter(prefix="/documents", tags=["documents"])


class GenerateRequest(BaseModel):
    matter_id: int
    matter_label: str
    document_type: str
    wizard_data: dict
    generate_pdf: bool = True
    upload_to_clio: bool = False


@router.get("/types")
async def list_document_types():
    """Return all available document types."""
    return {"data": list(TEMPLATE_MAP.keys())}


@router.post("/generate")
async def generate_document(
    req: GenerateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    clio: ClioClient = Depends(get_current_user_clio_client),
):
    # Build output filename
    safe_label = req.matter_label.replace("/", "-").replace(" ", "_")[:50]
    base_name = f"{req.matter_id}_{req.document_type}_{safe_label}"
    docx_filename = f"{base_name}.docx"

    try:
        docx_path = generate_docx(req.document_type, req.wizard_data, docx_filename)
    except (ValueError, FileNotFoundError) as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Create DB record
    job = DocumentJob(
        user_id=current_user.id,
        clio_matter_id=req.matter_id,
        clio_matter_label=req.matter_label,
        document_type=req.document_type,
        wizard_data=req.wizard_data,
        docx_path=docx_path,
        status="generated",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    pdf_path = None
    if req.generate_pdf:
        try:
            pdf_path = convert_to_pdf(docx_path)
            job.pdf_path = pdf_path
            db.commit()
        except RuntimeError as e:
            # PDF conversion is best-effort — don't fail the whole request
            pass

    if req.upload_to_clio and pdf_path:
        background_tasks.add_task(
            _upload_to_clio, job.id, pdf_path, db, clio
        )

    return {
        "job_id": job.id,
        "docx_path": docx_path,
        "pdf_path": pdf_path,
        "status": job.status,
    }


@router.get("/{job_id}/download/docx")
async def download_docx(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = db.get(DocumentJob, job_id)
    if not job or job.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found")
    if not job.docx_path or not os.path.exists(job.docx_path):
        raise HTTPException(status_code=404, detail="File not found on disk")
    return FileResponse(
        job.docx_path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=os.path.basename(job.docx_path),
    )


@router.get("/{job_id}/download/pdf")
async def download_pdf(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = db.get(DocumentJob, job_id)
    if not job or job.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found")
    if not job.pdf_path or not os.path.exists(job.pdf_path):
        raise HTTPException(status_code=404, detail="PDF not found")
    return FileResponse(
        job.pdf_path,
        media_type="application/pdf",
        filename=os.path.basename(job.pdf_path),
    )


@router.get("")
async def list_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    jobs = db.query(DocumentJob).filter(DocumentJob.user_id == current_user.id).order_by(
        DocumentJob.created_at.desc()
    ).limit(50).all()
    return {"data": [
        {
            "id": j.id,
            "matter_label": j.clio_matter_label,
            "document_type": j.document_type,
            "status": j.status,
            "created_at": j.created_at.isoformat(),
            "has_pdf": bool(j.pdf_path),
        }
        for j in jobs
    ]}


async def _upload_to_clio(job_id: int, pdf_path: str, db: Session, clio: ClioClient):
    job = db.get(DocumentJob, job_id)
    if not job:
        return
    with open(pdf_path, "rb") as f:
        file_bytes = f.read()
    filename = os.path.basename(pdf_path)
    result = await clio.upload_document(
        job.clio_matter_id, file_bytes, filename, "application/pdf"
    )
    if result:
        from datetime import datetime, timezone
        job.clio_document_id = result.get("id")
        job.clio_uploaded_at = datetime.now(timezone.utc)
        job.status = "uploaded"
        db.commit()
