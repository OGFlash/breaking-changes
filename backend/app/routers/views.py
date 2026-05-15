from fastapi import APIRouter
from app.services import dynamodb

router = APIRouter()


@router.post("/views/{slug}")
async def record_view(slug: str):
    total = await dynamodb.increment_view(slug)
    return {"slug": slug, "total_views": total}
