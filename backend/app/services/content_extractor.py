"""
URL content extractor — fetches a URL and returns clean readable text.
Used as a tool in the research ReAct agent.
Falls back gracefully through readability → BeautifulSoup → raw text.
"""
from __future__ import annotations
import re
from typing import Any
import httpx
import structlog

logger = structlog.get_logger()

_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            timeout=20.0,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (compatible; BreakingChanges-AIWriter/1.0; "
                    "+https://breakchange.com/)"
                )
            },
            follow_redirects=True,
        )
    return _client


def _clean_text(text: str) -> str:
    """Remove excess whitespace and very short lines."""
    lines = text.splitlines()
    cleaned = [ln.strip() for ln in lines if len(ln.strip()) > 20]
    return "\n".join(cleaned)


async def extract_content(url: str, max_chars: int = 8000) -> dict[str, Any]:
    """
    Fetch a URL and extract the main article text.
    Returns: {"url": str, "title": str, "text": str, "error": str|None}
    """
    if not url or not url.startswith("http"):
        return {"url": url, "title": "", "text": "", "error": "Invalid URL"}

    client = _get_client()
    try:
        resp = await client.get(url)
        resp.raise_for_status()
        content_type = resp.headers.get("content-type", "")
        if "text/html" not in content_type and "application/xhtml" not in content_type:
            return {"url": url, "title": "", "text": resp.text[:max_chars], "error": None}

        html = resp.text

        # Try readability-style extraction via lxml
        try:
            from bs4 import BeautifulSoup

            soup = BeautifulSoup(html, "lxml")

            # Get title
            title = ""
            if soup.title:
                title = soup.title.get_text(strip=True)
            og_title = soup.find("meta", property="og:title")
            if og_title and og_title.get("content"):
                title = og_title["content"]

            # Remove boilerplate elements
            for tag in soup(["script", "style", "nav", "footer", "header", "aside",
                              "form", "button", "noscript", "iframe", "svg", "figure"]):
                tag.decompose()

            # Try to find the main article element
            article = (
                soup.find("article")
                or soup.find(attrs={"role": "main"})
                or soup.find("main")
                or soup.find(id=re.compile(r"(article|content|main|post|story)", re.I))
                or soup.find(class_=re.compile(r"(article|content|main|post|story|body)", re.I))
            )

            target = article or soup.find("body") or soup
            text = _clean_text(target.get_text(separator="\n"))
            text = text[:max_chars]

            logger.info("extracted_content", url=url, chars=len(text))
            return {"url": url, "title": title, "text": text, "error": None}

        except Exception as parse_exc:
            logger.warning("html_parse_fallback", url=url, error=str(parse_exc))
            # Raw text fallback: strip tags with regex
            clean = re.sub(r"<[^>]+>", " ", html)
            clean = re.sub(r"\s+", " ", clean).strip()
            return {"url": url, "title": "", "text": clean[:max_chars], "error": None}

    except httpx.HTTPStatusError as exc:
        logger.warning("extract_http_error", url=url, status=exc.response.status_code)
        return {"url": url, "title": "", "text": "", "error": f"HTTP {exc.response.status_code}"}
    except Exception as exc:
        logger.warning("extract_error", url=url, error=str(exc))
        return {"url": url, "title": "", "text": "", "error": str(exc)}
