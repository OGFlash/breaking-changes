from fastapi import APIRouter, Depends, HTTPException
from app.auth import require_admin
from app.config import settings
from app.models import Category
from app.services import s3
from app.services.s3 import regenerate_indexes

router = APIRouter()


async def _read_categories() -> list:
    try:
        return await s3.get_json(settings.CONTENT_BUCKET, "meta/categories.json")
    except Exception:
        return []


async def _write_categories(cats: list) -> None:
    await s3.put_json(settings.CONTENT_BUCKET, "meta/categories.json", cats)


@router.get("/categories")
async def list_categories(_=Depends(require_admin)):
    return await _read_categories()


@router.get("/categories/{slug}")
async def get_category(slug: str, _=Depends(require_admin)):
    cats = await _read_categories()
    cat = next((c for c in cats if c["slug"] == slug), None)
    if not cat:
        raise HTTPException(status_code=404, detail={"error": "Not found", "code": "NOT_FOUND"})
    return cat


@router.post("/categories", status_code=201)
async def create_category(body: Category, _=Depends(require_admin)):
    cats = await _read_categories()
    if any(c["slug"] == body.slug for c in cats):
        raise HTTPException(status_code=409, detail={"error": "Slug already exists", "code": "CONFLICT"})
    cats.append(body.model_dump())
    await _write_categories(cats)
    return body


@router.put("/categories/{slug}")
async def update_category(slug: str, body: Category, _=Depends(require_admin)):
    cats = await _read_categories()
    idx = next((i for i, c in enumerate(cats) if c["slug"] == slug), None)
    if idx is None:
        raise HTTPException(status_code=404, detail={"error": "Not found", "code": "NOT_FOUND"})
    cats[idx] = body.model_dump()
    await _write_categories(cats)
    return body


@router.delete("/categories/{slug}")
async def delete_category(slug: str, _=Depends(require_admin)):
    cats = await _read_categories()
    cats = [c for c in cats if c["slug"] != slug]
    await _write_categories(cats)
    return {"success": True}
