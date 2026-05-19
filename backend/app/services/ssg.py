"""Static Site Generation service.

For every published article we write a fully-rendered HTML file to the
frontend S3 bucket at ssg/article/{slug}.html.

CloudFront routes /article/{slug} → that HTML file so Googlebot (and users
arriving directly from search) immediately receive the full page content —
no JavaScript execution required.  The page includes:
  • Correct <title> / <meta description> / canonical URL
  • Open Graph + Twitter Card meta tags
  • JSON-LD Article structured data (Google rich results)
  • The full article body HTML
  • A basic but readable layout with inline CSS
  • Links back into the React SPA for navigation

If the pre-rendered file does not yet exist (old articles before this feature,
drafts) CloudFront's existing 403→/index.html error response falls back
gracefully to the React SPA.
"""
from __future__ import annotations
import json
import html as _html
from typing import Any
import structlog

from app.config import settings
from app.services.s3 import put_text, delete_object

logger = structlog.get_logger()

DOMAIN = "https://breakchange.com"


def _esc(value: Any) -> str:
    """HTML-escape a value for safe attribute / text use."""
    return _html.escape(str(value or ""), quote=True)


def render_article_html(article: dict) -> str:
    """Render a published article dict to a complete HTML string."""
    slug            = article.get("slug", "")
    title           = article.get("title", "Breaking Changes")
    seo_title       = article.get("seo_title") or title
    seo_desc        = article.get("seo_description") or article.get("excerpt", "")
    excerpt         = article.get("excerpt", "")
    body_html       = article.get("body_html") or article.get("body", "")
    cover_image     = article.get("cover_image_url") or article.get("cover_image", "")
    published_at    = (article.get("published_at") or "")[:10]
    updated_at      = (article.get("updated_at") or published_at or "")[:10]
    category        = article.get("category") or {}
    cat_name        = category.get("name", "Tech")
    cat_slug        = category.get("slug", "")
    author          = article.get("author") or {}
    author_name     = author.get("name", "Breaking Changes")
    author_slug     = author.get("slug", "")
    tags            = article.get("tags") or []
    canonical       = f"{DOMAIN}/article/{slug}"

    # JSON-LD structured data
    jsonld = {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "headline": title,
        "description": seo_desc or excerpt,
        "image": [cover_image] if cover_image else [],
        "datePublished": published_at,
        "dateModified": updated_at,
        "author": [{
            "@type": "Person",
            "name": author_name,
            "url": f"{DOMAIN}/author/{author_slug}" if author_slug else DOMAIN,
        }],
        "publisher": {
            "@type": "Organization",
            "name": "Breaking Changes",
            "url": DOMAIN,
            "logo": {
                "@type": "ImageObject",
                "url": f"{DOMAIN}/favicon.svg",
            },
        },
        "mainEntityOfPage": {"@type": "WebPage", "@id": canonical},
    }

    tags_html = "".join(
        f'<a href="{DOMAIN}/tag/{_esc(t)}" class="tag">#{_esc(t)}</a>'
        for t in tags
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{_esc(seo_title)} — Breaking Changes</title>
  <meta name="description" content="{_esc(seo_desc or excerpt)}" />
  <link rel="canonical" href="{canonical}" />

  <!-- Open Graph -->
  <meta property="og:type"        content="article" />
  <meta property="og:title"       content="{_esc(title)}" />
  <meta property="og:description" content="{_esc(excerpt or seo_desc)}" />
  <meta property="og:url"         content="{canonical}" />
  <meta property="og:site_name"   content="Breaking Changes" />
  {f'<meta property="og:image" content="{_esc(cover_image)}" />' if cover_image else ""}
  <meta property="article:published_time" content="{_esc(published_at)}" />
  <meta property="article:modified_time"  content="{_esc(updated_at)}" />
  <meta property="article:section"        content="{_esc(cat_name)}" />
  {"".join(f'<meta property="article:tag" content="{_esc(t)}" />' for t in tags)}

  <!-- Twitter Card -->
  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:title"       content="{_esc(title)}" />
  <meta name="twitter:description" content="{_esc(excerpt or seo_desc)}" />
  {f'<meta name="twitter:image" content="{_esc(cover_image)}" />' if cover_image else ""}

  <!-- JSON-LD structured data -->
  <script type="application/ld+json">{json.dumps(jsonld, ensure_ascii=False)}</script>

  <!-- Fonts (same as the SPA) -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />

  <style>
    *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
    :root {{
      --bg: #0f0f14;
      --surface: #1a1a24;
      --border: #2a2a3a;
      --text: #e8e8f0;
      --text-muted: #8888aa;
      --accent: #6366f1;
      --accent-hover: #818cf8;
      --font-sans: 'Inter', system-ui, sans-serif;
      --font-display: 'Syne', sans-serif;
    }}
    body {{
      background: var(--bg);
      color: var(--text);
      font-family: var(--font-sans);
      font-size: 17px;
      line-height: 1.7;
    }}
    a {{ color: var(--accent-hover); text-decoration: none; }}
    a:hover {{ text-decoration: underline; }}

    /* Nav */
    .nav {{
      border-bottom: 1px solid var(--border);
      padding: 0 1.5rem;
    }}
    .nav-inner {{
      max-width: 900px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 56px;
    }}
    .nav-logo {{
      font-family: var(--font-display);
      font-size: 1.1rem;
      font-weight: 800;
      color: var(--text);
      letter-spacing: -0.02em;
    }}
    .nav-links a {{
      color: var(--text-muted);
      font-size: 0.875rem;
      margin-left: 1.5rem;
    }}

    /* Article */
    .article-wrapper {{
      max-width: 760px;
      margin: 0 auto;
      padding: 3rem 1.5rem 5rem;
    }}
    .article-meta {{
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
      font-size: 0.8rem;
      color: var(--text-muted);
    }}
    .category-badge {{
      background: var(--accent);
      color: #fff;
      border-radius: 4px;
      padding: 2px 8px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      text-decoration: none !important;
    }}
    .article-title {{
      font-family: var(--font-display);
      font-size: clamp(1.75rem, 5vw, 2.5rem);
      font-weight: 800;
      line-height: 1.2;
      letter-spacing: -0.03em;
      margin-bottom: 1rem;
    }}
    .article-excerpt {{
      font-size: 1.1rem;
      color: var(--text-muted);
      margin-bottom: 2rem;
      line-height: 1.6;
    }}
    .cover-image {{
      width: 100%;
      border-radius: 8px;
      margin-bottom: 2.5rem;
      max-height: 480px;
      object-fit: cover;
      display: block;
    }}
    .article-body h2 {{
      font-family: var(--font-display);
      font-size: 1.4rem;
      font-weight: 700;
      margin: 2rem 0 0.75rem;
      letter-spacing: -0.02em;
    }}
    .article-body h3 {{
      font-size: 1.1rem;
      font-weight: 600;
      margin: 1.5rem 0 0.5rem;
    }}
    .article-body p {{ margin-bottom: 1.1rem; }}
    .article-body ul, .article-body ol {{
      margin: 0.75rem 0 1rem 1.5rem;
    }}
    .article-body li {{ margin-bottom: 0.35rem; }}
    .article-body blockquote {{
      border-left: 3px solid var(--accent);
      padding: 0.5rem 0 0.5rem 1.25rem;
      margin: 1.5rem 0;
      color: var(--text-muted);
      font-style: italic;
    }}
    .article-body strong {{ color: var(--text); font-weight: 600; }}
    .article-body a {{ color: var(--accent-hover); }}
    .article-body code {{
      background: var(--surface);
      border-radius: 4px;
      padding: 2px 6px;
      font-size: 0.875em;
      font-family: 'JetBrains Mono', monospace;
    }}
    .article-body pre {{
      background: var(--surface);
      border-radius: 8px;
      padding: 1rem;
      overflow-x: auto;
      margin: 1rem 0;
    }}
    .article-body pre code {{ background: none; padding: 0; }}

    /* Tags */
    .tags {{ display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 2.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border); }}
    .tag {{
      background: var(--surface);
      border: 1px solid var(--border);
      color: var(--text-muted);
      border-radius: 4px;
      padding: 3px 10px;
      font-size: 0.8rem;
    }}
    .tag:hover {{ color: var(--text); border-color: var(--accent); text-decoration: none; }}

    /* Author row */
    .author-row {{
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 2rem;
      padding: 1rem;
      background: var(--surface);
      border-radius: 8px;
      border: 1px solid var(--border);
    }}
    .author-avatar {{
      width: 40px; height: 40px; border-radius: 50%;
      background: var(--border);
      object-fit: cover;
    }}
    .author-name {{ font-weight: 600; font-size: 0.9rem; }}
    .author-date {{ font-size: 0.8rem; color: var(--text-muted); }}

    /* Footer */
    .footer {{
      border-top: 1px solid var(--border);
      padding: 2rem 1.5rem;
      text-align: center;
      font-size: 0.8rem;
      color: var(--text-muted);
    }}
    .footer a {{ color: var(--text-muted); margin: 0 0.5rem; }}
    .footer a:hover {{ color: var(--text); }}

    @media (prefers-color-scheme: light) {{
      :root {{
        --bg: #ffffff;
        --surface: #f4f4f8;
        --border: #e0e0ec;
        --text: #111118;
        --text-muted: #555568;
      }}
    }}
  </style>
</head>
<body>

<nav class="nav">
  <div class="nav-inner">
    <a href="{DOMAIN}" class="nav-logo">Breaking Changes</a>
    <div class="nav-links">
      <a href="{DOMAIN}/category/ai">AI</a>
      <a href="{DOMAIN}/category/gaming">Gaming</a>
      <a href="{DOMAIN}/category/security">Security</a>
      <a href="{DOMAIN}/category/dev-tools">Dev Tools</a>
      <a href="{DOMAIN}/category/business">Business</a>
    </div>
  </div>
</nav>

<article class="article-wrapper" itemscope itemtype="https://schema.org/NewsArticle">

  <div class="article-meta">
    {f'<a href="{DOMAIN}/category/{_esc(cat_slug)}" class="category-badge">{_esc(cat_name)}</a>' if cat_slug else ""}
    {f'<time datetime="{_esc(published_at)}">{_esc(published_at)}</time>' if published_at else ""}
  </div>

  <h1 class="article-title" itemprop="headline">{_esc(title)}</h1>

  {f'<p class="article-excerpt" itemprop="description">{_esc(excerpt)}</p>' if excerpt else ""}

  {f'''<div class="author-row">
    {f'<img src="{_esc(author.get("avatar_url", ""))}" class="author-avatar" alt="{_esc(author_name)}" />' if author.get("avatar_url") else ""}
    <div>
      <div class="author-name"><a href="{DOMAIN}/author/{_esc(author_slug)}">{_esc(author_name)}</a></div>
      <div class="author-date">{_esc(published_at)}</div>
    </div>
  </div>''' if author_name else ""}

  {f'<img src="{_esc(cover_image)}" alt="{_esc(title)}" class="cover-image" itemprop="image" />' if cover_image else ""}

  <div class="article-body" itemprop="articleBody">
    {body_html}
  </div>

  {f'<div class="tags">{tags_html}</div>' if tags_html else ""}

</article>

<footer class="footer">
  <p>
    <a href="{DOMAIN}">Home</a>
    <a href="{DOMAIN}/about">About</a>
    <a href="{DOMAIN}/privacy">Privacy</a>
    <a href="{DOMAIN}/terms">Terms</a>
  </p>
  <p style="margin-top:0.75rem">&copy; Breaking Changes. All rights reserved.</p>
</footer>

</body>
</html>"""


async def publish_article_html(article: dict) -> None:
    """Render and write the pre-rendered HTML for a published article to S3."""
    slug = article.get("slug", "")
    if not slug:
        logger.warning("ssg_skip_no_slug")
        return
    if article.get("status") != "published":
        return

    try:
        html = render_article_html(article)
        key = f"ssg/article/{slug}.html"
        await put_text(
            settings.FRONTEND_BUCKET,
            key,
            html,
            content_type="text/html; charset=utf-8",
            cache_control="max-age=300, stale-while-revalidate=60",
        )
        logger.info("ssg_published", slug=slug, key=key, size=len(html))
    except Exception as exc:
        # Never let SSG failure block the article save
        logger.error("ssg_publish_error", slug=slug, error=str(exc))


async def unpublish_article_html(slug: str) -> None:
    """Remove the pre-rendered HTML when an article is deleted or unpublished."""
    try:
        await delete_object(settings.FRONTEND_BUCKET, f"ssg/article/{slug}.html")
        logger.info("ssg_unpublished", slug=slug)
    except Exception as exc:
        logger.warning("ssg_unpublish_error", slug=slug, error=str(exc))
