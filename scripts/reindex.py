#!/usr/bin/env python3
"""
Rebuild all S3 content indexes from the articles currently in the bucket.
Run this any time you upload article JSON files directly to S3.

Usage:
    python3 scripts/reindex.py
"""
import json
import boto3
from collections import defaultdict

CONTENT_BUCKET = "breakingchanges.com-content"
REGION = "us-east-1"

s3 = boto3.client("s3", region_name=REGION)


def list_articles():
    paginator = s3.get_paginator("list_objects_v2")
    keys = []
    for page in paginator.paginate(Bucket=CONTENT_BUCKET, Prefix="articles/"):
        for obj in page.get("Contents", []):
            if obj["Key"].endswith(".json"):
                keys.append(obj["Key"])
    return keys


def get_json(key):
    resp = s3.get_object(Bucket=CONTENT_BUCKET, Key=key)
    return json.loads(resp["Body"].read())


def put_json(key, data):
    s3.put_object(
        Bucket=CONTENT_BUCKET,
        Key=key,
        Body=json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8"),
        ContentType="application/json",
        CacheControl="max-age=60",
    )
    print(f"  ✓ {key}")


def strip_body(article):
    return {k: v for k, v in article.items() if k != "body_html"}


def main():
    print("Reading articles from S3...")
    keys = list_articles()
    print(f"  Found {len(keys)} article files")

    articles = []
    for key in keys:
        try:
            articles.append(get_json(key))
        except Exception as e:
            print(f"  ✗ Failed to read {key}: {e}")

    published = sorted(
        [a for a in articles if a.get("status") == "published"],
        key=lambda a: a.get("published_at", ""),
        reverse=True,
    )
    meta_only = [strip_body(a) for a in published]
    print(f"  {len(published)} published articles\n")

    print("Writing indexes...")

    put_json("indexes/all.json", meta_only)
    put_json("indexes/featured.json", [a for a in meta_only if a.get("is_featured")])
    put_json("indexes/breaking.json", [a for a in meta_only if a.get("is_breaking")])

    by_cat = defaultdict(list)
    by_tag = defaultdict(list)
    by_author = defaultdict(list)

    for a in meta_only:
        cat = a.get("category", {})
        cat_slug = cat if isinstance(cat, str) else (cat or {}).get("slug", "uncategorized")
        by_cat[cat_slug or "uncategorized"].append(a)

        for tag in a.get("tags", []):
            tag_slug = tag if isinstance(tag, str) else (tag or {}).get("slug", tag)
            if tag_slug:
                by_tag[tag_slug].append(a)

        author = a.get("author", {})
        author_slug = author if isinstance(author, str) else (author or {}).get("slug", "")
        if author_slug:
            by_author[author_slug].append(a)

    for slug, items in by_cat.items():
        put_json(f"indexes/by-category/{slug}.json", items)

    for slug, items in by_tag.items():
        put_json(f"indexes/by-tag/{slug}.json", items)

    for slug, items in by_author.items():
        put_json(f"indexes/by-author/{slug}.json", items)

    print(f"\nDone. Rebuilt indexes for {len(published)} published articles.")
    print("You may want to invalidate CloudFront:")
    print('  aws cloudfront create-invalidation --distribution-id EI10TMZ6SGJ6E --paths "/api/*"')


if __name__ == "__main__":
    main()
