from __future__ import annotations
from fastapi import APIRouter, HTTPException, Query
from app.config import settings
from app.models import Article, ArticleMeta, PaginatedArticles
from app.services import s3, dynamodb
import math

router = APIRouter()


@router.get("/articles", response_model=PaginatedArticles)
async def list_articles(
    page: int = Query(1, ge=1),
    limit: int = Query(12, ge=1, le=100),
    category: str | None = None,
    tag: str | None = None,
    author: str | None = None,
    featured: bool | None = None,
    breaking: bool | None = None,
):
    try:
        if category:
            items = await s3.get_json(settings.CONTENT_BUCKET, f"indexes/by-category/{category}.json")
        elif tag:
            items = await s3.get_json(settings.CONTENT_BUCKET, f"indexes/by-tag/{tag}.json")
        elif author:
            items = await s3.get_json(settings.CONTENT_BUCKET, f"indexes/by-author/{author}.json")
        else:
            items = await s3.get_json(settings.CONTENT_BUCKET, "indexes/all.json")
    except Exception:
        items = []

    if featured is not None:
        items = [a for a in items if a.get("is_featured") == featured]
    if breaking is not None:
        items = [a for a in items if a.get("is_breaking") == breaking]

    await _merge_view_counts(items)

    total = len(items)
    start = (page - 1) * limit
    page_items = items[start : start + limit]

    return PaginatedArticles(
        items=page_items,
        total=total,
        page=page,
        limit=limit,
        pages=math.ceil(total / limit) if total else 1,
    )


async def _merge_view_counts(items: list) -> list:
    """Merge live DynamoDB view counts into a list of article dicts."""
    try:
        all_views = await dynamodb.scan_all_views()
        views_map = {v["slug"]: v["total_views"] for v in all_views}
        for item in items:
            item["view_count"] = views_map.get(item["slug"], item.get("view_count") or 0)
    except Exception:
        pass
    return items


@router.get("/articles/featured")
async def featured_articles():
    try:
        items = await s3.get_json(settings.CONTENT_BUCKET, "indexes/featured.json")
    except Exception:
        return []
    return await _merge_view_counts(items)


@router.get("/articles/breaking")
async def breaking_articles():
    try:
        items = await s3.get_json(settings.CONTENT_BUCKET, "indexes/breaking.json")
    except Exception:
        return []
    return await _merge_view_counts(items)


@router.get("/articles/trending")
async def trending_articles():
    trending = await dynamodb.get_trending(5)
    try:
        all_meta = await s3.get_json(settings.CONTENT_BUCKET, "indexes/all.json")
    except Exception:
        all_meta = []
    meta_map = {a["slug"]: a for a in all_meta}
    result = []
    for t in trending:
        if t["slug"] in meta_map:
            a = meta_map[t["slug"]].copy()
            a["view_count"] = t["total_views"]
            result.append(a)
    return result


@router.get("/articles/{slug}", response_model=Article)
async def get_article(slug: str):
    try:
        article = await s3.get_json(settings.CONTENT_BUCKET, f"articles/{slug}.json")
    except Exception:
        raise HTTPException(status_code=404, detail={"error": "Article not found", "code": "NOT_FOUND"})

    # async view count increment (fire and forget)
    import asyncio
    asyncio.create_task(dynamodb.increment_view(slug))

    return article


@router.get("/articles/{slug}/related")
async def related_articles(slug: str):
    try:
        article = await s3.get_json(settings.CONTENT_BUCKET, f"articles/{slug}.json")
        all_articles = await s3.get_json(settings.CONTENT_BUCKET, "indexes/all.json")
    except Exception:
        return []

    tags = set(article.get("tags", []))
    cat = article.get("category", {}).get("slug", "")

    scored = []
    for a in all_articles:
        if a["slug"] == slug:
            continue
        score = len(tags & set(a.get("tags", [])))
        if a.get("category", {}).get("slug") == cat:
            score += 2
        if score > 0:
            scored.append((score, a))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [a for _, a in scored[:4]]
