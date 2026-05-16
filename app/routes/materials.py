import os
from pathlib import Path
import shutil
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlmodel import Session, select

from app.db import get_session
from app.models import Course, CourseMaterial
from app.schemas import RenameMaterialRequest

from app.services.material_service import save_extracted_text

router = APIRouter(prefix="/materials", tags=["Materials"])

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".pptx" }

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}

TEXT_DIR = Path("uploads/extracted_text")
TEXT_DIR.mkdir(parents=True, exist_ok=True)

@router.put("/rename")
def rename_material(data: RenameMaterialRequest, session: Session = Depends(get_session)):
    material = session.get(CourseMaterial, data.material_id)

    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    material.filename = data.new_name.strip()

    session.add(material)
    session.commit()
    session.refresh(material)

    return {"message": "Material renamed successfully"}

@router.post("/upload")
def upload_material(
    course_id: int = Form(...),
    file: UploadFile = File(...),
    session: Session = Depends(get_session)
):
    course = session.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if not file.filename:
        raise HTTPException(status_code=400, detail="No file selected")

    file_ext = Path(file.filename).suffix.lower()

    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Please upload a PDF, DOCX, or PPTX file.")

    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Invalid file type"
        )

    MAX_FILE_SIZE = 15 * 1024 * 1024  # 10 MB

    # Move pointer to end of file
    file.file.seek(0, 2)
    file_size = file.file.tell()

    # Reset pointer back to beginning
    file.file.seek(0)

    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
        status_code=400,
        detail=f"File too large (max {MAX_FILE_SIZE // (1024*1024)}MB)"    )

    unique_name = f"{uuid.uuid4()}{file_ext}"
    save_path = UPLOAD_DIR / unique_name

    with save_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        txt_file_path = save_extracted_text(str(save_path), TEXT_DIR)
    except Exception as e:
        if save_path.exists():
            save_path.unlink()
        raise HTTPException(status_code=400, detail=f"Text extraction failed: {str(e)}")

    material = CourseMaterial(
        course_id=course_id,
        filename=file.filename,
        file_path=str(save_path)
    )

    session.add(material)
    session.commit()
    session.refresh(material)

    return {
    "message": "Material uploaded successfully",
    "material": {
        "id": material.id,
        "course_id": material.course_id,
        "filename": material.filename,
        "file_path": material.file_path,
        "text_file_path": txt_file_path
    }
}


@router.get("/course/{course_id}")
def list_course_materials(course_id: int, session: Session = Depends(get_session)):
    materials = session.exec(
        select(CourseMaterial).where(CourseMaterial.course_id == course_id)
    ).all()

    return {
        "course_id": course_id,
        "materials": [
            {
                "id": m.id,
                "course_id": m.course_id,
                "filename": m.filename,
                "file_path": m.file_path,
                "text_file_path": str(TEXT_DIR / f"{Path(m.file_path).stem}.txt")
            }
            for m in materials
        ]
    }

@router.delete("/{material_id}")
def delete_material(material_id: int, session: Session = Depends(get_session)):
    material = session.get(CourseMaterial, material_id)

    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    # Delete uploaded file from folder if it exists
    if material.file_path:
        file_path = Path(material.file_path)
        if file_path.exists():
            file_path.unlink()

    session.delete(material)
    session.commit()

    return {
        "message": "Material deleted successfully",
        "material_id": material_id
    }