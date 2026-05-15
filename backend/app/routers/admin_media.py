from fastapi import APIRouter, Depends, HTTPException
from app.auth import require_admin
from app.config import settings
from app.models import PresignRequest
from app.services import s3
import mimetypes
import re

router = APIRouter()


@router.post("/media/presign")
async def presign(body: PresignRequest, _=Depends(require_admin)):
    safe_name = re.sub(r"[^\w.\-]", "_", body.filename)
    key = f"uploads/{safe_name}"
    upload_url = await s3.presign_upload(settings.MEDIA_BUCKET, key, body.content_type)
    public_url = f"https://media.breakingchanges.dev/media/{key}"
    return {"upload_url": upload_url, "public_url": public_url, "key": key}


@router.get("/media")
async def list_media(_=Depends(require_admin)):
    objs = await s3.list_objects(settings.MEDIA_BUCKET, "uploads/")
    return [
        {
            "key": o["Key"],
            "size": o.get("Size", 0),
            "last_modified": str(o.get("LastModified", "")),
            "url": f"https://media.breakingchanges.dev/media/{o['Key']}",
        }
        for o in objs
    ]


@router.delete("/media/{key:path}")
async def delete_media(key: str, _=Depends(require_admin)):
    await s3.delete_object(settings.MEDIA_BUCKET, key)
    return {"success": True}
