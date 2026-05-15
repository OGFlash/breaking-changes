from fastapi import APIRouter, HTTPException
from passlib.context import CryptContext
from app.models import LoginRequest, TokenResponse
from app.auth import create_token
from app.config import settings

router = APIRouter()

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _check_password(plain: str, stored: str) -> bool:
    """Accept either a bcrypt hash (starts with $2) or a plain-text value for dev."""
    if stored.startswith("$2"):
        return _pwd_context.verify(plain, stored)
    return plain == stored


@router.post("/auth/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    if not _check_password(body.password, settings.ADMIN_PASSWORD):
        raise HTTPException(status_code=401, detail={"error": "Invalid password", "code": "AUTH_FAILED"})
    token, expires = create_token()
    return TokenResponse(token=token, expires_at=expires)
