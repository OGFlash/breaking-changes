import { Link } from 'react-router-dom'
import { Zap, Twitter, Github, Linkedin, Youtube } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

function socialHref(base: string, handle?: string | null) {
  if (!handle) return null
  const clean = handle.replace(/^@/, '').replace(/^https?:\/\/[^/]+\//, '')
  return `${base}/${clean}`
}

export function Footer() {
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: api.getCategories,
    staleTime: 10 * 60 * 1000,
  })

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
    staleTime: 10 * 60 * 1000,
  })

  return (
    <footer className="border-t border-border bg-surface mt-16">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-3">
              <Zap className="w-5 h-5 text-accent-red" />
              <span className="font-headline font-bold text-lg">
                Breaking<span className="text-accent-red">Changes</span>
              </span>
            </Link>
            <p className="text-text-muted text-sm leading-relaxed max-w-xs">
              The latest in tech, AI, and gaming. No noise, just signal.
            </p>
            <div className="flex items-center gap-3 mt-4">
              {(socialHref('https://twitter.com', settings?.social_twitter) ?? 'https://twitter.com') && (
                <a href={socialHref('https://twitter.com', settings?.social_twitter) ?? 'https://twitter.com'} target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-text-primary transition-colors">
                  <Twitter className="w-4 h-4" />
                </a>
              )}
              {socialHref('https://github.com', settings?.social_github) && (
                <a href={socialHref('https://github.com', settings?.social_github)!} target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-text-primary transition-colors">
                  <Github className="w-4 h-4" />
                </a>
              )}
              {socialHref('https://linkedin.com', settings?.social_linkedin) && (
                <a href={socialHref('https://linkedin.com', settings?.social_linkedin)!} target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-text-primary transition-colors">
                  <Linkedin className="w-4 h-4" />
                </a>
              )}
              {socialHref('https://youtube.com', settings?.social_youtube) && (
                <a href={socialHref('https://youtube.com', settings?.social_youtube)!} target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-text-primary transition-colors">
                  <Youtube className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>

          {/* Categories */}
          <div>
            <h4 className="font-semibold text-text-primary text-sm mb-3">Categories</h4>
            <ul className="space-y-2">
              {categories.filter(c => c.is_active).slice(0, 5).map((cat) => (
                <li key={cat.slug}>
                  <Link
                    to={`/category/${cat.slug}`}
                    className="text-sm text-text-muted hover:text-text-primary transition-colors"
                  >
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold text-text-primary text-sm mb-3">Company</h4>
            <ul className="space-y-2">
              {[
                { to: '/about', label: 'About' },
                { to: '/contact', label: 'Contact' },
                { to: '/advertise', label: 'Advertise' },
                { to: '/newsletter', label: 'Newsletter' },
                { to: '/privacy', label: 'Privacy Policy' },
                { to: '/terms', label: 'Terms of Use' },
              ].map(({ to, label }) => (
                <li key={to}>
                  <Link to={to} className="text-sm text-text-muted hover:text-text-primary transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-border mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-text-muted text-xs">
            © {new Date().getFullYear()} Breaking Changes. All rights reserved.
          </p>
          <p className="text-text-muted text-xs">
            Fast. Honest. No bullshit.
          </p>
        </div>
      </div>
    </footer>
  )
}
