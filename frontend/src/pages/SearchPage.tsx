import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Helmet } from 'react-helmet-async'
import Fuse from 'fuse.js'
import { Search as SearchIcon } from 'lucide-react'
import { api } from '@/lib/api'
import { ArticleCard } from '@/components/ArticleCard'
import type { ArticleMeta } from '@/types'

export default function SearchPage() {
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')

  const { data: index = [] } = useQuery({
    queryKey: ['search-index'],
    queryFn: api.getSearchIndex,
    staleTime: 10 * 60 * 1000,
  })

  const fuse = useMemo(() => new Fuse(index, {
    keys: ['title', 'excerpt', 'tags'],
    threshold: 0.4,
    includeScore: true,
  }), [index])

  const query = params.get('q') ?? ''
  const results = useMemo(() => {
    if (!query.trim()) return index.slice(0, 20) as unknown as ArticleMeta[]
    return fuse.search(query).map(r => r.item as unknown as ArticleMeta)
  }, [fuse, query, index])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setParams({ q })
  }

  return (
    <>
      <Helmet>
        <title>{query ? `"${query}" — Search` : 'Search'} — Breaking Changes</title>
        {query && <link rel="canonical" href={`https://breakingchanges.dev/search?q=${encodeURIComponent(query)}`} />}
      </Helmet>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="font-headline font-bold text-3xl mb-6">Search</h1>

        <form onSubmit={handleSubmit} className="mb-8">
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-3 bg-surface border border-border rounded-lg px-4 py-3 focus-within:border-accent-blue transition-colors">
              <SearchIcon className="w-5 h-5 text-text-muted flex-shrink-0" />
              <input
                autoFocus
                type="text"
                placeholder="Search articles, topics, tags..."
                value={q}
                onChange={e => setQ(e.target.value)}
                className="flex-1 bg-transparent text-text-primary placeholder-text-muted outline-none"
              />
            </div>
            <button type="submit" className="btn-primary">Search</button>
          </div>
        </form>

        {query && (
          <p className="text-text-muted text-sm mb-4">
            {results.length} result{results.length !== 1 ? 's' : ''} for <strong className="text-text-primary">"{query}"</strong>
          </p>
        )}

        {results.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {results.map((a: any) => <ArticleCard key={a.slug} article={a} />)}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="font-headline font-bold text-2xl text-text-primary mb-2">No results found</p>
            <p className="text-text-muted mb-6">Try a different search term or browse by category.</p>
            <Link to="/" className="btn-primary inline-block">Browse all articles</Link>
          </div>
        )}
      </div>
    </>
  )
}
