import random
import string
from datetime import datetime, timedelta
from typing import Optional
from ..config import settings

# In-memory store: { email: {"otp": "123456", "expires_at": datetime, "company_id": int} }
# NOTE: this resets if the server restarts, and doesn't work across multiple
# server processes. Fine for a single-instance dev/small deployment; swap for
# Redis or a DB table if you scale to multiple backend instances.
_otp_store: dict[str, dict] = {}


def generate_otp(email: str, company_id: int) -> str:
    """Generate a 6-digit OTP, store it against the email, return the code."""
    code = "".join(random.choices(string.digits, k=6))
    _otp_store[email] = {
        "otp": code,
        "expires_at": datetime.utcnow() + timedelta(minutes=settings.OTP_EXPIRE_MINUTES),
        "company_id": company_id,
    }
    return code


def verify_otp(email: str, code: str) -> Optional[int]:
    """Check the OTP for this email. Returns company_id if valid, else None.
    Consumes the OTP on success (single use)."""
    record = _otp_store.get(email)
    if not record:
        return None
    if datetime.utcnow() > record["expires_at"]:
        _otp_store.pop(email, None)
        return None
    if record["otp"] != code:
        return None

    company_id = record["company_id"]
    _otp_store.pop(email, None)  # single use
    return company_id