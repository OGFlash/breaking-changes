"""
Trend source fetchers used as tools in the discovery ReAct agent.
Each function is callable by the LLM tool executor.
All network calls use httpx with a shared async client.
"""
from __future__ import annotations
import asyncio
import math
import time
from typing import Any
import httpx
import structlog

logger = structlog.get_logger()

# Shared async client (lazy-initialised per process)
_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            timeout=15.0,
            headers={"User-Agent": "BreakingChanges-AIWriter/1.0 (research bot)"},
            follow_redirects=True,
        )
    return _client


# ---------------------------------------------------------------------------
# Recency scoring helper
# ---------------------------------------------------------------------------

def _recency_score(age_seconds: float) -> float:
    """Exponential decay: 1h→100, 6h→80, 24h→50, 48h→20, 72h→0."""
    age_hours = age_seconds / 3600
    if age_hours < 1:
        return 100.0
    if age_hours < 6:
        return 100 - (age_hours / 6) * 20
    if age_hours < 24:
        return 80 - ((age_hours - 6) / 18) * 30
    if age_hours < 48:
        return 50 - ((age_hours - 24) / 24) * 30
    return max(0.0, 20 - ((age_hours - 48) / 24) * 20)


# ---------------------------------------------------------------------------
# Hacker News
# ---------------------------------------------------------------------------

async def fetch_hn_stories(limit: int = 30) -> list[dict[str, Any]]:
    """Fetch top stories from Hacker News via the Firebase REST API."""
    client = _get_client()
    try:
        # Top story IDs
        resp = await client.get("https://hacker-news.firebaseio.com/v0/topstories.json")
        resp.raise_for_status()
        ids = resp.json()[:limit]

        # Fetch each story concurrently
        async def fetch_item(item_id: int) -> dict | None:
            try:
                r = await client.get(f"https://hacker-news.firebaseio.com/v0/item/{item_id}.json")
                r.raise_for_status()
                return r.json()
            except Exception:
                return None

        items = await asyncio.gather(*[fetch_item(i) for i in ids])
        now = time.time()
        results = []
        for item in items:
            if not item or item.get("type") != "story":
                continue
            age_s = now - item.get("time", now)
            results.append({
                "id": f"hn-{item['id']}",
                "title": item.get("title", ""),
                "source": "Hacker News",
                "source_url": f"https://news.ycombinator.com/item?id={item['id']}",
                "original_url": item.get("url", f"https://news.ycombinator.com/item?id={item['id']}"),
                "upvotes": item.get("score", 0),
                "comments": item.get("descendants", 0),
                "age_hours": round(age_s / 3600, 1),
                "recency_score": round(_recency_score(age_s), 1),
                "snippet": "",
            })
        logger.info("hn_fetched", count=len(results))
        return results
    except Exception as exc:
        logger.warning("hn_fetch_error", error=str(exc))
        return []


# ---------------------------------------------------------------------------
# Tech news RSS feeds (replaces Reddit JSON API which now requires OAuth)
# ---------------------------------------------------------------------------

TECH_RSS_FEEDS = [
    ("TechCrunch", "https://techcrunch.com/feed/"),
    ("Ars Technica", "https://feeds.arstechnica.com/arstechnica/index"),
    ("The Verge", "https://www.theverge.com/rss/index.xml"),
    ("Wired", "https://www.wired.com/feed/rss"),
    ("VentureBeat", "https://venturebeat.com/feed/"),
]


async def fetch_reddit_posts(subreddits: list[str] | None = None, limit: int = 10) -> list[dict[str, Any]]:
    """Fetch recent articles from major tech RSS feeds.
    (Reddit's JSON API now requires OAuth from server IPs — replaced with RSS.)
    """
    import xml.etree.ElementTree as ET
    client = _get_client()
    now = time.time()

    async def fetch_feed(name: str, url: str) -> list[dict]:
        try:
            r = await client.get(url, headers={"User-Agent": "Mozilla/5.0 (compatible; feed-reader/1.0)"})
            r.raise_for_status()
            root = ET.fromstring(r.text)
            ns = {"atom": "http://www.w3.org/2005/Atom"}
            results = []

            # RSS 2.0
            for item in root.findall(".//item")[:limit]:
                title = (item.findtext("title") or "").strip()
                link = (item.findtext("link") or "").strip()
                desc = (item.findtext("description") or "").strip()[:200]
                pub = item.findtext("pubDate") or ""
                try:
                    import email.utils
                    age_s = now - email.utils.parsedate_to_datetime(pub).timestamp()
                except Exception:
                    age_s = 3600
                if title and link:
                    results.append({
                        "id": f"rss-{hash(link)}",
                        "title": title,
                        "source": name,
                        "source_url": link,
                        "original_url": link,
                        "upvotes": 0,
                        "comments": 0,
                        "age_hours": round(age_s / 3600, 1),
                        "recency_score": round(_recency_score(age_s), 1),
                        "snippet": desc,
                    })

            # Atom feeds
            if not results:
                for entry in root.findall(".//atom:entry", ns)[:limit]:
                    title = (entry.findtext("atom:title", namespaces=ns) or "").strip()
                    link_el = entry.find("atom:link", ns)
                    link = (link_el.get("href") if link_el is not None else "") or ""
                    summary = (entry.findtext("atom:summary", namespaces=ns) or "").strip()[:200]
                    updated = entry.findtext("atom:updated", namespaces=ns) or ""
                    try:
                        from datetime import datetime, timezone
                        dt = datetime.fromisoformat(updated.replace("Z", "+00:00"))
                        age_s = now - dt.timestamp()
                    except Exception:
                        age_s = 3600
                    if title and link:
                        results.append({
                            "id": f"rss-{hash(link)}",
                            "title": title,
                            "source": name,
                            "source_url": link,
                            "original_url": link,
                            "upvotes": 0,
                            "comments": 0,
                            "age_hours": round(age_s / 3600, 1),
                            "recency_score": round(_recency_score(age_s), 1),
                            "snippet": summary,
                        })

            logger.info("rss_feed_fetched", source=name, count=len(results))
            return results
        except Exception as exc:
            logger.warning("rss_feed_error", source=name, error=str(exc))
            return []

    nested = await asyncio.gather(*[fetch_feed(name, url) for name, url in TECH_RSS_FEEDS])
    flat = [item for sub_list in nested for item in sub_list]
    logger.info("reddit_fetched", count=len(flat))  # keep key name for LLM tool compatibility
    return flat


# ---------------------------------------------------------------------------
# NewsAPI (requires key — falls back to empty list if not configured)
# ---------------------------------------------------------------------------

async def fetch_newsapi_headlines(query: str = "", category: str = "technology", api_key: str = "") -> list[dict[str, Any]]:
    """Fetch tech articles from Dev.to (free, no key) with optional NewsAPI fallback."""
    client = _get_client()
    now = time.time()
    results: list[dict] = []

    # ── Dev.to (free, no key required) ──────────────────────────────────────
    try:
        tags = ["javascript", "python", "ai", "security", "gaming", "cloud", "webdev", "programming"]
        tag = tags[0] if not query else query.split()[0]
        r = await client.get(
            "https://dev.to/api/articles",
            params={"top": "1", "per_page": "30", "tag": tag},
            headers={"User-Agent": "Mozilla/5.0"},
        )
        r.raise_for_status()
        for art in r.json():
            pub = art.get("published_at") or ""
            try:
                from datetime import datetime
                dt = datetime.fromisoformat(pub.replace("Z", "+00:00"))
                age_s = now - dt.timestamp()
            except Exception:
                age_s = 3600
            title = (art.get("title") or "").strip()
            url = art.get("url") or ""
            if title and url:
                results.append({
                    "id": f"devto-{art.get('id', hash(url))}",
                    "title": title,
                    "source": "Dev.to",
                    "source_url": url,
                    "original_url": url,
                    "upvotes": art.get("positive_reactions_count", 0),
                    "comments": art.get("comments_count", 0),
                    "age_hours": round(age_s / 3600, 1),
                    "recency_score": round(_recency_score(age_s), 1),
                    "snippet": (art.get("description") or "")[:200],
                })
        logger.info("devto_fetched", count=len(results))
    except Exception as exc:
        logger.warning("devto_fetch_error", error=str(exc))

    # ── NewsAPI fallback (only if key provided) ──────────────────────────────
    if api_key and not results:
        try:
            params: dict[str, str] = {"language": "en", "pageSize": "20", "apiKey": api_key}
            if query:
                params["q"] = query
                url = "https://newsapi.org/v2/everything"
            else:
                params["category"] = category
                url = "https://newsapi.org/v2/top-headlines"
            r = await client.get(url, params=params)
            r.raise_for_status()
            articles = r.json().get("articles", [])
            for art in articles:
                pub = art.get("publishedAt", "")
                try:
                    from datetime import datetime
                    dt = datetime.fromisoformat(pub.replace("Z", "+00:00"))
                    age_s = now - dt.timestamp()
                except Exception:
                    age_s = 0
                results.append({
                    "id": f"newsapi-{hash(art.get('url', ''))}",
                    "title": art.get("title") or "",
                    "source": art.get("source", {}).get("name", "NewsAPI"),
                    "source_url": art.get("url", ""),
                    "original_url": art.get("url", ""),
                    "upvotes": 0,
                    "comments": 0,
                    "age_hours": round(age_s / 3600, 1),
                    "recency_score": round(_recency_score(age_s), 1),
                    "snippet": art.get("description") or "",
                })
            logger.info("newsapi_fetched", count=len(results))
        except Exception as exc:
            logger.warning("newsapi_fetch_error", error=str(exc))

    return results


# ---------------------------------------------------------------------------
# Google Trends (via RSS — no auth required)
# ---------------------------------------------------------------------------

async def fetch_google_trends_rss() -> list[dict[str, Any]]:
    """Fetch daily trending searches from Google Trends RSS feed."""
    client = _get_client()
    try:
        url = "https://trends.google.com/trending/rss?geo=US"
        r = await client.get(url)
        r.raise_for_status()
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(r.text, "xml")
        items = soup.find_all("item")
        results = []
        for item in items[:20]:
            title_tag = item.find("title")
            link_tag = item.find("link")
            approx_traffic = item.find("approx_traffic")
            if not title_tag:
                continue
            results.append({
                "id": f"gtrends-{hash(title_tag.text)}",
                "title": title_tag.text.strip(),
                "source": "Google Trends",
                "source_url": link_tag.text.strip() if link_tag else "",
                "original_url": link_tag.text.strip() if link_tag else "",
                "upvotes": 0,
                "comments": 0,
                "age_hours": 1.0,  # daily trends, assume fresh
                "recency_score": 90.0,
                "snippet": f"Trending search with ~{approx_traffic.text if approx_traffic else 'unknown'} searches",
            })
        logger.info("gtrends_fetched", count=len(results))
        return results
    except Exception as exc:
        logger.warning("gtrends_fetch_error", error=str(exc))
        return []
