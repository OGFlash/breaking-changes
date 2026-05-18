"""
Async job store for AI Writer long-running operations.

Uses the existing DynamoDB table with key prefix "JOB#<job_id>" so it
doesn't clash with view-count records. Jobs expire (TTL) after 2 hours.

Job lifecycle:
  pending  → created, Lambda invocation queued
  running  → Lambda picked it up
  done     → result stored
  error    → error message stored
"""
from __future__ import annotations
import asyncio
import json
import time
import uuid
from typing import Any, Literal

import boto3
import structlog

from app.config import settings

logger = structlog.get_logger()

JobStatus = Literal["pending", "running", "done", "error"]
_TTL_SECONDS = 7200  # 2 hours


def _ddb():
    """Sync boto3 DynamoDB client (used via asyncio.to_thread)."""
    return boto3.client("dynamodb", region_name=settings.AWS_REGION)


def _job_key(job_id: str) -> dict:
    return {"slug": {"S": f"JOB#{job_id}"}}


# ---------------------------------------------------------------------------
# Create / update / read
# ---------------------------------------------------------------------------

def _create_job_sync(job_id: str, job_type: str, params: dict) -> None:
    client = _ddb()
    client.put_item(
        TableName=settings.DYNAMODB_TABLE,
        Item={
            "slug": {"S": f"JOB#{job_id}"},
            "status": {"S": "pending"},
            "job_type": {"S": job_type},
            "params": {"S": json.dumps(params)},
            "result": {"S": ""},
            "error_msg": {"S": ""},
            "created_at": {"N": str(int(time.time()))},
            "ttl": {"N": str(int(time.time()) + _TTL_SECONDS)},
        },
    )


def _update_job_sync(job_id: str, status: JobStatus, result: Any = None, error: str = "") -> None:
    client = _ddb()
    client.update_item(
        TableName=settings.DYNAMODB_TABLE,
        Key=_job_key(job_id),
        UpdateExpression="SET #s = :s, #r = :r, #e = :e",
        ExpressionAttributeNames={"#s": "status", "#r": "result", "#e": "error_msg"},
        ExpressionAttributeValues={
            ":s": {"S": status},
            ":r": {"S": json.dumps(result) if result is not None else ""},
            ":e": {"S": error},
        },
    )


def _get_job_sync(job_id: str) -> dict | None:
    client = _ddb()
    resp = client.get_item(
        TableName=settings.DYNAMODB_TABLE,
        Key=_job_key(job_id),
    )
    item = resp.get("Item")
    if not item:
        return None
    result_raw = item.get("result", {}).get("S", "")
    return {
        "job_id": job_id,
        "status": item.get("status", {}).get("S", "unknown"),
        "job_type": item.get("job_type", {}).get("S", ""),
        "result": json.loads(result_raw) if result_raw else None,
        "error": item.get("error_msg", {}).get("S", ""),
        "created_at": int(item.get("created_at", {}).get("N", 0)),
    }


# ---------------------------------------------------------------------------
# Async wrappers
# ---------------------------------------------------------------------------

async def create_job(job_type: str, params: dict) -> str:
    job_id = str(uuid.uuid4())
    await asyncio.to_thread(_create_job_sync, job_id, job_type, params)
    logger.info("job_created", job_id=job_id, job_type=job_type)
    return job_id


async def update_job(job_id: str, status: JobStatus, result: Any = None, error: str = "") -> None:
    await asyncio.to_thread(_update_job_sync, job_id, status, result, error)
    logger.info("job_updated", job_id=job_id, status=status)


async def get_job(job_id: str) -> dict | None:
    return await asyncio.to_thread(_get_job_sync, job_id)
