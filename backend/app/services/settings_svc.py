from __future__ import annotations
from app.config import settings
from app.services import s3
from app.models import SiteSettings
import json

_cached: SiteSettings | None = None


async def get_site_settings() -> SiteSettings:
    global _cached
    try:
        data = await s3.get_json(settings.CONTENT_BUCKET, "meta/settings.json")
        _cached = SiteSettings(**data)
    except Exception:
        if _cached is None:
            _cached = SiteSettings()
    return _cached


async def get_site_settings_cached() -> SiteSettings:
    """Return cached settings without hitting S3 (used inside index builder)."""
    global _cached
    if _cached is None:
        return SiteSettings()
    return _cached


async def save_site_settings(s: SiteSettings) -> None:
    global _cached
    _cached = s
    await s3.put_json(settings.CONTENT_BUCKET, "meta/settings.json", s.model_dump(), "max-age=300")
