export interface CategoryRef {
  slug: string
  name: string
  color: string
}

export interface AuthorRef {
  slug: string
  name: string
  avatar_url?: string
}

export interface ArticleMeta {
  slug: string
  title: string
  subtitle?: string
  excerpt: string
  cover_image_url?: string
  og_image_url?: string
  category: CategoryRef
  author: AuthorRef
  tags: string[]
  status: 'published' | 'draft' | 'archived'
  is_featured: boolean
  is_breaking: boolean
  is_sponsored: boolean
  published_at?: string
  updated_at?: string
  read_time_minutes: number
  seo_title?: string
  seo_description?: string
  series?: string
  view_count?: number
}

export interface Article extends ArticleMeta {
  body_html: string
}

export interface PaginatedArticles {
  items: ArticleMeta[]
  total: number
  page: number
  limit: number
  pages: number
}

export interface Category {
  slug: string
  name: string
  color: string
  icon?: string
  description?: string
  sort_order: number
  is_active: boolean
  article_count?: number
}

export interface Author {
  slug: string
  name: string
  bio?: string
  avatar_url?: string
  twitter_handle?: string
  github_handle?: string
  email?: string
  joined_at?: string
  article_count?: number
}

export interface SearchIndexItem {
  slug: string
  title: string
  excerpt: string
  tags: string[]
  category: CategoryRef
  published_at?: string
}

export interface SiteSettings {
  site_name: string
  tagline: string
  logo_url?: string
  favicon_url?: string
  social_twitter?: string
  social_github?: string
  social_linkedin?: string
  social_discord?: string
  social_youtube?: string
  contact_email?: string
  breaking_ticker_enabled: boolean
  breaking_ticker_override?: string
  beehiiv_embed_url?: string
  ga_measurement_id?: string
  carbon_ads_id?: string
  adsense_publisher_id?: string
  default_og_image_url?: string
  ad_slots: AdSlot[]
}

export interface AdSlot {
  id: string
  label: string
  description: string
  code: string
  is_active: boolean
}
