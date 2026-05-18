import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { TrendingUp, ArrowRight } from 'lucide-react'
import { api } from '@/lib/api'
import { ArticleCard } from '@/components/ArticleCard'
import { SkeletonCard } from '@/components/SkeletonCard'
import { AdSlot } from '@/components/AdSlot'
import { NewsletterInline } from '@/components/NewsletterInline'
import { formatDate } from '@/lib/utils'

export default function HomePage() {
  const { data: featured = [], isLoading: loadingFeatured } = useQuery({
    queryKey: ['featured'],
    queryFn: api.getFeatured,
  })

  const { data: trending = [] } = useQuery({
    queryKey: ['trending'],
    queryFn: api.getTrending,
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: api.getCategories,
  })

  const { data: allArticlesPage } = useQuery({
    queryKey: ['articles', 'homepage'],
    queryFn: () => api.getArticles({ page: 1, limit: 100 }),
  })

  const hero = featured[0]
  const topStories = featured.slice(1, 7)

  return (
    <>
      <Helmet>
        <title>Breaking Changes — The Latest in Tech, AI, and Gaming</title>
        <link rel="canonical" href="https://breakingchanges.dev/" />
        <meta name="description" content="Stay current with the latest in artificial intelligence, video games, developer tools, and tech industry news." />
        <meta property="og:title" content="Breaking Changes" />
        <meta property="og:description" content="The latest in tech, AI, and gaming." />
        <meta property="og:type" content="website" />
      </Helmet>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Hero */}
        {loadingFeatured ? (
          <div className="h-96 bg-surface-raised rounded-xl animate-pulse mb-8" />
        ) : hero ? (
          <Link to={`/article/${hero.slug}`} className="group block mb-8">
            <div className="relative h-72 md:h-[460px] rounded-xl overflow-hidden bg-surface-raised">
              {hero.cover_image_url && (
                <img
                  src={hero.cover_image_url}
                  alt={hero.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
              )}
              <div className="absolute inset-0 bg-gradient-article" />
              <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                <span
                  className="text-xs font-bold uppercase tracking-wider mb-2 inline-block"
                  style={{ color: hero.category.color }}
                >
                  {hero.category.name}
                </span>
                {hero.is_breaking && (
                  <span className="bg-accent-red text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide ml-2">
                    Breaking
                  </span>
                )}
                <h1 className="font-headline font-bold text-2xl md:text-4xl text-white mt-1 mb-2 leading-tight">
                  {hero.title}
                </h1>
                <p className="text-white/70 text-sm md:text-base line-clamp-2 mb-3 max-w-2xl">
                  {hero.excerpt}
                </p>
                <div className="flex items-center gap-3 text-white/60 text-xs">
                  <span>{hero.author.name}</span>
                  <span>·</span>
                  <span>{formatDate(hero.published_at)}</span>
                  <span>·</span>
                  <span>{hero.read_time_minutes} min read</span>
                </div>
              </div>
            </div>
          </Link>
        ) : null}

        {/* Ad: leaderboard */}
        <AdSlot slotId="homepage_leaderboard" className="my-6" />

        {/* Top stories + Trending sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-12">
          {/* Top stories */}
          <div className="lg:col-span-3">
            <h2 className="font-headline font-bold text-xl mb-4 text-text-primary">Top Stories</h2>
            {loadingFeatured ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {topStories.map((article) => (
                  <ArticleCard key={article.slug} article={article} />
                ))}
              </div>
            )}
          </div>

          {/* Trending sidebar */}
          <div className="lg:col-span-1">
            <h2 className="font-headline font-bold text-xl mb-4 text-text-primary flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-accent-red" />
              Trending
            </h2>
            <div className="space-y-3">
              {trending.map((article, i) => (
                <Link
                  key={article.slug}
                  to={`/article/${article.slug}`}
                  className="flex gap-3 group"
                >
                  <span className="text-2xl font-headline font-bold text-border flex-shrink-0 leading-none mt-1 group-hover:text-accent-red transition-colors">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-text-primary group-hover:text-accent-blue transition-colors leading-snug line-clamp-2">
                      {article.title}
                    </p>
                    <p className="text-xs text-text-muted mt-1">{formatDate(article.published_at)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Category sections */}
        {categories.filter(c => c.is_active).map((cat, idx) => {
          const catArticles = allArticlesPage?.items.filter(a => a.category.slug === cat.slug).slice(0, 4) ?? []
          if (catArticles.length === 0) return null
          return (
            <div key={cat.slug} className="mb-12">
              {idx === 2 && (
                <AdSlot slotId="article_inline_1" className="mb-8" />
              )}
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-headline font-bold text-xl text-text-primary flex items-center gap-2">
                  {cat.icon && <span>{cat.icon}</span>}
                  <span style={{ color: cat.color }}>{cat.name}</span>
                </h2>
                <Link
                  to={`/category/${cat.slug}`}
                  className="text-sm text-text-muted hover:text-accent-blue transition-colors flex items-center gap-1"
                >
                  See all <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {catArticles.map((article) => (
                  <ArticleCard key={article.slug} article={article} />
                ))}
              </div>
            </div>
          )
        })}

        {/* Newsletter CTA */}
        <div className="max-w-xl mx-auto mb-12">
          <NewsletterInline dismissible dismissKey="newsletter-home" />
        </div>
      </div>
    </>
  )
}
