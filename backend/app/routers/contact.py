from fastapi import APIRouter, HTTPException, Request
import time
from app.models import ContactRequest
from app.services.ses import send_contact_email

router = APIRouter()

# Simple in-memory rate limiter: {ip: last_submission_timestamp}
_rate_limit: dict[str, float] = {}
_RATE_LIMIT_SECONDS = 60


@router.post("/contact")
async def contact(body: ContactRequest, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    last = _rate_limit.get(client_ip, 0.0)
    if now - last < _RATE_LIMIT_SECONDS:
        retry_after = int(_RATE_LIMIT_SECONDS - (now - last))
        raise HTTPException(
            status_code=429,
            detail={"error": "Too many requests. Please wait before submitting again.", "retry_after": retry_after},
        )
    _rate_limit[client_ip] = now
    try:
        await send_contact_email(body.name, body.email, body.subject, body.message)
    except Exception:
        raise HTTPException(status_code=500, detail={"error": "Failed to send email", "code": "EMAIL_ERROR"})
    return {"success": True}
