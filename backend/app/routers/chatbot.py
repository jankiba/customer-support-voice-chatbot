import os
import shutil
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Company, Conversation, Ticket, TicketPriority
from ..schemas import ChatTextRequest, ChatResponse, ConversationOut, SuggestionOut
from ..config import settings
from ..services.faiss_service import search
from ..services.llm_service import generate_answer, needs_escalation, detect_frustration
from ..services.tts_service import text_to_speech
from ..services.stt_service import transcribe_audio
from ..services.email_service import send_escalation_email
from ..services.conversation_utils import extract_entities
from ..services.session_state import (
    get_entities,
    update_entities,
    is_awaiting_ticket_confirmation,
    set_awaiting_ticket_confirmation,
    get_pending_question,
)

router = APIRouter(prefix="/chat", tags=["chatbot"])

CONFIDENCE_ESCALATION_THRESHOLD = 50

AFFIRMATIVE = {"yes", "yeah", "yep", "sure", "please", "ok", "okay", "please do", "go ahead", "y", "correct"}
NEGATIVE = {"no", "nope", "not now", "no thanks", "n", "never mind", "nah"}


def _is_affirmative(text: str) -> bool:
    t = text.strip().lower().rstrip(".!")
    return t in AFFIRMATIVE or any(t.startswith(a) for a in AFFIRMATIVE)


def _is_negative(text: str) -> bool:
    t = text.strip().lower().rstrip(".!")
    return t in NEGATIVE or any(t.startswith(a) for a in NEGATIVE)


def _time_greeting() -> str:
    """Friendly, time-aware opener used for the first message of a session."""
    hour = datetime.now().hour
    if hour < 12:
        part_of_day = "good morning"
    elif hour < 17:
        part_of_day = "good afternoon"
    else:
        part_of_day = "good evening"
    return f"Hii there, {part_of_day}! How can I help you?"


GREETING_WORDS = {"hi", "hii", "hello", "hey", "yo", "hola", "greetings", "namaste"}
TIME_GREETINGS = {"good morning", "good afternoon", "good evening"}
GREETING_FILLER_WORDS = {"there", "friend", "team", "guys", "everyone", "again"}


def _is_smalltalk_greeting(text: str) -> bool:
    """
    True for plain greetings with no real question in them — e.g. 'hi',
    'hello', 'hi there', 'hey there', 'good morning'. Anything with real
    content after the greeting (e.g. 'hi, what are your hours') falls through
    to the normal pipeline.
    """
    t = text.strip().lower().strip("!.,? ")
    if not t:
        return False
    if t in TIME_GREETINGS:
        return True

    words = t.split()
    first_word = words[0]
    if first_word not in GREETING_WORDS:
        return False

    remainder = words[1:]
    return all(w in GREETING_FILLER_WORDS for w in remainder)


def _get_company_or_404(slug: str, db: Session) -> Company:
    company = db.query(Company).filter(Company.slug == slug).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


def _recent_history(db: Session, company_id: int, session_id: str) -> list[dict]:
    """Pull the last few turns of this session to give the LLM conversational context."""
    rows = (
        db.query(Conversation)
        .filter(Conversation.company_id == company_id, Conversation.session_id == session_id)
        .order_by(Conversation.created_at.desc())
        .limit(3)
        .all()
    )
    history = []
    for row in reversed(rows):
        history.append({"role": "user", "content": row.customer_question})
        history.append({"role": "assistant", "content": row.bot_answer})
    return history


def _save_and_respond(db, company, session_id, question, answer, escalated, want_audio, language) -> ChatResponse:
    convo = Conversation(
        company_id=company.id,
        session_id=session_id,
        customer_question=question,
        bot_answer=answer,
    )
    db.add(convo)
    db.commit()

    audio_url = None
    if want_audio:
        try:
            filename = text_to_speech(answer, language)
            audio_url = f"/audio/{filename}"
        except Exception as e:
            print(f"[WARN] Text-to-speech failed, continuing without audio: {e}")

    return ChatResponse(
        session_id=session_id,
        question=question,
        answer=answer,
        audio_url=audio_url,
        escalated=escalated,
    )


def _create_ticket_and_notify(db, company, session_id, question) -> str:
    ticket = Ticket(
        company_id=company.id,
        session_id=session_id,
        subject=question[:80],
        description=question,
        priority=TicketPriority.high,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    ticket_code = f"SUP-{10000 + ticket.id}"
    send_escalation_email(company.email, company.name, question, session_id)
    return ticket_code


def _handle_question(db: Session, company: Company, session_id: str, question: str,
                      want_audio: bool, language: str = "en") -> ChatResponse:
    if is_awaiting_ticket_confirmation(session_id):
        original_question = get_pending_question(session_id) or question
        set_awaiting_ticket_confirmation(session_id, False)

        if _is_affirmative(question):
            ticket_code = _create_ticket_and_notify(db, company, session_id, original_question)
            answer = (
                f"Ticket Created\n\nTicket ID: {ticket_code}\nStatus: Open\n"
                f"Estimated response: within 24 hours"
            )
            return _save_and_respond(db, company, session_id, question, answer, True, want_audio, language)

        elif _is_negative(question):
            answer = "No problem — let me know if there's anything else I can help with."
            return _save_and_respond(db, company, session_id, question, answer, False, want_audio, language)

    history = _recent_history(db, company.id, session_id)
    is_first_message = len(history) == 0

    # Plain greetings ("hi", "hello", "good morning"...) never go through the
    # knowledge-base search / confidence pipeline — there's nothing to look up,
    # so treating them as low-confidence just triggers a pointless "create a
    # ticket?" prompt. Answer them directly instead.
    if _is_smalltalk_greeting(question):
        answer = _time_greeting() if is_first_message else "Hey! How can I help you?"
        return _save_and_respond(db, company, session_id, question, answer, False, want_audio, language)

    update_entities(session_id, extract_entities(question))
    known_entities = get_entities(session_id)

    frustrated = detect_frustration(question)

    chunks = search(company.id, question)
    pre_escalate = needs_escalation(question, chunks)

    answer, confidence = generate_answer(
        company.name, question, chunks, history,
        language=language, known_entities=known_entities, frustrated=frustrated,
    )

    escalate = pre_escalate or confidence < CONFIDENCE_ESCALATION_THRESHOLD

    if escalate:
        set_awaiting_ticket_confirmation(session_id, True, question)
        answer = (
            answer.rstrip(".") + ". I'm not fully confident about that — "
            "would you like me to create a support ticket so a team member can follow up?"
        )

    if is_first_message and not frustrated and not answer.lower().startswith(("hi", "hii", "hello", "hey")):
        answer = f"{_time_greeting()} {answer}"

    return _save_and_respond(db, company, session_id, question, answer, escalate, want_audio, language)


@router.get("/{slug}/history", response_model=list[ConversationOut])
def chat_history(slug: str, session_id: str, db: Session = Depends(get_db)):
    """Let a returning customer see their own past messages in this session."""
    company = _get_company_or_404(slug, db)
    return (
        db.query(Conversation)
        .filter(Conversation.company_id == company.id, Conversation.session_id == session_id)
        .order_by(Conversation.created_at.asc())
        .all()
    )


@router.get("/{slug}/suggestions", response_model=list[SuggestionOut])
def chat_suggestions(slug: str, db: Session = Depends(get_db)):
    """
    Surface the most frequently asked questions for this company, so the
    customer sees live FAQ suggestions while typing — grounded in what real
    customers have actually asked, not a hand-authored list.
    """
    company = _get_company_or_404(slug, db)
    rows = (
        db.query(Conversation.customer_question, func.count(Conversation.id).label("cnt"))
        .filter(Conversation.company_id == company.id)
        .group_by(Conversation.customer_question)
        .order_by(func.count(Conversation.id).desc())
        .limit(8)
        .all()
    )
    return [SuggestionOut(question=q, count=c) for q, c in rows]


@router.post("/{slug}/text", response_model=ChatResponse)
def chat_text(slug: str, payload: ChatTextRequest, db: Session = Depends(get_db)):
    company = _get_company_or_404(slug, db)
    return _handle_question(
        db, company, payload.session_id, payload.message,
        want_audio=True, language=payload.language,
    )


@router.post("/{slug}/voice", response_model=ChatResponse)
def chat_voice(
    slug: str,
    session_id: str,
    audio: UploadFile = File(...),
    language: str = "en",
    db: Session = Depends(get_db),
):
    company = _get_company_or_404(slug, db)

    temp_path = os.path.join(settings.UPLOAD_DIR, f"tmp_{uuid.uuid4().hex}_{audio.filename}")
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(audio.file, buffer)

    try:
        question = transcribe_audio(temp_path)
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

    if not question:
        raise HTTPException(status_code=400, detail="Could not understand audio")

    return _handle_question(db, company, session_id, question, want_audio=True, language=language)
