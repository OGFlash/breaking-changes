import { useState, useEffect, useRef } from 'react'
import { X, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NewsletterInlineProps {
  dismissible?: boolean
  dismissKey?: string
  className?: string
}

const BEEHIIV_FORM_ID = 'f437d6d1-cf4a-41c1-9cba-3fc0e421448e'

function BeehiivEmbed() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const existing = document.getElementById('beehiiv-loader')
    if (existing) existing.remove()

    const script = document.createElement('script')
    script.id = 'beehiiv-loader'
    script.src = 'https://subscribe-forms.beehiiv.com/v3/loader.js'
    script.async = true
    script.setAttribute('data-beehiiv-form', BEEHIIV_FORM_ID)
    containerRef.current.appendChild(script)

    return () => { script.remove() }
  }, [])

  return <div ref={containerRef} className="w-full" />
}

export function NewsletterInline({ dismissible = false, dismissKey = 'nl-dismissed', className }: NewsletterInlineProps) {
  const [dismissed, setDismissed] = useState(() => {
    if (!dismissible) return false
    return localStorage.getItem(dismissKey) === '1'
  })

  const dismiss = () => {
    localStorage.setItem(dismissKey, '1')
    setDismissed(true)
  }

  if (dismissed) return null

  return (
    <div className={cn('card border-accent-red/20 bg-surface-raised p-6 relative', className)}>
      {dismissible && (
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 text-text-muted hover:text-text-primary"
          aria-label="Dismiss newsletter"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      <div className="flex items-center gap-2 mb-3">
        <Mail className="w-5 h-5 text-accent-red" />
        <h3 className="font-headline font-bold text-lg text-text-primary">Stay in the loop</h3>
      </div>
      <p className="text-text-muted text-sm mb-4">
        Get the latest tech, AI, and gaming news delivered to your inbox. Free forever.
      </p>
      <BeehiivEmbed />
    </div>
  )
}
