from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.services.settings_svc import get_site_settings
from app.routers import articles, categories, authors, search, contact, views, admin_auth, admin_articles, admin_media, admin_categories, admin_authors, admin_tags, admin_analytics, admin_settings, admin_ads
import structlog

logger = structlog.get_logger()

app = FastAPI(
    title="Breaking Changes API",
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error("unhandled_exception", exc=str(exc), path=str(request.url))
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "code": "INTERNAL_ERROR"},
    )


# Public routes
app.include_router(articles.router, prefix="/api")
app.include_router(categories.router, prefix="/api")
app.include_router(authors.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(contact.router, prefix="/api")
app.include_router(views.router, prefix="/api")

# Admin routes
app.include_router(admin_auth.router, prefix="/api/admin")
app.include_router(admin_articles.router, prefix="/api/admin")
app.include_router(admin_media.router, prefix="/api/admin")
app.include_router(admin_categories.router, prefix="/api/admin")
app.include_router(admin_authors.router, prefix="/api/admin")
app.include_router(admin_tags.router, prefix="/api/admin")
app.include_router(admin_analytics.router, prefix="/api/admin")
app.include_router(admin_settings.router, prefix="/api/admin")
app.include_router(admin_ads.router, prefix="/api/admin")


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/settings/public")
async def public_settings():
    return await get_site_settings()
