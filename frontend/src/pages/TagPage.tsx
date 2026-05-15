import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Helmet } from 'react-helmet-async'
import { api } from '@/lib/api'
import { ArticleCard } from '@/components/ArticleCard'

export default function TagPage() {
  const { slug } = useParams<{ slug: string }>()
  const { data: articles = [], isLoading } = useQuery({
    queryKey: ['tag-articles', slug],
    queryFn: () => fetch(`/api/tags/${slug}/articles`).then(r => r.json()),
    enabled: !!slug,
  })

  return (
    <>
      <Helmet>
        <title>#{slug} — Breaking Changes</title>
        <link rel="canonical" href={`https://breakingchanges.dev/tag/${slug}`} />
      </Helmet>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8 pb-6 border-b border-border">
          <h1 className="font-headline font-bold text-3xl text-text-primary">#{slug}</h1>
          <p className="text-sm text-text-muted mt-1">{articles.length} articles</p>
        </div>
        {isLoading ? (
          <p className="text-text-muted">Loading...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {articles.map((a: any) => <ArticleCard key={a.slug} article={a} />)}
          </div>
        )}
      </div>
    </>
  )
}
