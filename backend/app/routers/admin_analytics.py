from fastapi import APIRouter, Depends
from app.auth import require_admin
from app.config import settings
from app.services import s3, dynamodb
from datetime import date, timedelta
import httpx

router = APIRouter()


async def _get_beehiiv_subscriber_count() -> int | None:
    """Fetch total subscriber count from Beehiiv V2 API."""
    if not settings.BEEHIIV_API_KEY or not settings.BEEHIIV_PUBLICATION_ID:
        return None
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.get(
                f"https://api.beehiiv.com/v2/publications/{settings.BEEHIIV_PUBLICATION_ID}/subscriptions",
                params={"status": "active", "limit": 1},
                headers={"Authorization": f"Bearer {settings.BEEHIIV_API_KEY}"},
            )
            r.raise_for_status()
            data = r.json()
            return data.get("total_results") or data.get("data", {}).get("total_results")
    except Exception:
        return None


@router.get("/analytics/overview")
async def overview(_=Depends(require_admin)):
    all_articles = await s3.read_all_articles_raw()
    published = [a for a in all_articles if a.get("status") == "published"]
    all_views = await dynamodb.scan_all_views()
    total_views = sum(v["total_views"] for v in all_views)
    views_today = sum(v["views_today"] for v in all_views)
    views_week = sum(v["views_week"] for v in all_views)
    top = sorted(all_views, key=lambda v: v["total_views"], reverse=True)[:10]

    views_map = {v["slug"]: v for v in all_views}
    all_meta = {a["slug"]: a for a in all_articles}
    top_articles = []
    for v in top:
        if v["slug"] in all_meta:
            top_articles.append({**all_meta[v["slug"]], **v})

    daily_chart = await dynamodb.get_daily_chart(30)
    subscriber_count = await _get_beehiiv_subscriber_count()

    return {
        "total_articles": len(published),
        "total_views": total_views,
        "views_today": views_today,
        "views_week": views_week,
        "daily_chart": daily_chart,
        "top_articles": top_articles,
        "subscriber_count": subscriber_count,
    }


@router.get("/analytics/articles")
async def articles_analytics(_=Depends(require_admin)):
    all_articles = await s3.read_all_articles_raw()
    all_views = await dynamodb.scan_all_views()
    views_map = {v["slug"]: v for v in all_views}
    result = []
    for a in all_articles:
        v = views_map.get(a["slug"], {"total_views": 0, "views_today": 0, "views_week": 0})
        result.append({**{k: val for k, val in a.items() if k != "body_html"}, **v})
    result.sort(key=lambda x: x.get("total_views", 0), reverse=True)
    return result
