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


def _reset_client() -> None:
    """Force a fresh AsyncClient on the next call to _get_client().

    Must be called at the start of any entry-point that runs inside a
    new asyncio event loop (e.g. the Lambda async-job handler), because
    httpx.AsyncClient binds to the loop it was created on.  Reusing an
    old client across event loops causes all requests to fail silently.
    """
    global _client
    _client = None


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
    ("TechCrunch",  "https://techcrunch.com/feed/"),
    ("Ars Technica","https://feeds.arstechnica.com/arstechnica/index"),
    ("The Verge",   "https://www.theverge.com/rss/index.xml"),
    ("VentureBeat", "https://venturebeat.com/feed"),        # /feed/ redirects → use real URL
    ("Fast Company","https://www.fastcompany.com/technology/rss"),  # replaces Wired (1 item, bot-blocked)
]

# ---------------------------------------------------------------------------
# Primary source feeds — official blogs, newsrooms, government advisories.
# These are tagged is_primary=True and get a score boost in pre-selection so
# they always beat secondary coverage of the same story.
# Only include verified working feeds (re-test after any deploy issues).
# ---------------------------------------------------------------------------

PRIMARY_SOURCE_FEEDS: dict[str, list[tuple[str, str]]] = {
    "gaming": [
        ("PlayStation Blog", "https://blog.playstation.com/feed/"),   # 10 items ✓
        ("Xbox Wire",        "https://news.xbox.com/en-us/feed/"),    # 10 items ✓
        ("Steam News",       "https://store.steampowered.com/feeds/news/"),  # 10 items ✓
    ],
    "ai": [
        ("OpenAI Blog",      "https://openai.com/news/rss.xml"),      # 965 items ✓
        ("Google DeepMind",  "https://deepmind.google/blog/rss.xml"), # 100 items ✓
        ("Google AI Blog",   "https://blog.google/technology/ai/rss/"),  # 20 items ✓
        ("Microsoft AI",     "https://blogs.microsoft.com/ai/feed/"), # 10 items ✓
        ("Meta AI",          "https://engineering.fb.com/category/ml-applications/feed/"),  # 10 items ✓
        ("arXiv cs.AI",      "https://rss.arxiv.org/rss/cs.AI"),     # 14 items daily ✓
    ],
    "business": [
        ("Apple Newsroom",   "https://www.apple.com/newsroom/rss-feed.rss"),  # 20 items ✓
        ("Google Blog",      "https://blog.google/rss/"),             # 20 items ✓
        ("Meta Newsroom",    "https://about.fb.com/feed/"),           # 3 items ✓
        ("Amazon Science",   "https://www.amazon.science/index.rss"), # 4 items ✓
        ("Stripe Blog",      "https://stripe.com/blog/feed.rss"),     # 10 items ✓
        ("Bloomberg Tech",   "https://feeds.bloomberg.com/technology/news.rss"),  # 30 items ✓
        ("Quartz",           "https://qz.com/rss"),                   # 43 items ✓
    ],
    "security": [
        ("CISA Advisories",    "https://www.cisa.gov/cybersecurity-advisories/all.xml"),  # 30 items ✓
        ("Google Project Zero","https://projectzero.google/feed.xml"),  # 10 items ✓
        ("Mozilla Security",   "https://blog.mozilla.org/security/feed/"),  # 4 items ✓
    ],
    "dev-tools": [
        ("AWS News",         "https://aws.amazon.com/blogs/aws/feed/"),  # large ✓
        ("Cloudflare Blog",  "https://blog.cloudflare.com/rss/"),      # large ✓
        ("GitHub Security",  "https://github.blog/feed/?category=security"),  # 2+ items ✓
    ],
}

# ---------------------------------------------------------------------------
# Category-specialist RSS feeds
# To add a new category: add an entry here. Nothing else needs to change.
# ---------------------------------------------------------------------------

CATEGORY_RSS_FEEDS: dict[str, list[tuple[str, str]]] = {
    # Verified working as of 2025. Re-test with scripts/check_feeds.sh after any deploy issues.
    "gaming": [
        ("Kotaku",            "https://kotaku.com/feed"),              # real URL (was /rss → redirect)
        ("Rock Paper Shotgun","https://www.rockpapershotgun.com/feed"),
        ("PC Gamer",          "https://www.pcgamer.com/rss/"),
        ("PCGamesN",          "https://www.pcgamesn.com/mainrss.xml"), # real URL (was /feed → redirect)
        ("GamesRadar",        "https://www.gamesradar.com/feeds.xml"), # real URL (was /rss/ → redirect)
        ("GameSpot",          "https://www.gamespot.com/feeds/mashup/"),
    ],
    "business": [
        ("Fortune",             "https://fortune.com/feed/fortune-feeds/?id=3230629"), # real URL
        ("TechCrunch Startups", "https://techcrunch.com/category/startups/feed/"),
        ("Fast Company",        "https://www.fastcompany.com/technology/rss"),
        ("WSJ Tech",            "https://feeds.a.dj.com/rss/RSSWSJD.xml"),
        ("TechCrunch Venture",  "https://techcrunch.com/category/venture/feed/"),
    ],
    "security": [
        ("Krebs on Security", "https://krebsonsecurity.com/feed/"),
        ("The Hacker News",   "https://feeds.feedburner.com/TheHackersNews"),
        ("Threatpost",        "https://threatpost.com/feed/"),
        ("CyberScoop",        "https://cyberscoop.com/feed/"),
        ("Ars Technica",      "https://feeds.arstechnica.com/arstechnica/index"),  # replaces dead Ars Security (404)
    ],
    "ai": [
        ("MIT Tech Review",  "https://www.technologyreview.com/feed/"),
        ("VentureBeat AI",   "https://venturebeat.com/category/ai/feed"),  # real URL (was /feed/ → 2 items)
        ("Hugging Face Blog","https://huggingface.co/blog/feed.xml"),
        ("TechCrunch AI",    "https://techcrunch.com/category/artificial-intelligence/feed/"),
        ("AI Weekly",        "https://aiweekly.co/issues.rss"),
    ],
    "dev-tools": [
        ("GitHub Blog",   "https://github.blog/feed/"),
        ("The New Stack", "https://thenewstack.io/blog/feed/"),
        ("SD Times",      "https://sdtimes.com/feed/"),              # replaces InfoQ (broken redirect)
        ("Changelog",     "https://changelog.com/feed"),
        ("Dev.to Top",    "https://dev.to/feed/tag/devops"),
    ],
}


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
# Category-specialist feed fetcher (data-driven, uses CATEGORY_RSS_FEEDS)
# ---------------------------------------------------------------------------

async def fetch_primary_sources(categories: list[str], limit: int = 10) -> list[dict[str, Any]]:
    """Fetch from official newsrooms/primary sources for the requested categories.

    Returns items tagged with is_primary=True and category_hint set.
    Driven by PRIMARY_SOURCE_FEEDS — add new entries there to extend coverage.
    """
    import xml.etree.ElementTree as ET
    client = _get_client()
    now = time.time()

    async def fetch_feed(name: str, url: str, category: str) -> list[dict]:
        try:
            r = await client.get(url, headers={"User-Agent": "Mozilla/5.0 (compatible; feed-reader/1.0)"})
            r.raise_for_status()
            root = ET.fromstring(r.text)
            ns = {"atom": "http://www.w3.org/2005/Atom"}
            results: list[dict] = []

            for item in root.findall(".//item")[:limit]:
                title = (item.findtext("title") or "").strip()
                link  = (item.findtext("link")  or "").strip()
                desc  = (item.findtext("description") or "").strip()[:200]
                pub   = item.findtext("pubDate") or ""
                try:
                    import email.utils
                    age_s = now - email.utils.parsedate_to_datetime(pub).timestamp()
                except Exception:
                    age_s = 3600
                if title and link:
                    results.append({
                        "id": f"primary-{hash(link)}",
                        "title": title,
                        "source": name,
                        "source_url": link,
                        "original_url": link,
                        "upvotes": 0,
                        "comments": 0,
                        "age_hours": round(age_s / 3600, 1),
                        "recency_score": round(_recency_score(age_s), 1),
                        "snippet": desc,
                        "is_primary": True,
                        "category_hint": category,
                    })

            if not results:
                for entry in root.findall(".//atom:entry", ns)[:limit]:
                    title   = (entry.findtext("atom:title", namespaces=ns) or "").strip()
                    link_el = entry.find("atom:link", ns)
                    link    = (link_el.get("href") if link_el is not None else "") or ""
                    summary = (entry.findtext("atom:summary", namespaces=ns) or "").strip()[:200]
                    updated = entry.findtext("atom:updated", namespaces=ns) or ""
                    try:
                        from datetime import datetime
                        dt = datetime.fromisoformat(updated.replace("Z", "+00:00"))
                        age_s = now - dt.timestamp()
                    except Exception:
                        age_s = 3600
                    if title and link:
                        results.append({
                            "id": f"primary-{hash(link)}",
                            "title": title,
                            "source": name,
                            "source_url": link,
                            "original_url": link,
                            "upvotes": 0,
                            "comments": 0,
                            "age_hours": round(age_s / 3600, 1),
                            "recency_score": round(_recency_score(age_s), 1),
                            "snippet": summary,
                            "is_primary": True,
                            "category_hint": category,
                        })

            logger.info("primary_feed_fetched", source=name, category=category, count=len(results))
            return results
        except Exception as exc:
            logger.warning("primary_feed_error", source=name, category=category, error=str(exc))
            return []

    coros = [
        fetch_feed(name, url, cat)
        for cat in categories
        for name, url in PRIMARY_SOURCE_FEEDS.get(cat, [])
    ]
    if not coros:
        return []

    nested = await asyncio.gather(*coros, return_exceptions=True)
    flat = [
        item
        for batch in nested
        if not isinstance(batch, Exception)
        for item in batch
    ]
    logger.info("primary_sources_fetched", total=len(flat), categories=categories)
    return flat


async def fetch_category_rss(category: str, limit: int = 10) -> list[dict[str, Any]]:
    """Fetch news from specialist outlets for a given category slug.

    Driven entirely by CATEGORY_RSS_FEEDS — adding a new category requires
    only a new entry in that dict.
    """
    import xml.etree.ElementTree as ET
    client = _get_client()
    now = time.time()
    feeds = CATEGORY_RSS_FEEDS.get(category, [])
    if not feeds:
        logger.warning("category_rss_unknown", category=category)
        return []

    async def fetch_feed(name: str, url: str) -> list[dict]:
        try:
            r = await client.get(url, headers={"User-Agent": "Mozilla/5.0 (compatible; feed-reader/1.0)"})
            r.raise_for_status()
            root = ET.fromstring(r.text)
            ns = {"atom": "http://www.w3.org/2005/Atom"}
            results: list[dict] = []

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
                        "id": f"cat-{hash(link)}",
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
                        from datetime import datetime
                        dt = datetime.fromisoformat(updated.replace("Z", "+00:00"))
                        age_s = now - dt.timestamp()
                    except Exception:
                        age_s = 3600
                    if title and link:
                        results.append({
                            "id": f"cat-{hash(link)}",
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

            logger.info("category_feed_fetched", source=name, category=category, count=len(results))
            return results
        except Exception as exc:
            logger.warning("category_feed_error", source=name, category=category, error=str(exc))
            return []

    nested = await asyncio.gather(*[fetch_feed(name, url) for name, url in feeds])
    flat = [item for sub_list in nested for item in sub_list]
    logger.info("category_rss_fetched", category=category, count=len(flat))
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


# ---------------------------------------------------------------------------
# Parallel pre-fetch — fires all sources simultaneously, caps per source,
# then deduplicates so the LLM ranking call sees a clean, balanced pool.
# ---------------------------------------------------------------------------

def _normalise_title(title: str) -> str:
    """Lowercase, strip punctuation/noise for dedup comparison."""
    import re
    return re.sub(r"[^a-z0-9 ]", "", title.lower()).strip()


async def fetch_all_sources(
    categories: list[str],
    per_source_cap: int = 10,
    hn_cap: int = 20,
    trends_cap: int = 10,
    cat_per_feed: int = 10,
) -> list[dict[str, Any]]:
    """
    Fire every feed in parallel, cap each source, deduplicate, and return
    a balanced pool ready for a single LLM ranking call.

    Sources fetched:
      - Hacker News            (capped at hn_cap, default 20)
      - Tech RSS broad feeds   (capped at per_source_cap each, default 10)
      - Google Trends          (capped at trends_cap, default 10)
      - Category-specialist feeds for every requested category
        (capped at cat_per_feed per outlet, default 10 — independent of
         per_source_cap so broad and specialist feeds can be tuned separately)
    """
    # Force a fresh httpx client for this event loop invocation.
    # The Lambda async-job handler runs inside asyncio.run() which creates a
    # new event loop; reusing a client from a previous loop causes all
    # outbound requests to fail silently, returning an empty pool.
    _reset_client()

    # Build all coroutines — everything fires at once via gather.
    # Primary sources and secondary sources are gathered in parallel;
    # primaries are added to the pool FIRST so they win dedup collisions.
    primary_coro = fetch_primary_sources(categories=categories, limit=cat_per_feed)

    secondary_coros: list[Any] = [
        fetch_hn_stories(limit=hn_cap),
        fetch_reddit_posts(limit=per_source_cap),   # tech RSS broad feeds
        fetch_google_trends_rss(),
    ]
    secondary_labels = ["hn", "tech_rss", "trends"]

    for cat in categories:
        if cat in CATEGORY_RSS_FEEDS:
            secondary_coros.append(fetch_category_rss(category=cat, limit=cat_per_feed))
            secondary_labels.append(f"cat:{cat}")

    # Fire everything in parallel — one gather for all
    all_results = await asyncio.gather(primary_coro, *secondary_coros, return_exceptions=True)
    primary_batch   = all_results[0] if not isinstance(all_results[0], Exception) else []
    secondary_batches = zip(secondary_labels, all_results[1:])

    pool: list[dict] = []

    # ── Primary sources first (they win dedup) ───────────────────────────────
    for item in primary_batch:
        item.setdefault("is_primary", True)
    pool.extend(primary_batch)
    logger.info("fetch_all_primaries_done", count=len(primary_batch))

    # ── Secondary sources ────────────────────────────────────────────────────
    for label, batch in secondary_batches:
        if isinstance(batch, Exception):
            logger.warning("fetch_all_source_error", source=label, error=str(batch))
            continue
        capped = batch[:hn_cap] if label == "hn" else batch[:trends_cap] if label == "trends" else batch
        cat_hint = label.split(":")[1] if label.startswith("cat:") else None
        for item in capped:
            item.setdefault("category_hint", cat_hint)
            item.setdefault("is_primary", False)
        pool.extend(capped)
        logger.info("fetch_all_source_done", source=label, count=len(capped))

    # Deduplicate: keep first occurrence of any title that is >70% similar
    seen: list[str] = []
    deduped: list[dict] = []
    for item in pool:
        norm = _normalise_title(item.get("title", ""))
        if not norm:
            continue
        # Simple word-overlap dedup — fast, no external deps
        words = set(norm.split())
        is_dup = any(
            len(words & set(s.split())) / max(len(words | set(s.split())), 1) > 0.7
            for s in seen
        )
        if not is_dup:
            seen.append(norm)
            deduped.append(item)

    logger.info("fetch_all_sources_done", raw=len(pool), deduped=len(deduped))
    return deduped
