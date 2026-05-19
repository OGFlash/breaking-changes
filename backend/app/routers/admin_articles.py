from __future__ import annotations
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from app.auth import require_admin
from app.config import settings
from app.models import Article, ArticleCreateRequest, ArticleUpdateRequest, StatusUpdateRequest
from app.services import s3
from app.services.s3 import regenerate_indexes
from app.services.ssg import publish_article_html, unpublish_article_html
import re

router = APIRouter()


def _slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text[:80]


@router.get("/articles")
async def admin_list_articles(
    status: str | None = None,
    category: str | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    _=Depends(require_admin),
):
    all_articles = await s3.read_all_articles_raw()
    if status:
        all_articles = [a for a in all_articles if a.get("status") == status]
    if category:
        all_articles = [a for a in all_articles if a.get("category", {}).get("slug") == category]
    all_articles.sort(key=lambda a: a.get("updated_at", ""), reverse=True)
    total = len(all_articles)
    start = (page - 1) * limit
    return {"items": all_articles[start : start + limit], "total": total, "page": page, "limit": limit}


@router.get("/articles/{slug}")
async def admin_get_article(slug: str, _=Depends(require_admin)):
    try:
        return await s3.get_json(settings.CONTENT_BUCKET, f"articles/{slug}.json")
    except Exception:
        raise HTTPException(status_code=404, detail={"error": "Not found", "code": "NOT_FOUND"})


@router.post("/articles", status_code=201)
async def admin_create_article(body: ArticleCreateRequest, _=Depends(require_admin)):
    slug = body.slug or _slugify(body.title)
    now = datetime.now(timezone.utc).isoformat()
    article = body.model_dump()
    article["slug"] = slug
    article["updated_at"] = now
    if body.status == "published" and not body.published_at:
        article["published_at"] = now

    await s3.put_json(settings.CONTENT_BUCKET, f"articles/{slug}.json", article)
    await regenerate_indexes()
    await publish_article_html(article)
    return article


@router.put("/articles/{slug}")
async def admin_update_article(slug: str, body: ArticleUpdateRequest, _=Depends(require_admin)):
    # Fetch existing to merge — prevents overwriting omitted optional fields
    try:
        existing = await s3.get_json(settings.CONTENT_BUCKET, f"articles/{slug}.json")
    except Exception:
        existing = {}
    now = datetime.now(timezone.utc).isoformat()
    # body.model_dump() excludes unset fields if we use exclude_unset=True,
    # but ArticleUpdateRequest may not mark them; safe merge: start from existing, overlay payload
    update_data = {k: v for k, v in body.model_dump().items() if v is not None or k in ('is_featured', 'is_breaking', 'is_sponsored')}
    article = {**existing, **update_data}
    article["slug"] = slug
    article["updated_at"] = now

    await s3.put_json(settings.CONTENT_BUCKET, f"articles/{slug}.json", article)
    await regenerate_indexes()
    await publish_article_html(article)
    return article


@router.patch("/articles/{slug}/status")
async def admin_update_status(slug: str, body: StatusUpdateRequest, _=Depends(require_admin)):
    try:
        article = await s3.get_json(settings.CONTENT_BUCKET, f"articles/{slug}.json")
    except Exception:
        raise HTTPException(status_code=404, detail={"error": "Not found", "code": "NOT_FOUND"})

    now = datetime.now(timezone.utc).isoformat()
    article["status"] = body.status
    article["updated_at"] = now
    if body.status == "published" and not article.get("published_at"):
        article["published_at"] = now

    await s3.put_json(settings.CONTENT_BUCKET, f"articles/{slug}.json", article)
    await regenerate_indexes()
    await publish_article_html(article)
    return article


@router.delete("/articles/{slug}")
async def admin_delete_article(slug: str, _=Depends(require_admin)):
    await s3.delete_object(settings.CONTENT_BUCKET, f"articles/{slug}.json")
    await regenerate_indexes()
    await unpublish_article_html(slug)
    return {"success": True}


@router.post("/ssg/regenerate")
async def admin_ssg_regenerate(_=Depends(require_admin)):
    """Backfill pre-rendered HTML for all existing published articles."""
    articles = await s3.read_all_articles_raw()
    published = [a for a in articles if a.get("status") == "published"]
    count = 0
    errors = []
    for article in published:
        try:
            await publish_article_html(article)
            count += 1
        except Exception as exc:
            errors.append({"slug": article.get("slug"), "error": str(exc)})
    return {"regenerated": count, "errors": errors}
