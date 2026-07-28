from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Company, Ticket, Conversation
from ..schemas import TicketOut, ConversationOut
from ..auth import get_current_company

router = APIRouter(tags=["dashboard"])


@router.get("/tickets", response_model=list[TicketOut])
def list_tickets(
    db: Session = Depends(get_db),
    current_company: Company = Depends(get_current_company),
):
    return (
        db.query(Ticket)
        .filter(Ticket.company_id == current_company.id)
        .order_by(Ticket.created_at.desc())
        .all()
    )


@router.get("/conversations", response_model=list[ConversationOut])
def list_conversations(
    db: Session = Depends(get_db),
    current_company: Company = Depends(get_current_company),
):
    return (
        db.query(Conversation)
        .filter(Conversation.company_id == current_company.id)
        .order_by(Conversation.created_at.desc())
        .limit(200)
        .all()
    )