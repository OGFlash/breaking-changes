from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from app.config import settings
import httpx

router = APIRouter()


class SubscribeRequest(BaseModel):
    email: EmailStr


@router.post("/newsletter/subscribe")
async def subscribe(body: SubscribeRequest):
    """Subscribe an email to Beehiiv."""
    pub_id = settings.BEEHIIV_PUBLICATION_ID
    if not pub_id:
        raise HTTPException(status_code=503, detail="Newsletter not configured")

    headers = {}
    if settings.BEEHIIV_API_KEY:
        # Authenticated V2 API
        headers["Authorization"] = f"Bearer {settings.BEEHIIV_API_KEY}"
        url = f"https://api.beehiiv.com/v2/publications/{pub_id}/subscriptions"
        payload = {"email": body.email, "reactivate_existing": True, "send_welcome_email": True}
    else:
        # Unauthenticated public subscribe endpoint (form-compatible)
        url = "https://app.beehiiv.com/subscribe"
        payload = {"email": body.email, "publication_id": pub_id}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(url, json=payload, headers=headers)

        if r.status_code in (200, 201):
            return {"status": "subscribed"}
        # 400 can mean already subscribed — treat as success
        if r.status_code == 400:
            return {"status": "already_subscribed"}
        raise HTTPException(status_code=502, detail="Subscription failed")
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Newsletter service timed out")
