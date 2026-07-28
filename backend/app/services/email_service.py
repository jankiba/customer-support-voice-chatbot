import httpx
from ..config import settings

BREVO_URL = "https://api.brevo.com/v3/smtp/email"


def _send(to_email: str, subject: str, html_content: str, dev_fallback_note: str) -> None:
    """Shared Brevo send logic. Falls back to console logging if no API key
    is configured, or if the request fails, so the app never hard-crashes
    over an email provider issue."""
    if not settings.BREVO_API_KEY:
        print(f"\n[DEV] No BREVO_API_KEY set — {dev_fallback_note}\n")
        return

    payload = {
        "sender": {"name": settings.BREVO_SENDER_NAME, "email": settings.BREVO_SENDER_EMAIL},
        "to": [{"email": to_email}],
        "subject": subject,
        "htmlContent": html_content,
    }
    headers = {
        "api-key": settings.BREVO_API_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    try:
        response = httpx.post(BREVO_URL, json=payload, headers=headers, timeout=10)
        response.raise_for_status()
    except Exception as e:
        print(f"[WARN] Failed to send email to {to_email}: {e}")
        print(f"[DEV FALLBACK] {dev_fallback_note}")


def send_otp_email(to_email: str, otp: str) -> None:
    """Send a 2-step login OTP to an admin."""
    _send(
        to_email=to_email,
        subject="Your admin login code",
        html_content=f"""
            <p>Your one-time login code is:</p>
            <h2 style="letter-spacing: 4px;">{otp}</h2>
            <p>This code expires in {settings.OTP_EXPIRE_MINUTES} minutes. If you didn't request this, you can ignore this email.</p>
        """,
        dev_fallback_note=f"OTP for {to_email} is: {otp}",
    )


def send_escalation_email(to_email: str, company_name: str, question: str, session_id: str) -> None:
    """
    Notify the company's registered admin email when the chatbot couldn't
    confidently answer a customer's question and it's been escalated.
    """
    _send(
        to_email=to_email,
        subject=f"[{company_name}] A customer question needs your attention",
        html_content=f"""
            <p>Your support assistant couldn't confidently answer a customer's question and flagged it for you.</p>
            <p><strong>Question:</strong> {question}</p>
            <p><strong>Session:</strong> {session_id}</p>
            <p>You can review the full conversation in your admin dashboard under Tickets.</p>
        """,
        dev_fallback_note=f"Escalation email for {company_name} (session {session_id}): \"{question}\" would go to {to_email}",
    )