import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { X, Radio } from 'lucide-react'
import { api } from '@/lib/api'

const DISMISS_KEY = 'live-banner-dismissed'

export function LiveEventBanner() {
  const location = useLocation()
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISS_KEY) === '1')

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
    staleTime: 60_000,
  })

  const live = settings?.live_event

  // Don't show on the /live page itself, or if not enabled, or if dismissed
  if (!live?.enabled || dismissed || location.pathname === '/live') return null

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  return (
    <div className="relative bg-surface border-b border-border overflow-hidden">
      {/* Red accent line on left */}
      <div className="absolute inset-y-0 left-0 w-1 bg-accent-red" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 pl-5 flex items-center gap-3 sm:gap-4">
        {/* Pulsing live badge */}
        <span className="flex-shrink-0 flex items-center gap-1.5 bg-accent-red text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-widest">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
          </span>
          {live.label || 'LIVE NOW'}
        </span>

        {/* Title */}
        <p className="flex-1 text-sm font-medium text-text-primary truncate">
          {live.title || 'Live stream in progress'}
        </p>

        {/* CTA */}
        <Link
          to="/live"
          className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold text-accent-blue hover:text-accent-blue/80 transition-colors"
        >
          <Radio className="w-3.5 h-3.5" />
          Watch Live
        </Link>

        {/* Dismiss */}
        <button
          onClick={dismiss}
          aria-label="Dismiss live banner"
          className="flex-shrink-0 text-text-muted hover:text-text-primary transition-colors p-1 -mr-1 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
