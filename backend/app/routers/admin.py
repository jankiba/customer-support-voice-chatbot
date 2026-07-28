import re
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Company, CompanyUser
from ..schemas import (
    CompanyRegister, CompanyLogin, CompanyOut, Token, OTPRequestResponse, OTPVerify,
    TeamInviteRequest, TeamMemberOut,
)
from ..auth import hash_password, verify_password, create_access_token, get_current_company
from ..services.otp_service import generate_otp, verify_otp
from ..services.email_service import send_otp_email

router = APIRouter(prefix="/admin", tags=["admin"])


def slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug


def _find_login_match(email: str, password: str, db: Session):
    """Check the owner account first, then invited team members.
    Returns the Company row on success, or None."""
    company = db.query(Company).filter(Company.email == email).first()
    if company and verify_password(password, company.hashed_password):
        return company

    member = db.query(CompanyUser).filter(CompanyUser.email == email).first()
    if member and verify_password(password, member.hashed_password):
        return db.query(Company).filter(Company.id == member.company_id).first()

    return None


def _email_exists_anywhere(email: str, db: Session) -> bool:
    return (
        db.query(Company).filter(Company.email == email).first() is not None
        or db.query(CompanyUser).filter(CompanyUser.email == email).first() is not None
    )


@router.post("/register", response_model=CompanyOut)
def register(payload: CompanyRegister, db: Session = Depends(get_db)):
    if _email_exists_anywhere(payload.email, db):
        raise HTTPException(status_code=400, detail="Email already registered")

    base_slug = slugify(payload.name)
    slug = base_slug
    counter = 1
    while db.query(Company).filter(Company.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    company = Company(
        name=payload.name,
        slug=slug,
        email=payload.email,
        hashed_password=hash_password(payload.password),
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


@router.post("/login", response_model=OTPRequestResponse)
def login(payload: CompanyLogin, db: Session = Depends(get_db)):
    """
    Step 1 of login: verify email + password against either the owner
    account or an invited team member. On success, generate a 6-digit OTP,
    email it to whichever address was used to log in, and return a pending
    state (no token yet).
    """
    company = _find_login_match(payload.email, payload.password, db)
    if not company:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    otp = generate_otp(payload.email, company.id)
    send_otp_email(payload.email, otp)

    return OTPRequestResponse(message="OTP sent to your email", email=payload.email)


@router.post("/verify-otp", response_model=Token)
def verify_login_otp(payload: OTPVerify, db: Session = Depends(get_db)):
    """
    Step 2 of login: verify the OTP that was emailed in step 1.
    On success, issue the real JWT access token.
    """
    company_id = verify_otp(payload.email, payload.otp)
    if company_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired code")

    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Account not found")

    token = create_access_token({"company_id": company.id})
    return Token(access_token=token)


@router.post("/resend-otp", response_model=OTPRequestResponse)
def resend_otp(payload: dict, db: Session = Depends(get_db)):
    """Resend a fresh OTP to an email that already passed step 1 recently."""
    email = payload.get("email")

    company = db.query(Company).filter(Company.email == email).first()
    if not company:
        member = db.query(CompanyUser).filter(CompanyUser.email == email).first()
        if member:
            company = db.query(Company).filter(Company.id == member.company_id).first()

    if not company:
        raise HTTPException(status_code=404, detail="Account not found")

    otp = generate_otp(email, company.id)
    send_otp_email(email, otp)
    return OTPRequestResponse(message="OTP resent", email=email)


@router.get("/me", response_model=CompanyOut)
def get_me(current_company: Company = Depends(get_current_company)):
    return current_company


# ---------- Team management ----------

@router.get("/team", response_model=list[TeamMemberOut])
def list_team(db: Session = Depends(get_db), current_company: Company = Depends(get_current_company)):
    members = [TeamMemberOut(id=0, email=current_company.email, role="owner", created_at=None)]
    for m in db.query(CompanyUser).filter(CompanyUser.company_id == current_company.id).all():
        members.append(TeamMemberOut(id=m.id, email=m.email, role="member", created_at=m.created_at))
    return members


@router.post("/team", response_model=TeamMemberOut)
def invite_team_member(
    payload: TeamInviteRequest,
    db: Session = Depends(get_db),
    current_company: Company = Depends(get_current_company),
):
    if _email_exists_anywhere(payload.email, db):
        raise HTTPException(status_code=400, detail="That email is already registered")

    member = CompanyUser(
        company_id=current_company.id,
        email=payload.email,
        hashed_password=hash_password(payload.password),
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return TeamMemberOut(id=member.id, email=member.email, role="member", created_at=member.created_at)


@router.delete("/team/{member_id}")
def remove_team_member(
    member_id: int,
    db: Session = Depends(get_db),
    current_company: Company = Depends(get_current_company),
):
    member = (
        db.query(CompanyUser)
        .filter(CompanyUser.id == member_id, CompanyUser.company_id == current_company.id)
        .first()
    )
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")

    db.delete(member)
    db.commit()
    return {"status": "removed", "id": member_id}