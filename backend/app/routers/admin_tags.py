from fastapi import APIRouter, Depends
from app.auth import require_admin
from app.config import settings
from app.services import s3

router = APIRouter()


@router.get("/tags")
async def list_tags(_=Depends(require_admin)):
    try:
        all_articles = await s3.read_all_articles_raw()
    except Exception:
        return []
    tag_counts: dict[str, int] = {}
    for a in all_articles:
        for tag in a.get("tags", []):
            tag_counts[tag] = tag_counts.get(tag, 0) + 1
    return [{"slug": tag, "name": tag, "article_count": count} for tag, count in sorted(tag_counts.items())]


@router.delete("/tags/{slug}")
async def delete_tag(slug: str, _=Depends(require_admin)):
    """Remove a tag from all articles (cascade)."""
    all_articles = await s3.read_all_articles_raw()
    import asyncio
    tasks = []
    for article in all_articles:
        if slug in article.get("tags", []):
            article["tags"] = [t for t in article["tags"] if t != slug]
            tasks.append(s3.put_json(settings.CONTENT_BUCKET, f"articles/{article['slug']}.json", article))
    if tasks:
        await asyncio.gather(*tasks)
        from app.services.s3 import regenerate_indexes
        await regenerate_indexes()
    return {"success": True}
