from fastapi import APIRouter
from app.config import settings
from app.services import s3

router = APIRouter()


@router.get("/categories")
async def list_categories():
    try:
        return await s3.get_json(settings.CONTENT_BUCKET, "meta/categories.json")
    except Exception:
        return []


@router.get("/categories/{slug}/articles")
async def category_articles(slug: str):
    try:
        return await s3.get_json(settings.CONTENT_BUCKET, f"indexes/by-category/{slug}.json")
    except Exception:
        return []
