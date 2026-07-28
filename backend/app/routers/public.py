import re
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Company, Document

router = APIRouter(prefix="/companies", tags=["public"])


def _slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


@router.get("/resolve")
def resolve_company(name: str, db: Session = Depends(get_db)):
    """
    Let a customer type a plain company name (e.g. "insurance") and find the
    right chatbot, even if the exact slug got an auto-incremented suffix
    (e.g. "insurance-1") because another company registered with the same
    name first.

    When multiple companies match, prefer whichever one actually has
    documents uploaded -- an empty/abandoned duplicate account shouldn't win
    over the one that's actually been set up, even if it's older.
    """
    clean = _slugify(name)
    if not clean:
        raise HTTPException(status_code=404, detail="No company found with that name")

    candidates = (
        db.query(Company)
        .filter(or_(Company.slug == clean, Company.slug.like(f"{clean}-%")))
        .all()
    )
    if not candidates:
        raise HTTPException(status_code=404, detail="No company found with that name")

    if len(candidates) == 1:
        company = candidates[0]
    else:
        doc_counts = dict(
            db.query(Document.company_id, func.count(Document.id))
            .filter(Document.company_id.in_([c.id for c in candidates]))
            .group_by(Document.company_id)
            .all()
        )
        candidates.sort(key=lambda c: (-doc_counts.get(c.id, 0), c.id))
        company = candidates[0]

    return {"slug": company.slug, "name": company.name}