import type { Article, ArticleMeta, PaginatedArticles, Category, Author, SearchIndexItem, SiteSettings } from '@/types'

const BASE = '/api'

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  return res.json()
}

export const api = {
  // Articles
  getArticles: (params: Record<string, string | number | boolean | undefined> = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    ).toString()
    return fetchJson<PaginatedArticles>(`${BASE}/articles${qs ? '?' + qs : ''}`)
  },

  getArticle: (slug: string) =>
    fetchJson<Article>(`${BASE}/articles/${slug}`),

  getRelated: (slug: string) =>
    fetchJson<ArticleMeta[]>(`${BASE}/articles/${slug}/related`),

  getFeatured: () =>
    fetchJson<ArticleMeta[]>(`${BASE}/articles/featured`),

  getTrending: () =>
    fetchJson<ArticleMeta[]>(`${BASE}/articles/trending`),

  getBreaking: () =>
    fetchJson<ArticleMeta[]>(`${BASE}/articles/breaking`),

  // Categories
  getCategories: () =>
    fetchJson<Category[]>(`${BASE}/categories`),

  getCategoryArticles: (slug: string) =>
    fetchJson<ArticleMeta[]>(`${BASE}/categories/${slug}/articles`),

  // Authors
  getAuthors: () =>
    fetchJson<Author[]>(`${BASE}/authors`),

  getAuthor: (slug: string) =>
    fetchJson<{ author: Author; articles: ArticleMeta[] }>(`${BASE}/authors/${slug}`),

  // Search
  getSearchIndex: () =>
    fetchJson<SearchIndexItem[]>(`${BASE}/search`),

  // Settings
  getSettings: () =>
    fetchJson<SiteSettings>(`${BASE}/settings/public`),

  // Contact
  submitContact: (body: { name: string; email: string; subject: string; message: string }) =>
    fetchJson<{ success: boolean }>(`${BASE}/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),

  // View count
  recordView: (slug: string) =>
    fetch(`${BASE}/views/${slug}`, { method: 'POST' }),
}
