import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Helmet } from 'react-helmet-async'
import { Twitter, Github } from 'lucide-react'
import { api } from '@/lib/api'
import { ArticleCard } from '@/components/ArticleCard'

export default function AuthorPage() {
  const { slug } = useParams<{ slug: string }>()
  const { data, isLoading } = useQuery({
    queryKey: ['author', slug],
    queryFn: () => api.getAuthor(slug!),
    enabled: !!slug,
  })

  if (isLoading) return <div className="max-w-7xl mx-auto px-4 py-16 animate-pulse"><div className="h-32 bg-surface-raised rounded-xl" /></div>
  if (!data) return null

  const { author, articles } = data
  return (
    <>
      <Helmet>
        <title>{author.name} — Breaking Changes</title>
        <link rel="canonical" href={`https://breakchange.com/author/${author.slug}`} />
        <script type="application/ld+json">{JSON.stringify({ "@context": "https://schema.org", "@type": "Person", "name": author.name, "description": author.bio })}</script>
      </Helmet>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row gap-6 mb-10 pb-8 border-b border-border items-start">
          {author.avatar_url && (
            <img src={author.avatar_url} alt={author.name} className="w-24 h-24 rounded-full object-cover flex-shrink-0" />
          )}
          <div>
            <h1 className="font-headline font-bold text-3xl text-text-primary mb-2">{author.name}</h1>
            {author.bio && <p className="text-text-muted leading-relaxed mb-3 max-w-xl">{author.bio}</p>}
            <div className="flex gap-3">
              {author.twitter_handle && (
                <a href={`https://twitter.com/${author.twitter_handle}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-text-muted hover:text-accent-blue transition-colors">
                  <Twitter className="w-4 h-4" /> @{author.twitter_handle}
                </a>
              )}
              {author.github_handle && (
                <a href={`https://github.com/${author.github_handle}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors">
                  <Github className="w-4 h-4" /> {author.github_handle}
                </a>
              )}
            </div>
            <p className="text-xs text-text-muted mt-2">{articles.length} articles published</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {articles.map((a: any) => <ArticleCard key={a.slug} article={a} />)}
        </div>
      </div>
    </>
  )
}
