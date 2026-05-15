import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import Fuse from 'fuse.js'
import { Search, Sun, Moon, Menu, X, Zap } from 'lucide-react'
import { useTheme } from '@/store/theme'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

export function Navbar() {
  const { dark, toggle } = useTheme()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const navigate = useNavigate()

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: api.getCategories,
    staleTime: 10 * 60 * 1000,
  })

  const { data: searchIndex = [] } = useQuery({
    queryKey: ['search-index'],
    queryFn: api.getSearchIndex,
    staleTime: 5 * 60 * 1000,
    enabled: searchOpen,
  })

  const suggestions = useMemo(() => {
    if (!searchQ.trim() || searchIndex.length === 0) return []
    const fuse = new Fuse(searchIndex, {
      keys: ['title', 'excerpt', 'tags'],
      threshold: 0.4,
    })
    return fuse.search(searchQ.trim()).slice(0, 5).map((r) => r.item)
  }, [searchQ, searchIndex])

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
      if (e.key === 'Escape') {
        setSearchOpen(false)
        setMobileOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQ.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQ.trim())}`)
      setSearchOpen(false)
      setSearchQ('')
    }
  }

  return (
    <>
      <nav
        className={cn(
          'sticky top-0 z-50 transition-all duration-300',
          scrolled
            ? 'nav-scrolled backdrop-blur-md border-b border-border shadow-lg'
            : 'bg-bg border-b border-border'
        )}
      >
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 flex-shrink-0">
              <Zap className="w-5 h-5 text-accent-red" />
              <span className="font-headline font-bold text-lg text-text-primary">
                Breaking<span className="text-accent-red">Changes</span>
              </span>
            </Link>

            {/* Categories (desktop) */}
            <div className="hidden md:flex items-center gap-1 overflow-x-auto no-scrollbar">
              {categories.filter(c => c.active).slice(0, 6).map((cat) => (
                <Link
                  key={cat.slug}
                  to={`/category/${cat.slug}`}
                  className="text-sm text-text-muted hover:text-text-primary px-3 py-1 rounded hover:bg-surface-raised transition-colors whitespace-nowrap"
                  style={{ '--cat-color': cat.color } as React.CSSProperties}
                >
                  {cat.name}
                </Link>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSearchOpen(true)}
                className="p-2 text-text-muted hover:text-text-primary rounded hover:bg-surface-raised transition-colors"
                aria-label="Search (⌘K)"
              >
                <Search className="w-4 h-4" />
              </button>
              <button
                onClick={toggle}
                className="p-2 text-text-muted hover:text-text-primary rounded hover:bg-surface-raised transition-colors"
                aria-label="Toggle theme"
              >
                {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden p-2 text-text-muted hover:text-text-primary rounded hover:bg-surface-raised transition-colors"
              >
                {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="md:hidden border-t border-border bg-surface">
            <div className="max-w-7xl mx-auto px-4 py-4">
              <div className="flex flex-col gap-1">
                {categories.filter(c => c.active).map((cat) => (
                  <Link
                    key={cat.slug}
                    to={`/category/${cat.slug}`}
                    onClick={() => setMobileOpen(false)}
                    className="text-sm text-text-muted hover:text-text-primary px-3 py-2 rounded hover:bg-surface-raised transition-colors"
                  >
                    {cat.icon && <span className="mr-2">{cat.icon}</span>}
                    {cat.name}
                  </Link>
                ))}
                <div className="border-t border-border mt-2 pt-2 flex gap-4 text-sm text-text-muted">
                  <Link to="/about" onClick={() => setMobileOpen(false)} className="hover:text-text-primary">About</Link>
                  <Link to="/newsletter" onClick={() => setMobileOpen(false)} className="hover:text-text-primary">Newsletter</Link>
                  <Link to="/advertise" onClick={() => setMobileOpen(false)} className="hover:text-text-primary">Advertise</Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Search modal */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-24 px-4"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="w-full max-w-xl bg-surface border border-border rounded-xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleSearch}>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                <Search className="w-5 h-5 text-text-muted flex-shrink-0" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search articles..."
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  className="flex-1 bg-transparent text-text-primary placeholder-text-muted outline-none text-base"
                />
                <kbd className="text-xs text-text-muted border border-border px-1.5 py-0.5 rounded">Esc</kbd>
              </div>
            </form>
            {suggestions.length > 0 ? (
              <ul className="divide-y divide-border">
                {suggestions.map((article) => (
                  <li key={article.slug}>
                    <Link
                      to={`/article/${article.slug}`}
                      onClick={() => { setSearchOpen(false); setSearchQ('') }}
                      className="flex flex-col px-4 py-3 hover:bg-surface-raised transition-colors"
                    >
                      <span className="text-sm font-medium text-text-primary line-clamp-1">{article.title}</span>
                      {article.excerpt && (
                        <span className="text-xs text-text-muted mt-0.5 line-clamp-1">{article.excerpt}</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-4 py-2 text-xs text-text-muted">
                Press <kbd className="border border-border px-1 rounded">Enter</kbd> to search
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
