from fastapi import APIRouter, Depends, HTTPException
from app.auth import require_admin
from app.config import settings
from app.models import Author
from app.services import s3

router = APIRouter()


async def _read_authors() -> list:
    try:
        return await s3.get_json(settings.CONTENT_BUCKET, "meta/authors.json")
    except Exception:
        return []


@router.get("/authors")
async def list_authors(_=Depends(require_admin)):
    return await _read_authors()


@router.post("/authors", status_code=201)
async def create_author(body: Author, _=Depends(require_admin)):
    authors = await _read_authors()
    if any(a["slug"] == body.slug for a in authors):
        raise HTTPException(status_code=409, detail={"error": "Slug already exists", "code": "CONFLICT"})
    authors.append(body.model_dump())
    await s3.put_json(settings.CONTENT_BUCKET, "meta/authors.json", authors)
    return body


@router.put("/authors/{slug}")
async def update_author(slug: str, body: Author, _=Depends(require_admin)):
    authors = await _read_authors()
    idx = next((i for i, a in enumerate(authors) if a["slug"] == slug), None)
    if idx is None:
        raise HTTPException(status_code=404, detail={"error": "Not found", "code": "NOT_FOUND"})
    authors[idx] = body.model_dump()
    await s3.put_json(settings.CONTENT_BUCKET, "meta/authors.json", authors)
    return body


@router.delete("/authors/{slug}")
async def delete_author(slug: str, _=Depends(require_admin)):
    authors = await _read_authors()
    authors = [a for a in authors if a["slug"] != slug]
    await s3.put_json(settings.CONTENT_BUCKET, "meta/authors.json", authors)
    return {"success": True}
