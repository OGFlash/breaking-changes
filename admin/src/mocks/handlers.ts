import { http, HttpResponse } from 'msw'

const BASE = '/api'
const MOCK_TOKEN = 'mock-admin-token-dev'
const MOCK_PASSWORD = 'admin'

// ── Seed data ──────────────────────────────────────────────────────────────

let articles: any[] = [
  {
    slug: 'openai-gpt5-release',
    title: 'OpenAI Releases GPT-5 with Unprecedented Reasoning Capabilities',
    subtitle: 'The new model scores 95% on the bar exam and passes advanced coding benchmarks',
    excerpt: 'OpenAI has officially launched GPT-5, its most powerful language model yet.',
    category: { slug: 'ai', name: 'AI', color: '#6366f1' },
    author: { slug: 'alex-king', name: 'Alex King', avatar_url: '' },
    tags: ['openai', 'gpt-5', 'llm'],
    status: 'published',
    is_featured: true,
    is_breaking: true,
    is_sponsored: false,
    published_at: '2026-05-14T10:00:00Z',
    read_time_minutes: 5,
    view_count: 12400,
    cover_image_url: 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=800&q=80',
    body_html: '<p>OpenAI has released GPT-5...</p>',
  },
  {
    slug: 'sony-ps6-announcement',
    title: 'Sony Officially Announces PlayStation 6 for Holiday 2026',
    subtitle: '8K gaming, full backward compatibility, and a $599 price point',
    excerpt: 'Sony has pulled back the curtain on the PlayStation 6.',
    category: { slug: 'gaming', name: 'Gaming', color: '#10b981' },
    author: { slug: 'maya-chen', name: 'Maya Chen', avatar_url: '' },
    tags: ['sony', 'playstation', 'ps6'],
    status: 'published',
    is_featured: true,
    is_breaking: false,
    is_sponsored: false,
    published_at: '2026-05-13T14:00:00Z',
    read_time_minutes: 4,
    view_count: 9800,
    cover_image_url: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&q=80',
    body_html: '<p>Sony has announced PlayStation 6...</p>',
  },
  {
    slug: 'cursor-vs-copilot-2026',
    title: 'Cursor vs GitHub Copilot in 2026: The Definitive Developer Showdown',
    subtitle: 'We spent 30 days using both tools exclusively to find out which is worth your money',
    excerpt: 'AI coding assistants have matured dramatically.',
    category: { slug: 'dev-tools', name: 'Dev Tools', color: '#f59e0b' },
    author: { slug: 'alex-king', name: 'Alex King', avatar_url: '' },
    tags: ['cursor', 'copilot', 'ai-tools'],
    status: 'draft',
    is_featured: false,
    is_breaking: false,
    is_sponsored: false,
    published_at: null,
    read_time_minutes: 8,
    view_count: 0,
    cover_image_url: 'https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?w=800&q=80',
    body_html: '<p>AI coding tools battle...</p>',
  },
]

let categories: any[] = [
  { slug: 'ai', name: 'AI', color: '#6366f1', icon: '🤖', description: 'Artificial intelligence news', sort_order: 1, active: true, article_count: 1 },
  { slug: 'gaming', name: 'Gaming', color: '#10b981', icon: '🎮', description: 'Gaming industry news', sort_order: 2, active: true, article_count: 1 },
  { slug: 'dev-tools', name: 'Dev Tools', color: '#f59e0b', icon: '🛠️', description: 'Developer tools', sort_order: 3, active: true, article_count: 1 },
  { slug: 'security', name: 'Security', color: '#ef4444', icon: '🔒', description: 'Security news', sort_order: 4, active: true, article_count: 0 },
  { slug: 'business', name: 'Business', color: '#0ea5e9', icon: '💼', description: 'Tech business', sort_order: 5, active: true, article_count: 0 },
  { slug: 'politics', name: 'Politics', color: '#a855f7', icon: '🏛️', description: 'Tech policy and government regulation', sort_order: 6, active: true, article_count: 0 },
]

let authors: any[] = [
  { slug: 'alex-king', name: 'Alex King', bio: 'Senior tech journalist covering AI and dev tools.', avatar_url: '', twitter_handle: 'alexking', github_handle: 'alexking', email: 'alex@breakingchanges.dev', article_count: 2 },
  { slug: 'maya-chen', name: 'Maya Chen', bio: 'Gaming and consumer tech reporter.', avatar_url: '', twitter_handle: 'mayachen', github_handle: 'mayachen', email: 'maya@breakingchanges.dev', article_count: 1 },
]

let tags: any[] = [
  { slug: 'openai', name: 'openai', article_count: 1 },
  { slug: 'gpt-5', name: 'gpt-5', article_count: 1 },
  { slug: 'sony', name: 'sony', article_count: 1 },
  { slug: 'cursor', name: 'cursor', article_count: 1 },
  { slug: 'copilot', name: 'copilot', article_count: 1 },
]

const settings: any = {
  site_name: 'Breaking Changes',
  site_tagline: 'The Latest in Tech, AI, and Gaming',
  site_url: 'https://breakingchanges.dev',
  contact_email: 'hello@breakingchanges.dev',
  twitter_handle: 'breakingchanges',
  github_handle: 'breakingchanges',
  default_og_image_url: '',
  breaking_ticker_enabled: true,
  articles_per_page: 12,
  featured_article_count: 6,
}

const ads: any[] = [
  { slot_id: 'leaderboard_top', name: 'Leaderboard Top', is_active: false, code: '' },
  { slot_id: 'sidebar_article', name: 'Sidebar Article', is_active: false, code: '' },
  { slot_id: 'inline_article', name: 'Inline Article', is_active: false, code: '' },
]

// ── Helpers ────────────────────────────────────────────────────────────────

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function authError() {
  return new HttpResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
}

function checkAuth(request: Request) {
  const auth = request.headers.get('Authorization')
  return auth === `Bearer ${MOCK_TOKEN}`
}

// ── Handlers ───────────────────────────────────────────────────────────────

export const handlers = [
  // Auth
  http.post(`${BASE}/admin/auth/login`, async ({ request }) => {
    const body: any = await request.json()
    if (body.password !== MOCK_PASSWORD) {
      return new HttpResponse(JSON.stringify({ error: 'Invalid password' }), { status: 401 })
    }
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    return HttpResponse.json({ token: MOCK_TOKEN, expires_at: expires })
  }),

  // Articles list
  http.get(`${BASE}/admin/articles`, ({ request }) => {
    if (!checkAuth(request)) return authError()
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') ?? 1)
    const limit = Number(url.searchParams.get('limit') ?? 20)
    const status = url.searchParams.get('status')
    const filtered = status ? articles.filter(a => a.status === status) : articles
    const start = (page - 1) * limit
    return HttpResponse.json({
      items: filtered.slice(start, start + limit),
      total: filtered.length,
      page,
      limit,
      pages: Math.ceil(filtered.length / limit),
    })
  }),

  // Single article
  http.get(`${BASE}/admin/articles/:slug`, ({ request, params }) => {
    if (!checkAuth(request)) return authError()
    const article = articles.find(a => a.slug === params.slug)
    if (!article) return new HttpResponse(null, { status: 404 })
    return HttpResponse.json(article)
  }),

  // Create article
  http.post(`${BASE}/admin/articles`, async ({ request }) => {
    if (!checkAuth(request)) return authError()
    const body: any = await request.json()
    const article = { ...body, slug: body.slug || slugify(body.title), view_count: 0 }
    articles.unshift(article)
    return HttpResponse.json(article, { status: 201 })
  }),

  // Update article
  http.put(`${BASE}/admin/articles/:slug`, async ({ request, params }) => {
    if (!checkAuth(request)) return authError()
    const body: any = await request.json()
    const idx = articles.findIndex(a => a.slug === params.slug)
    if (idx === -1) return new HttpResponse(null, { status: 404 })
    articles[idx] = { ...articles[idx], ...body }
    return HttpResponse.json(articles[idx])
  }),

  // Update status
  http.patch(`${BASE}/admin/articles/:slug/status`, async ({ request, params }) => {
    if (!checkAuth(request)) return authError()
    const body: any = await request.json()
    const idx = articles.findIndex(a => a.slug === params.slug)
    if (idx === -1) return new HttpResponse(null, { status: 404 })
    articles[idx].status = body.status
    if (body.status === 'published' && !articles[idx].published_at) {
      articles[idx].published_at = new Date().toISOString()
    }
    return HttpResponse.json(articles[idx])
  }),

  // Delete article
  http.delete(`${BASE}/admin/articles/:slug`, ({ request, params }) => {
    if (!checkAuth(request)) return authError()
    articles = articles.filter(a => a.slug !== params.slug)
    return HttpResponse.json({ ok: true })
  }),

  // Media
  http.get(`${BASE}/admin/media`, ({ request }) => {
    if (!checkAuth(request)) return authError()
    return HttpResponse.json([
      { key: 'openai-gpt5.jpg', url: 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=400&q=80', size: 142000, content_type: 'image/jpeg' },
      { key: 'ps6-announcement.jpg', url: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&q=80', size: 98000, content_type: 'image/jpeg' },
      { key: 'cursor-vs-copilot.jpg', url: 'https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?w=400&q=80', size: 210000, content_type: 'image/jpeg' },
      { key: 'tech-abstract.jpg', url: 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=400&q=80', size: 175000, content_type: 'image/jpeg' },
    ])
  }),
  http.post(`${BASE}/admin/media/presign`, ({ request }) => {
    if (!checkAuth(request)) return authError()
    return HttpResponse.json({ upload_url: '#', public_url: 'https://via.placeholder.com/800x450' })
  }),
  http.delete(`${BASE}/admin/media/:key`, ({ request }) => {
    if (!checkAuth(request)) return authError()
    return HttpResponse.json({ ok: true })
  }),

  // Categories
  http.get(`${BASE}/admin/categories`, ({ request }) => {
    if (!checkAuth(request)) return authError()
    return HttpResponse.json(categories)
  }),
  http.post(`${BASE}/admin/categories`, async ({ request }) => {
    if (!checkAuth(request)) return authError()
    const body: any = await request.json()
    const cat = { ...body, slug: body.slug || slugify(body.name), article_count: 0 }
    categories.push(cat)
    return HttpResponse.json(cat, { status: 201 })
  }),
  http.put(`${BASE}/admin/categories/:slug`, async ({ request, params }) => {
    if (!checkAuth(request)) return authError()
    const body: any = await request.json()
    const idx = categories.findIndex(c => c.slug === params.slug)
    if (idx === -1) return new HttpResponse(null, { status: 404 })
    categories[idx] = { ...categories[idx], ...body }
    return HttpResponse.json(categories[idx])
  }),
  http.delete(`${BASE}/admin/categories/:slug`, ({ request, params }) => {
    if (!checkAuth(request)) return authError()
    categories = categories.filter(c => c.slug !== params.slug)
    return HttpResponse.json({ ok: true })
  }),

  // Authors
  http.get(`${BASE}/admin/authors`, ({ request }) => {
    if (!checkAuth(request)) return authError()
    return HttpResponse.json(authors)
  }),
  http.post(`${BASE}/admin/authors`, async ({ request }) => {
    if (!checkAuth(request)) return authError()
    const body: any = await request.json()
    const author = { ...body, slug: body.slug || slugify(body.name), article_count: 0 }
    authors.push(author)
    return HttpResponse.json(author, { status: 201 })
  }),
  http.put(`${BASE}/admin/authors/:slug`, async ({ request, params }) => {
    if (!checkAuth(request)) return authError()
    const body: any = await request.json()
    const idx = authors.findIndex(a => a.slug === params.slug)
    if (idx === -1) return new HttpResponse(null, { status: 404 })
    authors[idx] = { ...authors[idx], ...body }
    return HttpResponse.json(authors[idx])
  }),
  http.delete(`${BASE}/admin/authors/:slug`, ({ request, params }) => {
    if (!checkAuth(request)) return authError()
    authors = authors.filter(a => a.slug !== params.slug)
    return HttpResponse.json({ ok: true })
  }),

  // Tags
  http.get(`${BASE}/admin/tags`, ({ request }) => {
    if (!checkAuth(request)) return authError()
    return HttpResponse.json(tags)
  }),
  http.delete(`${BASE}/admin/tags/:slug`, ({ request, params }) => {
    if (!checkAuth(request)) return authError()
    tags = tags.filter(t => t.slug !== params.slug)
    return HttpResponse.json({ ok: true })
  }),

  // Analytics
  http.get(`${BASE}/admin/analytics/overview`, ({ request }) => {
    if (!checkAuth(request)) return authError()
    const daily_chart = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(Date.now() - (29 - i) * 86400000)
      return {
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        views: 200 + Math.round(Math.sin(i * 0.7) * 150 + i * 20 + (i % 7 < 2 ? 300 : 0)),
      }
    })
    return HttpResponse.json({
      total_articles: articles.length,
      published_articles: articles.filter(a => a.status === 'published').length,
      draft_articles: articles.filter(a => a.status === 'draft').length,
      total_views: articles.reduce((s, a) => s + (a.view_count ?? 0), 0),
      views_today: 342,
      views_week: 4821,
      views_month: 18930,
      daily_chart,
      top_articles: articles.filter(a => a.status === 'published').map(a => ({
        slug: a.slug, title: a.title, total_views: a.view_count ?? 0, views_today: Math.floor(Math.random() * 50),
      })),
    })
  }),
  http.get(`${BASE}/admin/analytics/articles`, ({ request }) => {
    if (!checkAuth(request)) return authError()
    return HttpResponse.json(
      articles.map(a => ({ slug: a.slug, title: a.title, views: a.view_count ?? 0, category: a.category }))
    )
  }),

  // Settings
  http.get(`${BASE}/admin/settings`, ({ request }) => {
    if (!checkAuth(request)) return authError()
    return HttpResponse.json(settings)
  }),
  http.put(`${BASE}/admin/settings`, async ({ request }) => {
    if (!checkAuth(request)) return authError()
    const body: any = await request.json()
    Object.assign(settings, body)
    return HttpResponse.json(settings)
  }),

  // Ads
  http.get(`${BASE}/admin/ads`, ({ request }) => {
    if (!checkAuth(request)) return authError()
    return HttpResponse.json(ads)
  }),
  http.put(`${BASE}/admin/ads/:slotId`, async ({ request, params }) => {
    if (!checkAuth(request)) return authError()
    const body: any = await request.json()
    const idx = ads.findIndex(a => a.slot_id === params.slotId)
    if (idx !== -1) Object.assign(ads[idx], body)
    return HttpResponse.json(ads[idx])
  }),
]
