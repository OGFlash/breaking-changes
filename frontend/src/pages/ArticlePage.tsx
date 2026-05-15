import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Helmet } from 'react-helmet-async'
import { Eye, Clock, Calendar, ArrowUp, Twitter, Linkedin, Link2, BookOpen } from 'lucide-react'
import { api } from '@/lib/api'
import { ArticleCard } from '@/components/ArticleCard'
import { AdSlot } from '@/components/AdSlot'
import { NewsletterInline } from '@/components/NewsletterInline'
import { formatDate } from '@/lib/utils'

function ReadingProgress() {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const calc = () => {
      const doc = document.documentElement
      const scrollTop = doc.scrollTop || document.body.scrollTop
      const scrollHeight = doc.scrollHeight - doc.clientHeight
      setProgress(scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0)
    }
    window.addEventListener('scroll', calc, { passive: true })
    return () => window.removeEventListener('scroll', calc)
  }, [])
  return (
    <div className="fixed top-0 left-0 right-0 h-0.5 z-[60] bg-border">
      <div
        className="h-full bg-accent-red transition-all duration-100"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}

function TableOfContents({ html }: { html: string }) {
  const [active, setActive] = useState('')
  const headings = [...html.matchAll(/<h([23])[^>]*id="([^"]*)"[^>]*>(.*?)<\/h[23]>/gi)].map(m => ({
    level: Number(m[1]),
    id: m[2],
    text: m[3].replace(/<[^>]+>/g, ''),
  }))

  useEffect(() => {
    if (headings.length === 0) return
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) setActive(entry.target.id)
        })
      },
      { rootMargin: '-10% 0% -80% 0%' }
    )
    headings.forEach(h => {
      const el = document.getElementById(h.id)
      if (el) obs.observe(el)
    })
    return () => obs.disconnect()
  }, [html])

  if (headings.length < 2) return null

  return (
    <nav className="hidden xl:block w-56 flex-shrink-0">
      <div className="sticky top-20">
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-1">
          <BookOpen className="w-3 h-3" />
          Contents
        </p>
        <ul className="space-y-1.5">
          {headings.map(h => (
            <li key={h.id}>
              <a
                href={`#${h.id}`}
                className={`text-xs block leading-snug transition-colors hover:text-text-primary ${h.level === 3 ? 'pl-3' : ''} ${active === h.id ? 'text-accent-blue font-medium' : 'text-text-muted'}`}
              >
                {h.text}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}

function BackToTop() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const handler = () => setVisible(window.scrollY > 500)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])
  if (!visible) return null
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-6 right-6 z-50 p-3 bg-accent-red hover:bg-red-600 text-white rounded-full shadow-lg transition-all"
      aria-label="Back to top"
    >
      <ArrowUp className="w-4 h-4" />
    </button>
  )
}

export default function ArticlePage() {
  const { slug } = useParams<{ slug: string }>()
  const bodyRef = useRef<HTMLDivElement>(null)

  const { data: article, isLoading, error } = useQuery({
    queryKey: ['article', slug],
    queryFn: () => api.getArticle(slug!),
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  })

  const { data: related = [] } = useQuery({
    queryKey: ['related', slug],
    queryFn: () => api.getRelated(slug!),
    enabled: !!slug,
  })

  // Record view on mount
  useEffect(() => {
    if (slug) api.recordView(slug)
  }, [slug])

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href)
  }

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 animate-pulse">
        <div className="h-72 bg-surface-raised rounded-xl mb-8" />
        <div className="max-w-article mx-auto space-y-4">
          <div className="h-8 bg-surface-raised rounded w-3/4" />
          <div className="h-4 bg-surface-raised rounded w-1/2" />
          <div className="h-4 bg-surface-raised rounded w-full" />
          <div className="h-4 bg-surface-raised rounded w-5/6" />
        </div>
      </div>
    )
  }

  if (error || !article) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <p className="font-mono text-text-muted text-sm mb-2">// 404: Article not found</p>
        <h1 className="font-headline font-bold text-3xl mb-4">This is a Breaking Change.</h1>
        <Link to="/" className="btn-primary inline-block">Back to home</Link>
      </div>
    )
  }

  const shareUrl = encodeURIComponent(window.location.href)
  const shareTitle = encodeURIComponent(article.title)

  return (
    <>
      <ReadingProgress />
      <Helmet>
        <title>{article.seo_title || article.title}</title>
        <meta name="description" content={article.seo_description || article.excerpt} />
        <meta property="og:title" content={article.title} />
        <meta property="og:description" content={article.excerpt} />
        <meta property="og:image" content={article.og_image_url || article.cover_image_url} />
        <meta property="og:type" content="article" />
        <link rel="canonical" href={`https://breakingchanges.dev/article/${article.slug}`} />
        <meta property="article:author" content={article.author.name} />
        {article.published_at && <meta property="article:published_time" content={article.published_at} />}
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "NewsArticle",
          "headline": article.title,
          "description": article.excerpt,
          "image": article.cover_image_url,
          "datePublished": article.published_at,
          "dateModified": article.updated_at || article.published_at,
          "author": { "@type": "Person", "name": article.author.name },
        })}</script>
      </Helmet>

      {/* Cover */}
      {article.cover_image_url && (
        <div className="relative h-64 md:h-[480px] bg-surface-raised overflow-hidden">
          <img
            src={article.cover_image_url}
            alt={article.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-article" />
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex gap-12 justify-center">
          {/* Social share — sticky left */}
          <div className="hidden lg:flex flex-col gap-3 pt-16 flex-shrink-0">
            <div className="sticky top-20 flex flex-col gap-2">
              <a
                href={`https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareTitle}`}
                target="_blank" rel="noopener noreferrer"
                className="p-2 text-text-muted hover:text-accent-blue bg-surface border border-border rounded hover:border-accent-blue transition-colors"
                title="Share on X"
              >
                <Twitter className="w-4 h-4" />
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`}
                target="_blank" rel="noopener noreferrer"
                className="p-2 text-text-muted hover:text-accent-blue bg-surface border border-border rounded hover:border-accent-blue transition-colors"
              >
                <Linkedin className="w-4 h-4" />
              </a>
              <button
                onClick={copyLink}
                className="p-2 text-text-muted hover:text-accent-blue bg-surface border border-border rounded hover:border-accent-blue transition-colors"
                title="Copy link"
              >
                <Link2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Article */}
          <article className="w-full max-w-article">
            {/* Meta */}
            <header className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Link
                  to={`/category/${article.category.slug}`}
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: article.category.color }}
                >
                  {article.category.name}
                </Link>
                {article.is_breaking && (
                  <span className="bg-accent-red text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide">Breaking</span>
                )}
                {article.is_sponsored && (
                  <span className="text-[10px] text-text-muted border border-border px-2 py-0.5 rounded">Sponsored</span>
                )}
              </div>
              <h1 className="font-headline font-bold text-3xl md:text-4xl text-text-primary leading-tight mb-3">
                {article.title}
              </h1>
              {article.subtitle && (
                <p className="text-xl text-text-muted mb-4">{article.subtitle}</p>
              )}
              <div className="flex flex-wrap items-center gap-4 text-sm text-text-muted border-b border-border pb-4">
                <div className="flex items-center gap-2">
                  {article.author.avatar_url && (
                    <img src={article.author.avatar_url} alt={article.author.name} className="w-7 h-7 rounded-full object-cover" />
                  )}
                  <Link to={`/author/${article.author.slug}`} className="font-medium text-text-primary hover:text-accent-blue transition-colors">
                    {article.author.name}
                  </Link>
                </div>
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDate(article.published_at)}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {article.read_time_minutes} min read
                </span>
                {article.view_count !== undefined && (
                  <span className="flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5" />
                    {article.view_count.toLocaleString()} views
                  </span>
                )}
              </div>
            </header>

            {/* Body */}
            <div
              ref={bodyRef}
              className="article-body"
              dangerouslySetInnerHTML={{ __html: article.body_html }}
            />

            {/* Tags */}
            {article.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-border">
                {article.tags.map(tag => (
                  <Link key={tag} to={`/tag/${tag}`} className="tag-badge">#{tag}</Link>
                ))}
              </div>
            )}

            {/* Mobile share */}
            <div className="flex gap-3 mt-6 lg:hidden">
              <a href={`https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareTitle}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 btn-ghost text-sm">
                <Twitter className="w-4 h-4" /> Share on X
              </a>
              <button onClick={copyLink} className="flex items-center gap-2 btn-ghost text-sm">
                <Link2 className="w-4 h-4" /> Copy link
              </button>
            </div>

            {/* Author card */}
            <div className="mt-8 p-6 card border-surface-raised bg-surface-raised flex gap-4">
              {article.author.avatar_url && (
                <img src={article.author.avatar_url} alt={article.author.name} className="w-14 h-14 rounded-full object-cover flex-shrink-0" />
              )}
              <div>
                <p className="text-xs text-text-muted uppercase tracking-wider mb-0.5">Written by</p>
                <Link to={`/author/${article.author.slug}`} className="font-headline font-bold text-lg text-text-primary hover:text-accent-blue transition-colors">
                  {article.author.name}
                </Link>
              </div>
            </div>

            {/* Newsletter */}
            <NewsletterInline className="mt-6" dismissible dismissKey={`nl-${slug}`} />

            {/* Related */}
            {related.length > 0 && (
              <div className="mt-12">
                <h3 className="font-headline font-bold text-xl mb-4">You might also like</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {related.slice(0, 3).map(a => (
                    <ArticleCard key={a.slug} article={a} size="small" />
                  ))}
                </div>
              </div>
            )}
          </article>

          {/* TOC sidebar */}
          <TableOfContents html={article.body_html} />
        </div>
      </div>

      <BackToTop />
    </>
  )
}
