from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Company, Conversation, Ticket
from ..schemas import AnalyticsSummary, DailyCount
from ..auth import get_current_company

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/summary", response_model=AnalyticsSummary)
def get_summary(
    db: Session = Depends(get_db),
    current_company: Company = Depends(get_current_company),
):
    total_conversations = (
        db.query(func.count(Conversation.id))
        .filter(Conversation.company_id == current_company.id)
        .scalar()
    ) or 0

    total_escalations = (
        db.query(func.count(Ticket.id))
        .filter(Ticket.company_id == current_company.id)
        .scalar()
    ) or 0

    escalation_rate = round((total_escalations / total_conversations) * 100, 1) if total_conversations else 0.0

    since = datetime.utcnow() - timedelta(days=6)
    rows = (
        db.query(func.date(Conversation.created_at).label("day"), func.count(Conversation.id))
        .filter(Conversation.company_id == current_company.id, Conversation.created_at >= since)
        .group_by("day")
        .all()
    )
    counts_by_day = {str(day): count for day, count in rows}

    conversations_by_day = []
    for i in range(6, -1, -1):
        day = (datetime.utcnow() - timedelta(days=i)).date()
        conversations_by_day.append(DailyCount(date=str(day), count=counts_by_day.get(str(day), 0)))

    priority_rows = (
        db.query(Ticket.priority, func.count(Ticket.id))
        .filter(Ticket.company_id == current_company.id)
        .group_by(Ticket.priority)
        .all()
    )
    tickets_by_priority = {"high": 0, "medium": 0, "low": 0}
    for priority, count in priority_rows:
        key = priority.value if hasattr(priority, "value") else str(priority)
        tickets_by_priority[key] = count

    return AnalyticsSummary(
        total_conversations=total_conversations,
        total_escalations=total_escalations,
        escalation_rate=escalation_rate,
        conversations_by_day=conversations_by_day,
        tickets_by_priority=tickets_by_priority,
    )