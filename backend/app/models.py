from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class CategoryRef(BaseModel):
    slug: str
    name: str
    color: str = "#888888"


class AuthorRef(BaseModel):
    slug: str
    name: str
    avatar_url: Optional[str] = None


class ArticleMeta(BaseModel):
    slug: str
    title: str
    subtitle: Optional[str] = None
    excerpt: str
    cover_image_url: Optional[str] = None
    og_image_url: Optional[str] = None
    category: CategoryRef
    author: AuthorRef
    tags: list[str] = []
    status: str = "draft"
    is_featured: bool = False
    is_breaking: bool = False
    is_sponsored: bool = False
    published_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    read_time_minutes: int = 4
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    series: Optional[str] = None
    view_count: Optional[int] = None


class Article(ArticleMeta):
    body_html: str = ""


class ArticleCreateRequest(BaseModel):
    slug: Optional[str] = None
    title: str
    subtitle: Optional[str] = None
    excerpt: str = ""
    body_html: str = ""
    cover_image_url: Optional[str] = None
    og_image_url: Optional[str] = None
    category: CategoryRef
    author: AuthorRef
    tags: list[str] = []
    status: str = "draft"
    is_featured: bool = False
    is_breaking: bool = False
    is_sponsored: bool = False
    published_at: Optional[datetime] = None
    read_time_minutes: int = 4
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    series: Optional[str] = None


class ArticleUpdateRequest(ArticleCreateRequest):
    pass


class PaginatedArticles(BaseModel):
    items: list[ArticleMeta]
    total: int
    page: int
    limit: int
    pages: int


class Category(BaseModel):
    slug: str
    name: str
    color: str = "#888888"
    icon: Optional[str] = None
    description: Optional[str] = None
    sort_order: int = 0
    active: bool = True
    article_count: Optional[int] = None


class Author(BaseModel):
    slug: str
    name: str
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    twitter_handle: Optional[str] = None
    github_handle: Optional[str] = None
    email: Optional[str] = None
    joined_at: Optional[datetime] = None
    article_count: Optional[int] = None


class ContactRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    email: str = Field(..., min_length=5, max_length=200)
    subject: str = Field(..., min_length=1, max_length=300)
    message: str = Field(..., min_length=10, max_length=5000)


class LoginRequest(BaseModel):
    password: str


class TokenResponse(BaseModel):
    token: str
    expires_at: datetime


class PresignRequest(BaseModel):
    filename: str
    content_type: str


class StatusUpdateRequest(BaseModel):
    status: str


class AdSlot(BaseModel):
    id: str
    label: str
    description: str
    code: str = ""
    active: bool = True


class LiveEvent(BaseModel):
    enabled: bool = False
    platform: str = "youtube"
    stream_url: str = ""
    title: str = ""
    label: str = "LIVE NOW"


class SiteSettings(BaseModel):
    site_name: str = "Breaking Changes"
    tagline: str = "The latest in tech, AI, and gaming."
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    social_twitter: Optional[str] = None
    social_github: Optional[str] = None
    social_linkedin: Optional[str] = None
    social_discord: Optional[str] = None
    social_youtube: Optional[str] = None
    contact_email: Optional[str] = None
    admin_email: Optional[str] = None
    breaking_ticker_enabled: bool = True
    breaking_ticker_override: Optional[str] = None
    beehiiv_embed_url: Optional[str] = None
    ga_measurement_id: Optional[str] = None
    carbon_ads_id: Optional[str] = None
    adsense_publisher_id: Optional[str] = None
    default_og_image_url: Optional[str] = None
    ad_slots: list[AdSlot] = []
    live_event: Optional[LiveEvent] = None
