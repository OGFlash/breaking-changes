from fastapi import APIRouter, HTTPException
from app.config import settings
from app.services import s3

router = APIRouter()


@router.get("/authors")
async def list_authors():
    try:
        return await s3.get_json(settings.CONTENT_BUCKET, "meta/authors.json")
    except Exception:
        return []


@router.get("/authors/{slug}")
async def get_author(slug: str):
    try:
        authors = await s3.get_json(settings.CONTENT_BUCKET, "meta/authors.json")
    except Exception:
        raise HTTPException(status_code=404, detail={"error": "Author not found", "code": "NOT_FOUND"})

    author = next((a for a in authors if a["slug"] == slug), None)
    if not author:
        raise HTTPException(status_code=404, detail={"error": "Author not found", "code": "NOT_FOUND"})

    try:
        articles = await s3.get_json(settings.CONTENT_BUCKET, f"indexes/by-author/{slug}.json")
    except Exception:
        articles = []

    return {"author": author, "articles": articles}
