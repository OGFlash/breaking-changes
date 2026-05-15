import { useState } from 'react'
import { X, Mail } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

interface NewsletterInlineProps {
  dismissible?: boolean
  dismissKey?: string
  className?: string
}

export function NewsletterInline({ dismissible = false, dismissKey = 'nl-dismissed', className }: NewsletterInlineProps) {
  const [dismissed, setDismissed] = useState(() => {
    if (!dismissible) return false
    return localStorage.getItem(dismissKey) === '1'
  })

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
    staleTime: 10 * 60 * 1000,
  })

  const dismiss = () => {
    localStorage.setItem(dismissKey, '1')
    setDismissed(true)
  }

  if (dismissed) return null

  return (
    <div className={cn('card border-accent-blue/20 bg-surface-raised p-6 relative', className)}>
      {dismissible && (
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 text-text-muted hover:text-text-primary"
          aria-label="Dismiss newsletter"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      <div className="flex items-center gap-2 mb-2">
        <Mail className="w-5 h-5 text-accent-blue" />
        <h3 className="font-headline font-bold text-lg text-text-primary">Stay in the loop</h3>
      </div>
      <p className="text-text-muted text-sm mb-4">
        Get the latest tech, AI, and gaming news delivered to your inbox. Free forever.
      </p>
      {settings?.beehiiv_embed_url ? (
        <iframe
          src={settings.beehiiv_embed_url}
          height="52"
          className="w-full border-0 rounded"
          title="Newsletter signup"
        />
      ) : (
        <div className="flex gap-2">
          <input
            type="email"
            placeholder="your@email.com"
            className="flex-1 bg-bg border border-border rounded px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent-blue transition-colors"
          />
          <button className="btn-primary text-sm">Subscribe</button>
        </div>
      )}
      <p className="text-[10px] text-text-muted mt-2">No spam. Unsubscribe at any time.</p>
    </div>
  )
}
