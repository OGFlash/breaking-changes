"""
LLM service — wraps AWS Bedrock Runtime (Converse API) with a ReAct (Reason + Act) loop.

Uses boto3 (sync) via asyncio.to_thread for async-compatible Bedrock calls.
Authentication is handled automatically by the Lambda execution role — no API key required.

The ReAct pattern:
  1. Claude REASONS about what to do next (visible in pre-tool text)
  2. Claude ACTS by calling one or more tools
  3. We execute the tools and feed results back as observations
  4. Claude REASONS again with new info, decides whether to act again or conclude
  5. Repeat until Claude reaches end_turn (final answer) or max_iterations

Tool schema format expected (Bedrock Converse):
  {
    "toolSpec": {
      "name": "tool_name",
      "description": "...",
      "inputSchema": { "json": { "type": "object", "properties": {...}, "required": [...] } }
    }
  }
"""
from __future__ import annotations
import asyncio
import json
from typing import Any, Callable, Awaitable
import boto3
import structlog

from app.config import settings

logger = structlog.get_logger()

MAX_REACT_ITERATIONS = 12

# ---------------------------------------------------------------------------
# System prompts
# ---------------------------------------------------------------------------

RANKING_SYSTEM = """\
You are a news editor for Breaking Changes, a tech publication covering
AI, machine learning, cybersecurity, developer tools, gaming, and the tech industry.

You will be given a pool of articles collected from multiple sources.
Your ONLY job is to score and rank them.

Target categories: {categories}

Scoring guide (0–100):
- Category relevance to Breaking Changes audience: 40%
- Recency (lower age_hours = higher score): 30%
- Engagement (upvotes + comments relative to source norms): 20%
- Source authority (major outlets > blogs): 10%

Rules:
- Assign each article a category from the target list (best match).
- Score every article honestly — do not inflate scores.
- Aim for a spread across categories; do not let one source dominate.
- Only include articles with score >= 40.
- Return the top 20, ranked by score descending.

Return ONLY a valid JSON array (no markdown, no explanation):
[
  {{
    "id": "<copy from input>",
    "title": "<copy from input>",
    "source": "<copy from input>",
    "category": "<best matching category>",
    "score": <integer 0-100>,
    "signals": {{"upvotes": <int>, "comments": <int>, "age_hours": <float>}},
    "snippet": "<1-2 sentence summary>"
  }},
  ...
]

Return ONLY the JSON array — no surrounding text.
"""

RESEARCH_SYSTEM = """\
You are a research editor for Breaking Changes, a tech publication for developers.

Your job: build a research brief for this story: "{title}" (category: {category})

Use the fetch_url_content tool to fetch source materials. Follow the ReAct pattern:
- REASON: Which URLs are most likely to have good coverage? Start with the primary source.
- ACT: Call fetch_url_content for the most important URL
- OBSERVE: What facts, quotes, and context did you find?
- REASON: Do you need more sources? Is there a key angle missing?
- ACT: Fetch additional URLs if needed
- Repeat until you have enough facts for a complete, accurate article brief.

You typically need 2–3 sources. Stop fetching when you have enough facts.

When done, return ONLY a valid JSON object (no markdown):
{{
  "title": "<topic title>",
  "category": "<category>",
  "key_facts": ["<fact 1>", "<fact 2>", ...],
  "key_quotes": [{{"quote": "<text>", "attribution": "<who said it>"}}],
  "sources": [{{"url": "<url>", "title": "<page title>", "excerpt": "<key excerpt>"}}],
  "suggested_angles": ["<angle 1>", "<angle 2>"],
  "cover_image_query": "<unsplash search query for a relevant photo>"
}}

Return ONLY the JSON object when done — no surrounding text.
"""

GENERATION_SYSTEM = """\
You are a staff writer for Breaking Changes, a tech news publication covering AI,
cybersecurity, developer tools, gaming, and the tech industry.

Your voice is:
- Direct and confident, not hype-driven
- Technical but accessible — assumes a developer audience
- Structured with clear H2 headings, short paragraphs (2–4 sentences each)
- Factual: only assert things supported by the research brief provided
- No filler phrases like "In conclusion" or "It's worth noting"

Output ONLY valid HTML (p, h2, h3, ul, li, strong, em, blockquote).
Do NOT include the article title, byline, or any text outside the body HTML.
Target length: {word_count} words.

Return the raw HTML string only — no markdown code fences, no explanation.
"""

METADATA_SYSTEM = """\
You are a metadata editor for a tech publication. Given an article's body HTML and research brief,
produce the article metadata JSON.

Return ONLY a valid JSON object (no markdown):
{{
  "title": "<punchy, specific headline (max 80 chars)>",
  "subtitle": "<one-sentence expanding on the title (max 120 chars)>",
  "excerpt": "<2-sentence summary for article cards (max 160 chars)>",
  "tags": ["<tag1>", "<tag2>", "<tag3>", "<tag4>"],
  "seo_title": "<SEO title, keyword-first (max 60 chars)>",
  "seo_description": "<meta description (max 160 chars)>",
  "cover_image_query": "<unsplash search query>"
}}
"""


# ---------------------------------------------------------------------------
# rank_topics — single-call ranker (replaces discovery ReAct agent)
# ---------------------------------------------------------------------------

async def rank_topics(
    articles: list[dict],
    categories: list[str],
    top_n: int = 20,
    region: str | None = None,
) -> list[dict]:
    """
    Single Bedrock call: send the pre-fetched article pool to the LLM,
    get back a scored and ranked JSON list.
    """
    import json as _json
    categories_str = ", ".join(categories)
    system = RANKING_SYSTEM.format(categories=categories_str)

    # Send only what the LLM needs for ranking — no URLs (we restore them
    # from url_lookup after the call), snippets trimmed to 120 chars.
    # Input is already pre-selected to ~25 items so token budget is safe.
    slim = [
        {
            "id": a.get("id", ""),
            "title": a.get("title", ""),
            "source": a.get("source", ""),
            "age_hours": a.get("age_hours", 0),
            "upvotes": a.get("upvotes", 0),
            "comments": a.get("comments", 0),
            "snippet": (a.get("snippet") or "")[:120],
        }
        for a in articles
    ]

    user_message = (
        f"Here are {len(slim)} articles from multiple sources.\n"
        f"Target categories: {categories_str}\n\n"
        f"{_json.dumps(slim, indent=2)}\n\n"
        f"Score and return the top {top_n} as described."
    )

    logger.info("rank_topics_start", pool_size=len(slim), categories=categories)
    result = await single_call(
        model=settings.LLM_MODEL,
        system_prompt=system,
        user_message=user_message,
        max_tokens=4096,
        region=region,
    )
    logger.info("rank_topics_done")
    return result


# ---------------------------------------------------------------------------
# ReAct loop engine — Bedrock Converse API (sync boto3 via asyncio.to_thread)
# ---------------------------------------------------------------------------

def _get_bedrock_client(region: str):
    """Return a sync boto3 bedrock-runtime client. Cached per region is fine in Lambda."""
    return boto3.client("bedrock-runtime", region_name=region)


class ReactAgent:
    """
    Drives a ReAct loop using the AWS Bedrock Runtime Converse API.
    boto3 calls are sync; we offload each to asyncio.to_thread so the
    FastAPI async event loop is not blocked.
    """

    def __init__(self, model: str, region: str | None = None):
        self.model = model
        self.region = region or settings.AWS_DEFAULT_REGION or "us-east-1"

    async def run(
        self,
        system_prompt: str,
        user_message: str,
        tools: list[dict],
        tool_executor: Callable[[str, dict], Awaitable[Any]],
        max_iterations: int = MAX_REACT_ITERATIONS,
    ) -> str:
        """Run the ReAct loop. Returns the final text output from the model."""
        client = _get_bedrock_client(self.region)
        messages: list[dict] = [{"role": "user", "content": [{"text": user_message}]}]
        iteration = 0
        response_text = ""

        while iteration < max_iterations:
            iteration += 1
            logger.info("react_iteration", iteration=iteration, model=self.model)

            kwargs: dict = {
                "modelId": self.model,
                "system": [{"text": system_prompt}],
                "messages": messages,
                "inferenceConfig": {"maxTokens": 8192},
            }
            if tools:
                kwargs["toolConfig"] = {"tools": tools}

            response = await asyncio.to_thread(client.converse, **kwargs)

            stop_reason = response.get("stopReason", "end_turn")
            content_blocks = response["output"]["message"].get("content", [])

            response_text = ""
            tool_uses = []
            for block in content_blocks:
                if "text" in block:
                    response_text += block["text"]
                elif "toolUse" in block:
                    tool_uses.append(block["toolUse"])

            logger.info(
                "react_response",
                stop_reason=stop_reason,
                tool_calls=[t["name"] for t in tool_uses],
                text_preview=(response_text[:120] if response_text else ""),
            )

            if stop_reason in ("end_turn", "stop_sequence") or not tool_uses:
                return response_text.strip()

            # --- ACT ---
            messages.append({"role": "assistant", "content": content_blocks})

            tool_results = []
            for tool_use in tool_uses:
                tool_id = tool_use["toolUseId"]
                tool_name = tool_use["name"]
                tool_input = tool_use.get("input", {})

                logger.info("react_tool_call", tool=tool_name, inputs=tool_input)
                try:
                    result = await tool_executor(tool_name, tool_input)
                    result_str = (
                        json.dumps(result, default=str)
                        if not isinstance(result, str)
                        else result
                    )
                except Exception as exc:
                    logger.warning("react_tool_error", tool=tool_name, error=str(exc))
                    result_str = json.dumps({"error": str(exc)})

                tool_results.append({
                    "toolResult": {
                        "toolUseId": tool_id,
                        "content": [{"text": result_str}],
                    }
                })

            # --- OBSERVE ---
            messages.append({"role": "user", "content": tool_results})

        logger.warning("react_max_iterations_reached", max=max_iterations)
        return response_text.strip()


# ---------------------------------------------------------------------------
# Simple single-shot call (for article generation and metadata)
# ---------------------------------------------------------------------------

async def single_call(
    model: str,
    system_prompt: str,
    user_message: str,
    max_tokens: int = 8192,
    region: str | None = None,
) -> str:
    """Single Bedrock Converse call — no tools, no loop. Returns the response text."""
    _region = region or settings.AWS_DEFAULT_REGION or "us-east-1"
    client = _get_bedrock_client(_region)

    response = await asyncio.to_thread(
        client.converse,
        modelId=model,
        system=[{"text": system_prompt}],
        messages=[{"role": "user", "content": [{"text": user_message}]}],
        inferenceConfig={"maxTokens": max_tokens},
    )
    for block in response["output"]["message"].get("content", []):
        if "text" in block:
            return block["text"].strip()
    return ""

