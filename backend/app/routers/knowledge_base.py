import os
import shutil
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Company, Document
from ..schemas import DocumentOut
from ..auth import get_current_company
from ..config import settings
from ..services.document_processor import process_document
from ..services.faiss_service import add_chunks, reset_index

router = APIRouter(prefix="/knowledge-base", tags=["knowledge-base"])


def _company_dir(company_id: int) -> str:
    return os.path.join(settings.UPLOAD_DIR, str(company_id))


@router.post("/upload", response_model=DocumentOut)
def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_company: Company = Depends(get_current_company),
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    company_dir = _company_dir(current_company.id)
    os.makedirs(company_dir, exist_ok=True)
    file_path = os.path.join(company_dir, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    chunks = process_document(file_path)
    add_chunks(current_company.id, chunks)

    document = Document(
        company_id=current_company.id,
        filename=file.filename,
        chunk_count=len(chunks),
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    return document


@router.get("/documents", response_model=list[DocumentOut])
def list_documents(
    db: Session = Depends(get_db),
    current_company: Company = Depends(get_current_company),
):
    return db.query(Document).filter(Document.company_id == current_company.id).all()


@router.delete("/documents/{document_id}")
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_company: Company = Depends(get_current_company),
):
    document = (
        db.query(Document)
        .filter(Document.id == document_id, Document.company_id == current_company.id)
        .first()
    )
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    company_dir = _company_dir(current_company.id)
    deleted_file_path = os.path.join(company_dir, document.filename)

    db.delete(document)
    db.commit()
    if os.path.exists(deleted_file_path):
        os.remove(deleted_file_path)

    # Rebuild the FAISS index from whatever documents are left, since FAISS
    # doesn't support deleting individual vectors from a flat index in place.
    remaining_docs = db.query(Document).filter(Document.company_id == current_company.id).all()
    reset_index(current_company.id)
    for doc in remaining_docs:
        doc_path = os.path.join(company_dir, doc.filename)
        if os.path.exists(doc_path):
            chunks = process_document(doc_path)
            add_chunks(current_company.id, chunks)

    return {"status": "deleted", "id": document_id}