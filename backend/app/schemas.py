from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional


# ---------- Auth / Company ----------
class CompanyRegister(BaseModel):
    name: str
    email: EmailStr
    password: str


class CompanyLogin(BaseModel):
    email: EmailStr
    password: str
    
class OTPRequestResponse(BaseModel):
    message: str
    email: EmailStr


class OTPVerify(BaseModel):
    email: EmailStr
    otp: str


class CompanyOut(BaseModel):
    id: int
    name: str
    slug: str
    email: EmailStr

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

# ---------- Team ----------
class TeamInviteRequest(BaseModel):
    email: EmailStr
    password: str


class TeamMemberOut(BaseModel):
    id: int
    email: EmailStr
    role: str  # "owner" | "member"
    created_at: Optional[datetime] = None


# ---------- Analytics ----------
class DailyCount(BaseModel):
    date: str
    count: int


class AnalyticsSummary(BaseModel):
    total_conversations: int
    total_escalations: int
    escalation_rate: float
    conversations_by_day: list[DailyCount]
    tickets_by_priority: dict[str, int]


# ---------- FAQ suggestions ----------
class SuggestionOut(BaseModel):
    question: str
    count: int


# ---------- Documents ----------
class DocumentOut(BaseModel):
    id: int
    filename: str
    chunk_count: int
    uploaded_at: datetime

    class Config:
        from_attributes = True


# ---------- Chat ----------
class ChatTextRequest(BaseModel):
    session_id: str
    message: str
    language: str = "en"  # "en" | "hi" | "gu"


class ChatResponse(BaseModel):
    session_id: str
    question: str
    answer: str
    audio_url: Optional[str] = None
    escalated: bool = False


# ---------- Conversations ----------
class ConversationOut(BaseModel):
    id: int
    session_id: str
    customer_question: str
    bot_answer: str
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Tickets ----------
class TicketOut(BaseModel):
    id: int
    session_id: str
    subject: str
    description: str
    priority: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
