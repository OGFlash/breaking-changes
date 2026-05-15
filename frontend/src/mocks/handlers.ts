import { http, HttpResponse } from 'msw'
import { articles, categories, authors, settings, ads } from './data'

const BASE = '/api'

export const handlers = [
  // Articles list
  http.get(`${BASE}/articles`, ({ request }) => {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') ?? 1)
    const limit = Number(url.searchParams.get('limit') ?? 10)
    const category = url.searchParams.get('category')
    const filtered = category ? articles.filter(a => a.category.slug === category) : articles
    const start = (page - 1) * limit
    return HttpResponse.json({
      items: filtered.slice(start, start + limit),
      total: filtered.length,
      page,
      limit,
      pages: Math.ceil(filtered.length / limit),
    })
  }),

  // Featured
  http.get(`${BASE}/articles/featured`, () =>
    HttpResponse.json(articles.filter(a => a.is_featured))),

  // Trending (DynamoDB-backed in prod — just return sorted by recency here)
  http.get(`${BASE}/articles/trending`, () =>
    HttpResponse.json(articles.slice(0, 5).map(a => ({ ...a, view_count: Math.floor(Math.random() * 5000 + 500) })))),

  // Single article
  http.get(`${BASE}/articles/:slug`, ({ params }) => {
    const article = articles.find(a => a.slug === params.slug)
    if (!article) return new HttpResponse(null, { status: 404 })
    return HttpResponse.json(article)
  }),

  // Related articles
  http.get(`${BASE}/articles/:slug/related`, ({ params }) => {
    const article = articles.find(a => a.slug === params.slug)
    const related = articles.filter(a => a.slug !== params.slug && a.category.slug === article?.category.slug).slice(0, 3)
    return HttpResponse.json(related)
  }),

  // Categories
  http.get(`${BASE}/categories`, () => HttpResponse.json(categories)),

  http.get(`${BASE}/categories/:slug/articles`, ({ params }) => {
    const cat = articles.filter(a => a.category.slug === params.slug)
    return HttpResponse.json(cat)
  }),

  // Authors
  http.get(`${BASE}/authors`, () => HttpResponse.json(authors)),

  http.get(`${BASE}/authors/:slug`, ({ params }) => {
    const author = authors.find(a => a.slug === params.slug)
    if (!author) return new HttpResponse(null, { status: 404 })
    const authorArticles = articles.filter(a => a.author.slug === params.slug)
    return HttpResponse.json({ author, articles: authorArticles })
  }),

  // Search index
  http.get(`${BASE}/search`, ({ request }) => {
    const q = new URL(request.url).searchParams.get('q')?.toLowerCase() ?? ''
    const results = articles.filter(a =>
      a.title.toLowerCase().includes(q) ||
      a.excerpt.toLowerCase().includes(q) ||
      a.tags.some((t: string) => t.includes(q)),
    )
    return HttpResponse.json(results)
  }),

  // Site settings
  http.get(`${BASE}/settings/public`, () => HttpResponse.json(settings)),

  // Ads
  http.get(`${BASE}/ads`, () => HttpResponse.json(ads)),

  // Contact form
  http.post(`${BASE}/contact`, () => HttpResponse.json({ ok: true })),

  // View tracking (fire and forget)
  http.post(`${BASE}/views/:slug`, () => HttpResponse.json({ ok: true })),
]
