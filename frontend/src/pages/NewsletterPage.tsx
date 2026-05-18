import { Helmet } from 'react-helmet-async'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Mail, Zap, Sparkles } from 'lucide-react'

export default function NewsletterPage() {
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: api.getSettings })

  return (
    <>
      <Helmet>
        <title>Newsletter — Breaking Changes</title>
        <link rel="canonical" href="https://breakchange.com/newsletter" />
        <meta name="description" content="Subscribe to the Breaking Changes newsletter for weekly tech, AI, and gaming roundups." />
      </Helmet>
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <Mail className="w-12 h-12 text-accent-blue mx-auto mb-4" />
        <h1 className="font-headline font-bold text-4xl mb-4">The Breaking Changes Newsletter</h1>
        <p className="text-text-muted text-lg mb-8">
          A weekly digest of the most important stories in tech, AI, and gaming — curated and written by humans.
        </p>

        <div className="flex flex-col gap-3 text-left mb-10">
          {[
            { icon: <Zap className="w-4 h-4 text-accent-red" />, text: 'Top 5 stories of the week — signal, no noise' },
            { icon: <Sparkles className="w-4 h-4 text-accent-blue" />, text: 'AI & gaming deep dives you won\'t find elsewhere' },
            { icon: <Mail className="w-4 h-4 text-text-muted" />, text: 'Every Friday morning. Free forever.' },
          ].map(({ icon, text }, i) => (
            <div key={i} className="flex items-center gap-3 text-text-muted">
              {icon}
              <span className="text-sm">{text}</span>
            </div>
          ))}
        </div>

        <div className="card p-6 bg-surface-raised">
          {settings?.beehiiv_embed_url ? (
            <iframe src={settings.beehiiv_embed_url} height="100" className="w-full border-0 rounded" title="Newsletter signup" />
          ) : (
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="your@email.com"
                className="flex-1 bg-bg border border-border rounded px-3 py-2.5 text-text-primary placeholder-text-muted outline-none focus:border-accent-blue transition-colors"
              />
              <button className="btn-primary">Subscribe</button>
            </div>
          )}
          <p className="text-xs text-text-muted mt-3">No spam. Unsubscribe at any time. ~2,500 readers and growing.</p>
        </div>
      </div>
    </>
  )
}
