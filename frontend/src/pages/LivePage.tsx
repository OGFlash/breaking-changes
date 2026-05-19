import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { ArrowLeft, Radio, Youtube, Tv } from 'lucide-react'
import { api } from '@/lib/api'
import { ArticleCard } from '@/components/ArticleCard'
import { SkeletonCard } from '@/components/SkeletonCard'
import { LiveEvent } from '@/types'

function getEmbedUrl(live: LiveEvent): string | null {
  const { platform, stream_url } = live
  if (!stream_url) return null

  if (platform === 'youtube') {
    const match = stream_url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/)
    if (match) {
      return `https://www.youtube.com/embed/${match[1]}?autoplay=1&mute=1&rel=0&modestbranding=1`
    }
  }

  if (platform === 'twitch') {
    const match = stream_url.match(/(?:www\.)?twitch\.tv\/([a-zA-Z0-9_]+)/)
    if (match) {
      const parent = window.location.hostname
      return `https://player.twitch.tv/?channel=${match[1]}&parent=${parent}&autoplay=true`
    }
  }

  return stream_url
}

function PlatformIcon({ platform }: { platform: string }) {
  if (platform === 'youtube') return <Youtube className="w-4 h-4" />
  if (platform === 'twitch') return <Tv className="w-4 h-4" />
  return <Radio className="w-4 h-4" />
}

export default function LivePage() {
  const { data: settings, isLoading: loadingSettings } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
    staleTime: 60_000,
  })

  const { data: breaking = [], isLoading: loadingBreaking } = useQuery({
    queryKey: ['breaking'],
    queryFn: api.getBreaking,
  })

  const live = settings?.live_event

  const embedUrl = live ? getEmbedUrl(live) : null

  const pageTitle = live?.title ? `${live.title} — Live` : 'Live Stream'

  return (
    <>
      <Helmet>
        <title>{pageTitle} — Breaking Changes</title>
        <meta name="description" content={live?.title ?? 'Live stream coverage on Breaking Changes'} />
        <meta name="robots" content="noindex" />
      </Helmet>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Back link */}
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-accent-blue transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to homepage
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            {live?.enabled && (
              <span className="flex items-center gap-1.5 bg-accent-red text-white text-[10px] font-bold px-2.5 py-1.5 rounded uppercase tracking-widest">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                </span>
                {live.label || 'LIVE NOW'}
              </span>
            )}
            <h1 className="font-headline font-bold text-2xl sm:text-3xl text-text-primary leading-tight">
              {loadingSettings
                ? <span className="inline-block h-8 w-64 bg-surface-raised rounded animate-pulse" />
                : (live?.title || 'Live Stream')}
            </h1>
          </div>

          {live && (
            <span className="flex items-center gap-1.5 text-xs text-text-muted border border-border rounded-full px-3 py-1">
              <PlatformIcon platform={live.platform} />
              {live.platform === 'youtube' ? 'YouTube' : live.platform === 'twitch' ? 'Twitch' : 'Stream'}
            </span>
          )}
        </div>

        {/* Embed */}
        <div className="rounded-xl overflow-hidden border border-border shadow-lg mb-10 bg-black">
          {loadingSettings ? (
            <div className="aspect-video w-full bg-surface-raised animate-pulse" />
          ) : embedUrl ? (
            <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
              <iframe
                src={embedUrl}
                title={live?.title ?? 'Live Stream'}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="absolute inset-0 w-full h-full border-0"
              />
            </div>
          ) : (
            <div className="aspect-video w-full flex flex-col items-center justify-center gap-3 bg-surface-raised">
              <Radio className="w-10 h-10 text-text-muted" />
              <p className="text-text-muted text-sm">
                {live?.enabled === false ? 'No live stream is currently active.' : 'Stream URL not configured.'}
              </p>
              <Link to="/" className="text-xs text-accent-blue hover:underline">← Back to homepage</Link>
            </div>
          )}
        </div>

        {/* Live coverage / breaking articles */}
        {(loadingBreaking || breaking.length > 0) && (
          <div>
            <h2 className="font-headline font-bold text-xl text-text-primary mb-4 flex items-center gap-2">
              <Radio className="w-5 h-5 text-accent-red" />
              Live Coverage
            </h2>
            {loadingBreaking ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {breaking.slice(0, 6).map((article) => (
                  <ArticleCard key={article.slug} article={article} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
