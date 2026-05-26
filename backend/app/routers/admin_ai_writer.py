"""
Admin AI Writer endpoints — async job pattern to bypass API Gateway's 29s timeout.

Long-running operations (trends, research, generate) work as follows:
  1. POST endpoint creates a DynamoDB job record and invokes this Lambda
     asynchronously (InvocationType='Event'), then returns {job_id} in < 1s.
  2. The async Lambda invocation runs the real work and stores the result in DDB.
  3. GET /ai-writer/job/{job_id} polls the job record — returns status + result.

POST /api/admin/ai-writer/trends       — kick off discovery ReAct agent
POST /api/admin/ai-writer/research     — kick off research ReAct agent
POST /api/admin/ai-writer/generate     — kick off body + metadata generation
GET  /api/admin/ai-writer/job/{job_id} — poll job status / fetch result
POST /api/admin/ai-writer/save-draft   — persist reviewed draft to S3
"""
from __future__ import annotations
import asyncio
import json
import os
import re
from datetime import datetime, timezone
from typing import Any

import boto3
import structlog
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth import require_admin
from app.config import settings
from app.services import ai_writer, s3
from app.services.jobs import create_job, get_job, update_job
from app.services.s3 import regenerate_indexes

router = APIRouter()
logger = structlog.get_logger()


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class TrendsRequest(BaseModel):
    categories: list[str] = ["ai", "security", "dev-tools", "gaming", "business"]


class ResearchRequest(BaseModel):
    title: str
    urls: list[str] = []
    category: str = "ai"


class GenerateRequest(BaseModel):
    brief: dict[str, Any]
    word_count: int = 600


class SaveDraftRequest(BaseModel):
    draft: dict[str, Any]
    author_slug: str = "bc-staff"


# ---------------------------------------------------------------------------
# Async Lambda self-invocation helper
# ---------------------------------------------------------------------------

def _invoke_self_async(payload: dict) -> None:
    """Fire-and-forget: invoke this Lambda with InvocationType='Event'."""
    fn_name = os.environ.get("AWS_LAMBDA_FUNCTION_NAME", "breakingchanges-backend")
    lambda_client = boto3.client("lambda", region_name=settings.AWS_REGION)
    lambda_client.invoke(
        FunctionName=fn_name,
        InvocationType="Event",  # async — returns immediately with 202
        Payload=json.dumps({"ai_job": payload}),
    )
    logger.info("lambda_async_invoked", fn=fn_name, job_id=payload.get("job_id"))


async def _dispatch_job(job_type: str, params: dict) -> str:
    """Create job record then kick off async Lambda invocation."""
    job_id = await create_job(job_type, params)
    await asyncio.to_thread(
        _invoke_self_async,
        {"job_id": job_id, "job_type": job_type, "params": params},
    )
    return job_id


# ---------------------------------------------------------------------------
# Actual job runners (called by handler.py when event contains ai_job)
# ---------------------------------------------------------------------------

# Keyword map to snap AI-invented slugs to real category slugs
_CAT_KEYWORDS: dict[str, list[str]] = {
    "ai":        ["ai", "artificial", "machine", "learning", "ml", "llm", "gpt", "claude", "openai", "deepmind", "gemini"],
    "gaming":    ["gaming", "game", "games", "xbox", "playstation", "nintendo", "gta", "esport"],
    "dev-tools": ["dev", "tool", "developer", "programming", "code", "software", "framework", "open-source", "github", "npm", "package"],
    "security":  ["security", "cyber", "hack", "breach", "ransomware", "malware", "vuln", "exploit", "phish", "token", "leak"],
    "business":  ["business", "startup", "funding", "acquisition", "ipo", "revenue", "market", "ceo", "layoff", "deal"],
    "politics":  ["politics", "political", "government", "congress", "senate", "regulation", "antitrust", "policy", "legislation", "election", "white house", "administration", "law", "bipartisan"],
}


async def _load_valid_categories() -> list[dict]:
    """Load categories from S3, return list of {slug, name, color}."""
    try:
        return await s3.get_json(settings.CONTENT_BUCKET, "meta/categories.json")
    except Exception:
        return [{"slug": "ai", "name": "AI", "color": "#888888"}]


def _snap_category(raw: str, valid: list[dict]) -> dict:
    """Snap an AI-generated category string to the nearest valid category."""
    raw_lower = raw.lower().replace(" ", "-")
    # Exact slug match
    for cat in valid:
        if cat["slug"] == raw_lower:
            return cat
    # Keyword match
    for slug, keywords in _CAT_KEYWORDS.items():
        if any(kw in raw_lower for kw in keywords):
            for cat in valid:
                if cat["slug"] == slug:
                    return cat
    # Fallback to first category
    return valid[0]


async def run_job(job_type: str, job_id: str, params: dict) -> None:
    """Execute the job and store the result in DynamoDB."""
    await update_job(job_id, "running")
    try:
        if job_type == "trends":
            result = await ai_writer.discover_topics(params.get("categories", []))

        elif job_type == "research":
            result = await ai_writer.research_topic(
                title=params["title"],
                urls=params.get("urls", []),
                category=params.get("category", "ai"),
            )
            result = {"brief": result}

        elif job_type == "generate":
            brief = params["brief"]
            word_count = params.get("word_count", 600)
            body_html = await ai_writer.generate_body(brief, word_count)
            metadata = await ai_writer.generate_metadata(brief, body_html)
            cover_query = metadata.get("cover_image_query", brief.get("category", "technology"))
            cover_image_url = await ai_writer.fetch_cover_image(cover_query)
            if not cover_image_url:
                seed = cover_query.replace(' ', '-').lower()[:40]
                cover_image_url = f"https://picsum.photos/seed/{seed}/1200/630"
            # Snap category to a valid one from S3 to avoid invented slugs
            valid_cats = await _load_valid_categories()
            raw_cat = brief.get("category", "ai")
            category_obj = _snap_category(str(raw_cat), valid_cats)
            logger.info("category_snapped", raw=raw_cat, snapped=category_obj["slug"])
            result = {
                "draft": {
                    **metadata,
                    "body_html": body_html,
                    "cover_image_url": cover_image_url,
                    "og_image_url": cover_image_url,
                    "category": category_obj,
                    "sources": brief.get("sources", []),
                    "generated_by": "ai-writer",
                }
            }

        else:
            raise ValueError(f"Unknown job_type: {job_type}")

        await update_job(job_id, "done", result=result)
        logger.info("job_done", job_id=job_id, job_type=job_type)

    except Exception as exc:
        logger.error("job_error", job_id=job_id, job_type=job_type, error=str(exc))
        await update_job(job_id, "error", error=str(exc))


# ---------------------------------------------------------------------------
# POST /api/admin/ai-writer/trends
# ---------------------------------------------------------------------------

@router.post("/ai-writer/trends")
async def start_trends(body: TrendsRequest, _=Depends(require_admin)) -> dict:
    """Kick off the discovery ReAct agent. Returns {job_id} immediately."""
    if not settings.LLM_MODEL:
        raise HTTPException(status_code=503, detail={"error": "LLM_MODEL not set", "code": "AI_NOT_CONFIGURED"})
    try:
        job_id = await _dispatch_job("trends", {"categories": body.categories})
        return {"job_id": job_id}
    except Exception as exc:
        logger.error("trends_dispatch_error", error=str(exc))
        raise HTTPException(status_code=500, detail={"error": str(exc), "code": "DISPATCH_ERROR"})


# ---------------------------------------------------------------------------
# POST /api/admin/ai-writer/research
# ---------------------------------------------------------------------------

@router.post("/ai-writer/research")
async def start_research(body: ResearchRequest, _=Depends(require_admin)) -> dict:
    """Kick off the research ReAct agent. Returns {job_id} immediately."""
    if not settings.LLM_MODEL:
        raise HTTPException(status_code=503, detail={"error": "LLM_MODEL not set", "code": "AI_NOT_CONFIGURED"})
    try:
        job_id = await _dispatch_job("research", {
            "title": body.title,
            "urls": body.urls,
            "category": body.category,
        })
        return {"job_id": job_id}
    except Exception as exc:
        logger.error("research_dispatch_error", error=str(exc))
        raise HTTPException(status_code=500, detail={"error": str(exc), "code": "DISPATCH_ERROR"})


# ---------------------------------------------------------------------------
# POST /api/admin/ai-writer/generate
# ---------------------------------------------------------------------------

@router.post("/ai-writer/generate")
async def start_generate(body: GenerateRequest, _=Depends(require_admin)) -> dict:
    """Kick off article generation. Returns {job_id} immediately."""
    if not settings.LLM_MODEL:
        raise HTTPException(status_code=503, detail={"error": "LLM_MODEL not set", "code": "AI_NOT_CONFIGURED"})
    try:
        job_id = await _dispatch_job("generate", {
            "brief": body.brief,
            "word_count": body.word_count,
        })
        return {"job_id": job_id}
    except Exception as exc:
        logger.error("generate_dispatch_error", error=str(exc))
        raise HTTPException(status_code=500, detail={"error": str(exc), "code": "DISPATCH_ERROR"})


# ---------------------------------------------------------------------------
# GET /api/admin/ai-writer/job/{job_id}
# ---------------------------------------------------------------------------

@router.get("/ai-writer/job/{job_id}")
async def poll_job(job_id: str, _=Depends(require_admin)) -> dict:
    """Poll job status. Returns {status, result?, error?}."""
    job = await get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail={"error": "Job not found", "code": "JOB_NOT_FOUND"})
    return job


# ---------------------------------------------------------------------------
# POST /api/admin/ai-writer/save-draft
# ---------------------------------------------------------------------------

def _slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text[:80].strip("-")


@router.post("/ai-writer/save-draft", status_code=201)
async def save_draft(body: SaveDraftRequest, _=Depends(require_admin)) -> dict:
    """Save the reviewed AI draft as a draft article in S3. Returns {slug}."""
    draft = dict(body.draft)
    title = draft.get("title", "Untitled")
    slug = _slugify(title)
    now = datetime.now(timezone.utc).isoformat()

    category_raw = draft.get("category", "ai")
    if isinstance(category_raw, dict) and "slug" in category_raw:
        # Already a dict — snap the slug to ensure it's valid
        valid_cats = await _load_valid_categories()
        category_obj = _snap_category(category_raw["slug"], valid_cats)
    else:
        valid_cats = await _load_valid_categories()
        category_obj = _snap_category(str(category_raw), valid_cats)

    article = {
        "id": slug,
        "slug": slug,
        "title": title,
        "subtitle": draft.get("subtitle", ""),
        "excerpt": draft.get("excerpt", ""),
        "body_html": draft.get("body_html", ""),
        "cover_image_url": draft.get("cover_image_url", ""),
        "og_image_url": draft.get("og_image_url", draft.get("cover_image_url", "")),
        "author": {"id": body.author_slug, "name": "AI Writer", "slug": body.author_slug},
        "category": category_obj,
        "tags": draft.get("tags", []),
        "status": "draft",
        "is_featured": False,
        "is_breaking": False,
        "is_sponsored": False,
        "seo_title": draft.get("seo_title", ""),
        "seo_description": draft.get("seo_description", ""),
        "read_time": max(1, len(draft.get("body_html", "").split()) // 200),
        "view_count": 0,
        "published_at": None,
        "created_at": now,
        "updated_at": now,
        "generated_by": "ai-writer",
        "sources": draft.get("sources", []),
    }

    try:
        await s3.put_json(settings.CONTENT_BUCKET, f"articles/{slug}.json", article)
        await regenerate_indexes()
        logger.info("ai_draft_saved", slug=slug)
        return {"slug": slug}
    except Exception as exc:
        logger.error("save_draft_error", error=str(exc))
        raise HTTPException(status_code=500, detail={"error": str(exc), "code": "SAVE_ERROR"})
