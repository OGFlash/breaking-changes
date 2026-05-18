import { useAuth } from '@/store/auth'

const BASE = '/api'

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const token = useAuth.getState().token
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> ?? {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(url, { ...init, headers })

  if (res.status === 401) {
    useAuth.getState().logout()
    window.location.href = '/admin/login'
    throw new Error('Unauthorized')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }

  return res.json()
}

export const adminApi = {
  login: (password: string) =>
    fetchJson<{ token: string; expires_at: string }>(`${BASE}/admin/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  // Articles
  getArticles: (params?: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams(
      Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
    ).toString()
    return fetchJson<{ items: any[]; total: number; page: number; limit: number }>(`${BASE}/admin/articles${qs ? '?' + qs : ''}`)
  },
  getArticle: (slug: string) => fetchJson<any>(`${BASE}/admin/articles/${slug}`),
  createArticle: (body: any) => fetchJson<any>(`${BASE}/admin/articles`, { method: 'POST', body: JSON.stringify(body) }),
  updateArticle: (slug: string, body: any) => fetchJson<any>(`${BASE}/admin/articles/${slug}`, { method: 'PUT', body: JSON.stringify(body) }),
  updateStatus: (slug: string, status: string) => fetchJson<any>(`${BASE}/admin/articles/${slug}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  deleteArticle: (slug: string) => fetchJson<any>(`${BASE}/admin/articles/${slug}`, { method: 'DELETE' }),

  // Media
  presignUpload: (filename: string, content_type: string) =>
    fetchJson<{ upload_url: string; public_url: string }>(`${BASE}/admin/media/presign`, { method: 'POST', body: JSON.stringify({ filename, content_type }) }),
  listMedia: () => fetchJson<any[]>(`${BASE}/admin/media`),
  deleteMedia: (key: string) => fetchJson<any>(`${BASE}/admin/media/${key}`, { method: 'DELETE' }),

  // Categories
  getCategories: () => fetchJson<any[]>(`${BASE}/admin/categories`),
  createCategory: (body: any) => fetchJson<any>(`${BASE}/admin/categories`, { method: 'POST', body: JSON.stringify(body) }),
  updateCategory: (slug: string, body: any) => fetchJson<any>(`${BASE}/admin/categories/${slug}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteCategory: (slug: string) => fetchJson<any>(`${BASE}/admin/categories/${slug}`, { method: 'DELETE' }),

  // Authors
  getAuthors: () => fetchJson<any[]>(`${BASE}/admin/authors`),
  createAuthor: (body: any) => fetchJson<any>(`${BASE}/admin/authors`, { method: 'POST', body: JSON.stringify(body) }),
  updateAuthor: (slug: string, body: any) => fetchJson<any>(`${BASE}/admin/authors/${slug}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteAuthor: (slug: string) => fetchJson<any>(`${BASE}/admin/authors/${slug}`, { method: 'DELETE' }),

  // Tags
  getTags: () => fetchJson<any[]>(`${BASE}/admin/tags`),
  deleteTag: (slug: string) => fetchJson<any>(`${BASE}/admin/tags/${slug}`, { method: 'DELETE' }),

  // Analytics
  getAnalytics: () => fetchJson<any>(`${BASE}/admin/analytics/overview`),
  getArticleAnalytics: () => fetchJson<any[]>(`${BASE}/admin/analytics/articles`),

  // Settings & Ads
  getSettings: () => fetchJson<any>(`${BASE}/admin/settings`),
  updateSettings: (body: any) => fetchJson<any>(`${BASE}/admin/settings`, { method: 'PUT', body: JSON.stringify(body) }),
  getAds: () => fetchJson<any[]>(`${BASE}/admin/ads`),
  updateAd: (slotId: string, body: any) => fetchJson<any>(`${BASE}/admin/ads/${slotId}`, { method: 'PUT', body: JSON.stringify(body) }),

  // AI Writer — POST endpoints return {job_id}; poll with aiPollJob
  aiTrends: (categories: string[]) =>
    fetchJson<{ job_id: string }>(`${BASE}/admin/ai-writer/trends`, { method: 'POST', body: JSON.stringify({ categories }) }),
  aiResearch: (title: string, urls: string[], category: string) =>
    fetchJson<{ job_id: string }>(`${BASE}/admin/ai-writer/research`, { method: 'POST', body: JSON.stringify({ title, urls, category }) }),
  aiGenerate: (brief: any, word_count: number) =>
    fetchJson<{ job_id: string }>(`${BASE}/admin/ai-writer/generate`, { method: 'POST', body: JSON.stringify({ brief, word_count }) }),
  aiPollJob: (job_id: string) =>
    fetchJson<{ status: string; result?: any; error?: string }>(`${BASE}/admin/ai-writer/job/${job_id}`, { method: 'GET' }),
  aiSaveDraft: (draft: any, author_slug: string) =>
    fetchJson<{ slug: string }>(`${BASE}/admin/ai-writer/save-draft`, { method: 'POST', body: JSON.stringify({ draft, author_slug }) }),
}
