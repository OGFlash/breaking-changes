"""AI Writer orchestration - wires the generation pipeline together.

Three phases:
  1. discover_topics()  - parallel feed fetch + single LLM ranking call
  2. research_topic()   - ReAct agent w/ URL content-extraction tool
  3. generate_article() - single LLM call using the research brief
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
    ReactAgent, single_call, rank_topics,
    RESEARCH_SYSTEM, GENERATION_SYSTEM, METADATA_SYSTEM,
)
from app.services.trend_fetcher import (
    fetch_all_sources,
    CATEGORY_RSS_FEEDS,
)
from app.services.content_extractor import extract_content

logger = structlog.get_logger()


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
    Phase 1 — Discovery.
    Fires all feeds in parallel (no LLM involvement), deduplicates the
    pool, then makes a single LLM call to score and rank the results.
    Each source is capped before ranking so no single outlet can dominate.
    """
    logger.info("discovery_fetch_start", categories=categories)
    pool = await fetch_all_sources(categories=categories, per_source_cap=5)
    if not pool:
        logger.warning("discovery_empty_pool")
        return []

    logger.info("discovery_ranking_start", pool_size=len(pool))
    result_text = await rank_topics(articles=pool, categories=categories, top_n=20)

    topics = _extract_json(result_text)
    if not isinstance(topics, list) or len(topics) == 0:
        logger.warning("discovery_ranking_failed_using_fallback", text_preview=(result_text or "")[:300])
        # Fallback: sort pool by recency_score and return top 20 directly
        pool.sort(key=lambda x: x.get("recency_score", 0), reverse=True)
        for item in pool:
            item.setdefault("score", int(item.get("recency_score", 50)))
            item.setdefault("signals", {"upvotes": item.get("upvotes", 0), "comments": item.get("comments", 0), "age_hours": item.get("age_hours", 0)})
            item.setdefault("category", categories[0] if categories else "ai")
        return pool[:20]

    for t in topics:
        t.setdefault("score", 50)
        t.setdefault("snippet", "")
        t.setdefault("signals", {})

    topics.sort(key=lambda x: x.get("score", 0), reverse=True)
    logger.info("discovery_done", topic_count=len(topics))
    return topics[:20]


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
