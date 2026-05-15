from __future__ import annotations
import aioboto3
import structlog
from app.config import settings

logger = structlog.get_logger()
_session = aioboto3.Session()

DISTRIBUTION_ID_PARAM = "CLOUDFRONT_DISTRIBUTION_ID"

import os

DIST_ID = os.environ.get("CLOUDFRONT_DISTRIBUTION_ID", "")


async def invalidate_paths(paths: list[str]) -> None:
    if not DIST_ID:
        logger.warning("cloudfront_invalidation_skipped", reason="no distribution id")
        return
    import time
    async with _session.client("cloudfront", region_name="us-east-1") as cf:
        await cf.create_invalidation(
            DistributionId=DIST_ID,
            InvalidationBatch={
                "Paths": {"Quantity": len(paths), "Items": paths},
                "CallerReference": str(int(time.time())),
            },
        )
    logger.info("cloudfront_invalidation_created", paths=paths)
