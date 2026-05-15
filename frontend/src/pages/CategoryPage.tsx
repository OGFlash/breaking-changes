import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Helmet } from 'react-helmet-async'
import { api } from '@/lib/api'
import { ArticleCard } from '@/components/ArticleCard'
import { SkeletonCard } from '@/components/SkeletonCard'
import { AdSlot } from '@/components/AdSlot'

const PAGE_SIZE = 12

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>()
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<'latest' | 'views'>('latest')

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: api.getCategories })
  const category = categories.find(c => c.slug === slug)

  const { data: articles = [], isLoading } = useQuery({
    queryKey: ['category-articles', slug],
    queryFn: () => api.getCategoryArticles(slug!),
    enabled: !!slug,
  })

  const sorted = [...articles].sort((a, b) => {
    if (sort === 'views') return (b.view_count ?? 0) - (a.view_count ?? 0)
    return (b.published_at ?? '') > (a.published_at ?? '') ? 1 : -1
  })
  const total = sorted.length
  const pages = Math.ceil(total / PAGE_SIZE)
  const pageItems = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <>
      <Helmet>
        <title>{category?.name ?? slug} — Breaking Changes</title>
        <link rel="canonical" href={`https://breakingchanges.dev/category/${slug}`} />
        <meta name="description" content={category?.description ?? `Latest ${category?.name ?? slug} news.`} />
      </Helmet>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 pb-6 border-b border-border">
          <div className="flex items-center gap-3 mb-2">
            {category?.icon && <span className="text-3xl">{category.icon}</span>}
            <h1
              className="font-headline font-bold text-3xl md:text-4xl"
              style={{ color: category?.color ?? '#f0f0f0' }}
            >
              {category?.name ?? slug}
            </h1>
          </div>
          {category?.description && <p className="text-text-muted mb-2">{category.description}</p>}
          <p className="text-sm text-text-muted">{total} articles</p>
        </div>

        <AdSlot slotId="category_banner" className="mb-6" />

        {/* Sort chips */}
        <div className="flex gap-2 mb-6">
          {(['latest', 'views'] as const).map(s => (
            <button
              key={s}
              onClick={() => { setSort(s); setPage(1) }}
              className={`text-sm px-4 py-1.5 rounded-full border transition-colors ${sort === s ? 'bg-accent-red border-accent-red text-white' : 'border-border text-text-muted hover:border-text-muted'}`}
            >
              {s === 'latest' ? 'Latest' : 'Most Viewed'}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pageItems.map(a => <ArticleCard key={a.slug} article={a} />)}
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-10">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-ghost disabled:opacity-40">Prev</button>
            {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-9 h-9 rounded border text-sm transition-colors ${p === page ? 'bg-accent-red border-accent-red text-white' : 'border-border text-text-muted hover:border-text-muted'}`}
              >
                {p}
              </button>
            ))}
            <button disabled={page === pages} onClick={() => setPage(p => p + 1)} className="btn-ghost disabled:opacity-40">Next</button>
          </div>
        )}
      </div>
    </>
  )
}
