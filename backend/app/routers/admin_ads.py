from fastapi import APIRouter, Depends
from app.auth import require_admin
from app.models import AdSlot
from app.services.settings_svc import get_site_settings, save_site_settings

router = APIRouter()

DEFAULT_SLOTS = [
    AdSlot(id="homepage_leaderboard", label="Homepage Leaderboard", description="728×90 below hero section"),
    AdSlot(id="article_inline_1", label="Article Inline 1", description="300×250 after paragraph 3"),
    AdSlot(id="article_inline_2", label="Article Inline 2", description="300×250 after paragraph 7"),
    AdSlot(id="article_sidebar", label="Article Sidebar", description="300×600 sticky sidebar desktop only"),
    AdSlot(id="category_banner", label="Category Banner", description="728×90 top of category pages"),
]


@router.get("/ads")
async def list_ads(_=Depends(require_admin)):
    s = await get_site_settings()
    if not s.ad_slots:
        return [slot.model_dump() for slot in DEFAULT_SLOTS]
    return s.ad_slots


@router.put("/ads/{slot_id}")
async def update_ad(slot_id: str, body: AdSlot, _=Depends(require_admin)):
    s = await get_site_settings()
    slots = s.ad_slots or [slot.model_dump() for slot in DEFAULT_SLOTS]
    idx = next((i for i, slot in enumerate(slots) if (slot.get("id") if isinstance(slot, dict) else slot.id) == slot_id), None)
    if idx is not None:
        slots[idx] = body.model_dump()
    else:
        slots.append(body.model_dump())
    s.ad_slots = slots
    await save_site_settings(s)
    return body
