"""
AI Writer orchestration — wires the ReAct agents and generation pipeline together.

Three phases:
  1. discover_topics()  — ReAct agent w/ HN/Reddit/NewsAPI/Trends tools
  2. research_topic()   — ReAct agent w/ URL content-extraction tool
  3. generate_article() — single LLM call using the research brief
"""
from __future__ import annotations
import json
import re
import time
from typing import Any
import httpx
import structlog

from app.config import settings
from app.services.llm import (
    ReactAgent, single_call,
    DISCOVERY_SYSTEM, RESEARCH_SYSTEM, GENERATION_SYSTEM, METADATA_SYSTEM,
)
from app.services.trend_fetcher import (
    fetch_hn_stories,
    fetch_reddit_posts,
    fetch_newsapi_headlines,
    fetch_google_trends_rss,
)
from app.services.content_extractor import extract_content

logger = structlog.get_logger()


# ---------------------------------------------------------------------------
# Tool schemas — Bedrock Converse API format
# ---------------------------------------------------------------------------

DISCOVERY_TOOLS = [
    {
        "toolSpec": {
            "name": "fetch_hn_stories",
            "description": (
                "Fetch top stories from Hacker News. Returns a list of stories with "
                "title, source URL, upvote score, comment count, age in hours, and recency score."
            ),
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "limit": {
                            "type": "integer",
                            "description": "Maximum number of stories to fetch (default: 30, max: 50)",
                        }
                    },
                    "required": [],
                }
            },
        }
    },
    {
        "toolSpec": {
            "name": "fetch_reddit_posts",
            "description": (
                "Fetch recent articles from major tech news RSS feeds: TechCrunch, Ars Technica, "
                "The Verge, Wired, VentureBeat. Returns articles with title, source, link, and age."
            ),
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "subreddits": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": (
                                "Which subreddits to check. Leave empty to check all defaults. "
                                "Example: ['MachineLearning', 'netsec']"
                            ),
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Posts per subreddit (default: 10)",
                        },
                    },
                    "required": [],
                }
            },
        }
    },
    {
        "toolSpec": {
            "name": "fetch_newsapi_headlines",
            "description": (
                "Fetch trending developer/tech articles from Dev.to (free, no key required). "
                "Returns recent articles with title, reactions, comments, and description."
            ),
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Optional keyword search query (e.g., 'AI', 'cybersecurity')",
                        },
                        "category": {
                            "type": "string",
                            "description": "News category (default: 'technology')",
                        },
                    },
                    "required": [],
                }
            },
        }
    },
    {
        "toolSpec": {
            "name": "fetch_google_trends",
            "description": (
                "Fetch daily trending searches from Google Trends RSS feed for the US. "
                "Returns trending search topics with approximate search volume."
            ),
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {},
                    "required": [],
                }
            },
        }
    },
]

RESEARCH_TOOLS = [
    {
        "toolSpec": {
            "name": "fetch_url_content",
            "description": (
                "Fetch the text content of a URL. Extracts the main article body, "
                "removing navigation, ads, and boilerplate. Returns the page title and clean text."
            ),
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "url": {
                                    "description": "The full URL to fetch (must start with http:// or https://)",
                        }
                    },
                    "required": ["url"],
                }
            },
        }
    }
]


# ---------------------------------------------------------------------------
# Tool executors
# ---------------------------------------------------------------------------

async def _discovery_tool_executor(tool_name: str, inputs: dict) -> Any:
    if tool_name == "fetch_hn_stories":
        return await fetch_hn_stories(limit=inputs.get("limit", 30))
    elif tool_name == "fetch_reddit_posts":
        return await fetch_reddit_posts(
            subreddits=inputs.get("subreddits"),
            limit=inputs.get("limit", 10),
        )
    elif tool_name == "fetch_newsapi_headlines":
        return await fetch_newsapi_headlines(
            query=inputs.get("query", ""),
            category=inputs.get("category", "technology"),
            api_key=settings.NEWSAPI_KEY,
        )
    elif tool_name == "fetch_google_trends":
        return await fetch_google_trends_rss()
    else:
        return {"error": f"Unknown tool: {tool_name}"}


async def _research_tool_executor(tool_name: str, inputs: dict) -> Any:
    if tool_name == "fetch_url_content":
        return await extract_content(inputs.get("url", ""))
    else:
        return {"error": f"Unknown tool: {tool_name}"}


# ---------------------------------------------------------------------------
# JSON extraction helper
# ---------------------------------------------------------------------------

def _extract_json(text: str) -> Any:
    """
    Robustly extract JSON from LLM output that may include stray text.
    Tries: direct parse → strip markdown fences → find first [ or { block.
    """
    text = text.strip()

    # Direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Strip markdown code fences
    stripped = re.sub(r"^```(?:json)?\n?", "", text, flags=re.MULTILINE)
    stripped = re.sub(r"\n?```$", "", stripped, flags=re.MULTILINE).strip()
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass

    # Find first JSON array or object
    for start_char, end_char in [("[", "]"), ("{", "}")]:
        start = text.find(start_char)
        end = text.rfind(end_char)
        if start != -1 and end > start:
            try:
                return json.loads(text[start:end + 1])
            except json.JSONDecodeError:
                pass

    return None


# ---------------------------------------------------------------------------
# Phase 1 — Discover topics
# ---------------------------------------------------------------------------

async def discover_topics(categories: list[str]) -> list[dict]:
    """
    Run the discovery ReAct agent to find and rank trending topics.
    The agent calls trend-fetching tools iteratively until it has
    enough signal to produce a ranked JSON list.
    """
    agent = ReactAgent(model=settings.LLM_MODEL)
    categories_str = ", ".join(categories)
    system = DISCOVERY_SYSTEM.format(categories=categories_str)

    user_message = (
        f"Find the top trending tech stories right now that would be relevant to "
        f"Breaking Changes readers. Focus on these categories: {categories_str}. "
        f"Check multiple sources (Hacker News, Reddit, Google Trends, and NewsAPI if available) "
        f"and reason carefully about which stories are most newsworthy and relevant."
    )

    logger.info("discovery_agent_start", categories=categories)
    result_text = await agent.run(
        system_prompt=system,
        user_message=user_message,
        tools=DISCOVERY_TOOLS,
        tool_executor=_discovery_tool_executor,
    )

    topics = _extract_json(result_text)
    if not isinstance(topics, list):
        logger.warning("discovery_bad_output", text_preview=result_text[:300])
        return []

    # Normalise and sort
    for t in topics:
        t.setdefault("score", 50)
        t.setdefault("snippet", "")
        t.setdefault("signals", {})

    topics.sort(key=lambda x: x.get("score", 0), reverse=True)
    logger.info("discovery_agent_done", topic_count=len(topics))
    return topics[:10]


# ---------------------------------------------------------------------------
# Phase 2 — Research a topic
# ---------------------------------------------------------------------------

async def research_topic(title: str, urls: list[str], category: str) -> dict:
    """
    Run the research ReAct agent.
    The agent fetches source URLs iteratively, reasons about the content,
    decides when it has enough, and returns a structured research brief.
    """
    agent = ReactAgent(model=settings.LLM_MODEL)
    system = RESEARCH_SYSTEM.format(title=title, category=category)

    urls_str = "\n".join(f"- {u}" for u in urls[:5]) if urls else "(no URLs provided)"
    user_message = (
        f"Build a research brief for this story: \"{title}\"\n"
        f"Category: {category}\n\n"
        f"Available source URLs to investigate:\n{urls_str}\n\n"
        f"Use the fetch_url_content tool to get the actual content from these sources. "
        f"Start with the most authoritative-looking URL. Fetch additional sources as needed "
        f"until you have enough facts, context, and quotes to write a complete article."
    )

    logger.info("research_agent_start", title=title, url_count=len(urls))
    result_text = await agent.run(
        system_prompt=system,
        user_message=user_message,
        tools=RESEARCH_TOOLS,
        tool_executor=_research_tool_executor,
    )

    brief = _extract_json(result_text)
    if not isinstance(brief, dict):
        logger.warning("research_bad_output", text_preview=result_text[:300])
        # Return a minimal brief so the pipeline can continue
        return {
            "title": title,
            "category": category,
            "key_facts": [],
            "key_quotes": [],
            "sources": [{"url": u, "title": "", "excerpt": ""} for u in urls[:3]],
            "suggested_angles": [],
            "cover_image_query": category,
        }

    brief.setdefault("title", title)
    brief.setdefault("category", category)
    logger.info("research_agent_done", fact_count=len(brief.get("key_facts", [])))
    return brief


# ---------------------------------------------------------------------------
# Phase 3 — Generate article body HTML
# ---------------------------------------------------------------------------

async def generate_body(brief: dict, word_count: int = 600) -> str:
    """Single LLM call to generate the article body HTML from the research brief."""
    system = GENERATION_SYSTEM.format(word_count=word_count)
    user_message = (
        f"Write an article based on this research brief:\n\n"
        f"{json.dumps(brief, indent=2)}\n\n"
        f"Target: {word_count} words of body HTML. "
        f"Use the key facts and quotes from the brief. "
        f"Structure with clear H2 sections. Short, direct paragraphs."
    )

    logger.info("generation_start", title=brief.get("title"), word_count=word_count)
    body_html = await single_call(
        model=settings.LLM_MODEL,
        system_prompt=system,
        user_message=user_message,
    )
    logger.info("generation_done", chars=len(body_html))
    return body_html


# ---------------------------------------------------------------------------
# Phase 3b — Generate article metadata (title, SEO, tags, etc.)
# ---------------------------------------------------------------------------

async def generate_metadata(brief: dict, body_html: str) -> dict:
    """Generate article metadata from the brief + body HTML."""
    user_message = (
        f"Research brief:\n{json.dumps(brief, indent=2)}\n\n"
        f"Article body (first 2000 chars):\n{body_html[:2000]}\n\n"
        f"Generate the article metadata JSON."
    )

    result = await single_call(
        model=settings.LLM_MODEL,
        system_prompt=METADATA_SYSTEM,
        user_message=user_message,
    )

    meta = _extract_json(result)
    if not isinstance(meta, dict):
        meta = {}

    meta.setdefault("title", brief.get("title", "Untitled"))
    meta.setdefault("subtitle", "")
    meta.setdefault("excerpt", "")
    meta.setdefault("tags", [])
    meta.setdefault("seo_title", meta["title"][:60])
    meta.setdefault("seo_description", meta.get("excerpt", "")[:160])
    meta.setdefault("cover_image_query", brief.get("cover_image_query", brief.get("category", "")))
    return meta


# ---------------------------------------------------------------------------
# Unsplash cover image fetcher
# ---------------------------------------------------------------------------

async def fetch_cover_image(query: str) -> str | None:
    """Fetch a cover image URL from Unsplash search (free tier)."""
    if not settings.UNSPLASH_ACCESS_KEY or not query:
        return None
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://api.unsplash.com/search/photos",
                params={"query": query, "per_page": 1, "orientation": "landscape"},
                headers={"Authorization": f"Client-ID {settings.UNSPLASH_ACCESS_KEY}"},
            )
            resp.raise_for_status()
            results = resp.json().get("results", [])
            if results:
                url = results[0]["urls"]["regular"]
                # Add UTM params for Unsplash attribution
                return url + "&utm_source=breaking_changes&utm_medium=referral"
    except Exception as exc:
        logger.warning("unsplash_error", error=str(exc))
    return None
