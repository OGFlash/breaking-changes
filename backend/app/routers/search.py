from fastapi import APIRouter, Query
from app.config import settings
from app.services import s3

router = APIRouter()


@router.get("/search")
async def search(q: str = Query("", min_length=0)):
    try:
        index = await s3.get_json(settings.CONTENT_BUCKET, "search-index.json")
    except Exception:
        index = []

    if not q:
        return index

    q_lower = q.lower()
    results = []
    for item in index:
        if (
            q_lower in item.get("title", "").lower()
            or q_lower in item.get("excerpt", "").lower()
            or any(q_lower in t.lower() for t in item.get("tags", []))
        ):
            results.append(item)
    return results
