from __future__ import annotations
import json
import asyncio
from datetime import datetime, timezone
from typing import Any, Optional

import aioboto3
import structlog
from app.config import settings

logger = structlog.get_logger()
_session = aioboto3.Session()


def _client():
    return _session.client("s3", region_name=settings.AWS_REGION)


async def get_json(bucket: str, key: str) -> Any:
    async with _client() as s3:
        response = await s3.get_object(Bucket=bucket, Key=key)
        body = await response["Body"].read()
        return json.loads(body)


async def put_json(bucket: str, key: str, data: Any, cache_control: str = "max-age=60") -> None:
    content = json.dumps(data, default=str, ensure_ascii=False, indent=2)
    async with _client() as s3:
        await s3.put_object(
            Bucket=bucket,
            Key=key,
            Body=content.encode("utf-8"),
            ContentType="application/json",
            CacheControl=cache_control,
        )


async def put_text(bucket: str, key: str, data: str, content_type: str, cache_control: str = "max-age=300") -> None:
    async with _client() as s3:
        await s3.put_object(
            Bucket=bucket,
            Key=key,
            Body=data.encode("utf-8"),
            ContentType=content_type,
            CacheControl=cache_control,
        )


async def delete_object(bucket: str, key: str) -> None:
    async with _client() as s3:
        await s3.delete_object(Bucket=bucket, Key=key)


async def list_objects(bucket: str, prefix: str) -> list[dict]:
    results = []
    async with _session.client("s3", region_name=settings.AWS_REGION) as s3:
        paginator = s3.get_paginator("list_objects_v2")
        async for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
            for obj in page.get("Contents", []):
                results.append(obj)
    return results


async def presign_upload(bucket: str, key: str, content_type: str, expires: int = 900) -> str:
    async with _session.client("s3", region_name=settings.AWS_REGION) as s3:
        url = await s3.generate_presigned_url(
            "put_object",
            Params={"Bucket": bucket, "Key": key, "ContentType": content_type},
            ExpiresIn=expires,
        )
    return url


# ---- Article helpers -------------------------------------------------------

async def read_all_articles_raw() -> list[dict]:
    """Read every articles/{slug}.json from S3 and return as list of dicts."""
    objs = await list_objects(settings.CONTENT_BUCKET, "articles/")
    tasks = [get_json(settings.CONTENT_BUCKET, obj["Key"]) for obj in objs if obj["Key"].endswith(".json")]
    if not tasks:
        return []
    results = await asyncio.gather(*tasks, return_exceptions=True)
    return [r for r in results if isinstance(r, dict)]


def _strip_body(article: dict) -> dict:
    """Return article without body_html for index building."""
    return {k: v for k, v in article.items() if k != "body_html"}


async def regenerate_indexes() -> None:
    """Rebuild all index files in S3 content bucket."""
    from app.services.cloudfront import invalidate_paths

    logger.info("regenerate_indexes_start")
    all_articles = await read_all_articles_raw()

    published = sorted(
        [a for a in all_articles if a.get("status") == "published"],
        key=lambda a: a.get("published_at", ""),
        reverse=True,
    )
    meta_only = [_strip_body(a) for a in published]

    # all.json
    await put_json(settings.CONTENT_BUCKET, "indexes/all.json", meta_only, "max-age=60")

    # featured.json
    featured = [a for a in meta_only if a.get("is_featured")]
    await put_json(settings.CONTENT_BUCKET, "indexes/featured.json", featured, "max-age=60")

    # breaking.json
    breaking = [a for a in meta_only if a.get("is_breaking")]
    await put_json(settings.CONTENT_BUCKET, "indexes/breaking.json", breaking, "max-age=60")

    # by-category
    from collections import defaultdict
    by_cat: dict[str, list] = defaultdict(list)
    by_tag: dict[str, list] = defaultdict(list)
    by_author: dict[str, list] = defaultdict(list)

    for a in meta_only:
        cat_slug = a.get("category", {}).get("slug", "uncategorized")
        by_cat[cat_slug].append(a)
        for tag in a.get("tags", []):
            by_tag[tag].append(a)
        author_slug = a.get("author", {}).get("slug", "unknown")
        by_author[author_slug].append(a)

    tasks = []
    for slug, items in by_cat.items():
        tasks.append(put_json(settings.CONTENT_BUCKET, f"indexes/by-category/{slug}.json", items, "max-age=60"))
    for slug, items in by_tag.items():
        tasks.append(put_json(settings.CONTENT_BUCKET, f"indexes/by-tag/{slug}.json", items, "max-age=60"))
    for slug, items in by_author.items():
        tasks.append(put_json(settings.CONTENT_BUCKET, f"indexes/by-author/{slug}.json", items, "max-age=60"))

    # search-index.json
    search_index = [
        {
            "slug": a["slug"],
            "title": a["title"],
            "excerpt": a.get("excerpt", ""),
            "tags": a.get("tags", []),
            "category": a.get("category", {}),
            "published_at": a.get("published_at"),
        }
        for a in meta_only
    ]
    tasks.append(put_json(settings.CONTENT_BUCKET, "search-index.json", search_index, "max-age=300"))

    # sitemap.xml
    sitemap = _build_sitemap(published)
    tasks.append(put_text(settings.CONTENT_BUCKET, "sitemap.xml", sitemap, "application/xml", "max-age=3600"))
    tasks.append(put_text(settings.FRONTEND_BUCKET, "sitemap.xml", sitemap, "application/xml", "max-age=3600"))

    # rss.xml
    rss = _build_rss(published[:20])
    tasks.append(put_text(settings.CONTENT_BUCKET, "rss.xml", rss, "application/rss+xml", "max-age=3600"))
    tasks.append(put_text(settings.FRONTEND_BUCKET, "rss.xml", rss, "application/rss+xml", "max-age=3600"))

    await asyncio.gather(*tasks)

    # CloudFront invalidation
    await invalidate_paths([
        "/indexes/*",
        "/search-index.json",
        "/sitemap.xml",
        "/rss.xml",
        "/api/articles*",
    ])
    logger.info("regenerate_indexes_done")


def _build_sitemap(articles: list[dict]) -> str:
    from app.services.settings_svc import get_site_settings_cached
    base = "https://breakingchanges.dev"
    urls = [f"""  <url><loc>{base}/article/{a['slug']}</loc><lastmod>{(a.get('updated_at') or a.get('published_at', ''))[:10]}</lastmod></url>""" for a in articles]
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>{base}/</loc></url>
{chr(10).join(urls)}
</urlset>"""


def _build_rss(articles: list[dict]) -> str:
    base = "https://breakingchanges.dev"
    items = []
    for a in articles:
        items.append(f"""    <item>
      <title><![CDATA[{a['title']}]]></title>
      <link>{base}/article/{a['slug']}</link>
      <description><![CDATA[{a.get('excerpt', '')}]]></description>
      <pubDate>{a.get('published_at', '')}</pubDate>
      <guid>{base}/article/{a['slug']}</guid>
    </item>""")
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Breaking Changes</title>
    <link>{base}</link>
    <description>The latest in tech, AI, and gaming.</description>
{chr(10).join(items)}
  </channel>
</rss>"""
