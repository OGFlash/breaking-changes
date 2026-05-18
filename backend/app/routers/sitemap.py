from fastapi import APIRouter
from fastapi.responses import Response
from app.config import settings
from app.services import s3

router = APIRouter()

DOMAIN = "https://breakchange.com"

STATIC_PAGES = [
    ("", "1.0", "daily"),
    ("/about", "0.5", "monthly"),
    ("/contact", "0.5", "monthly"),
    ("/advertise", "0.5", "monthly"),
    ("/newsletter", "0.5", "monthly"),
    ("/privacy", "0.3", "monthly"),
    ("/terms", "0.3", "monthly"),
]


@router.get("/sitemap.xml", include_in_schema=False)
async def sitemap():
    try:
        articles = await s3.get_json(settings.CONTENT_BUCKET, "indexes/all.json")
    except Exception:
        articles = []

    urls = []

    # Static pages
    for path, priority, changefreq in STATIC_PAGES:
        urls.append(f"""  <url>
    <loc>{DOMAIN}{path}</loc>
    <changefreq>{changefreq}</changefreq>
    <priority>{priority}</priority>
  </url>""")

    # Articles
    for article in articles:
        slug = article.get("slug", "")
        if not slug:
            continue
        lastmod = article.get("updated_at") or article.get("published_at", "")
        lastmod_tag = f"\n    <lastmod>{lastmod[:10]}</lastmod>" if lastmod else ""
        urls.append(f"""  <url>
    <loc>{DOMAIN}/article/{slug}</loc>{lastmod_tag}
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>""")

    xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    xml += "\n".join(urls)
    xml += "\n</urlset>"

    return Response(content=xml, media_type="application/xml")
