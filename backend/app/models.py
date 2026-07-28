from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from .database import Base


class TicketStatus(str, enum.Enum):
    open = "open"
    in_progress = "in_progress"
    closed = "closed"


class TicketPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"


class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    documents = relationship("Document", back_populates="company", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="company", cascade="all, delete-orphan")
    tickets = relationship("Ticket", back_populates="company", cascade="all, delete-orphan")
    team_members = relationship("CompanyUser", back_populates="company", cascade="all, delete-orphan")


class CompanyUser(Base):
    """Additional team members under a company account, beyond the original
    owner (whose credentials live directly on Company). Kept as a separate
    table so existing owner accounts are unaffected."""
    __tablename__ = "company_users"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    email = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    company = relationship("Company", back_populates="team_members")


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    filename = Column(String, nullable=False)
    chunk_count = Column(Integer, default=0)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    company = relationship("Company", back_populates="documents")


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    session_id = Column(String, index=True, nullable=False)
    customer_question = Column(Text, nullable=False)
    bot_answer = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    company = relationship("Company", back_populates="conversations")


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    session_id = Column(String, index=True, nullable=False)
    subject = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    priority = Column(Enum(TicketPriority), default=TicketPriority.medium)
    status = Column(Enum(TicketStatus), default=TicketStatus.open)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    company = relationship("Company", back_populates="tickets")