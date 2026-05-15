from fastapi import APIRouter, Depends
from app.auth import require_admin
from app.models import SiteSettings
from app.services.settings_svc import get_site_settings, save_site_settings

router = APIRouter()


@router.get("/settings")
async def get_settings(_=Depends(require_admin)):
    return await get_site_settings()


@router.put("/settings")
async def update_settings(body: SiteSettings, _=Depends(require_admin)):
    await save_site_settings(body)
    return body


@router.get("/settings/public")
async def public_settings():
    return await get_site_settings()
