import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { adminApi } from '@/lib/api'
import { ChevronLeft, ChevronRight, Plus, Edit2, Trash2, ExternalLink } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

const STATUS_COLOR: Record<string, string> = {
  published: 'bg-green-500/10 text-green-400 border border-green-500/20',
  draft: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
  archived: 'bg-gray-500/10 text-gray-400 border border-gray-500/20',
}

export default function ArticlesPage() {
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['admin-articles', filter, page],
    queryFn: () => adminApi.getArticles({ status: filter === 'all' ? undefined : filter, limit: PAGE_SIZE, page }),
  })

  const deleteMut = useMutation({
    mutationFn: adminApi.deleteArticle,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-articles'] }); toast.success('Article deleted') },
    onError: () => toast.error('Failed to delete article'),
  })

  const articles = (data?.items ?? []).filter(a =>
    !search || a.title?.toLowerCase().includes(search.toLowerCase())
  )
  const totalPages = data?.total ? Math.ceil(data.total / PAGE_SIZE) : 1

  // Reset to page 1 whenever search or filter changes
  useEffect(() => { setPage(1) }, [search, filter])

  const onFilterChange = (f: string) => { setFilter(f); setPage(1) }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-headline font-bold text-2xl text-text-primary">Articles</h1>
        <Link to="/articles/new" className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Article
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
          {['all', 'published', 'draft', 'archived'].map(s => (
            <button
              key={s}
              onClick={() => onFilterChange(s)}
              className={cn('px-3 py-1.5 rounded text-sm capitalize transition-colors', filter === s ? 'bg-indigo-600 text-white' : 'text-text-muted hover:text-text-primary')}
            >
              {s}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search articles..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="form-input flex-1 min-w-48 max-w-xs"
        />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 text-xs text-text-muted font-medium uppercase tracking-wider">Title</th>
              <th className="px-4 py-3 text-xs text-text-muted font-medium uppercase tracking-wider hidden sm:table-cell">Category</th>
              <th className="px-4 py-3 text-xs text-text-muted font-medium uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-xs text-text-muted font-medium uppercase tracking-wider hidden md:table-cell">Date</th>
              <th className="px-4 py-3 text-xs text-text-muted font-medium uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-text-muted">Loading...</td></tr>
            ) : articles.length === 0 ? (
              <tr><td colSpan={5}>
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-text-muted text-sm mb-4">{search || filter !== 'all' ? 'No articles match your filters.' : 'No articles yet — write your first one!'}</p>
                  {!search && filter === 'all' && <Link to="/articles/new" className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> New Article</Link>}
                </div>
              </td></tr>
            ) : articles.map(a => (
              <tr key={a.slug} className="border-b border-border/50 hover:bg-surface-raised transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {a.cover_image_url && (
                      <img src={a.cover_image_url} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{a.title}</p>
                      <p className="text-xs text-text-muted font-mono">{a.slug}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span className="text-xs" style={{ color: a.category?.color ?? '#888' }}>{a.category?.name ?? '—'}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full capitalize', STATUS_COLOR[a.status] ?? STATUS_COLOR.draft)}>
                    {a.status}
                  </span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-xs text-text-muted">
                  {a.published_at ? format(new Date(a.published_at), 'MMM d, yyyy') : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {a.status === 'published' && (
                      <a href={`/article/${a.slug}`} target="_blank" rel="noopener" className="p-1.5 text-text-muted hover:text-text-primary transition-colors" title="View">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <Link to={`/articles/${a.slug}/edit`} className="p-1.5 text-text-muted hover:text-indigo-400 transition-colors" title="Edit">
                      <Edit2 className="w-3.5 h-3.5" />
                    </Link>
                    <button
                      onClick={() => { if (confirm(`Delete "${a.title}"?`)) deleteMut.mutate(a.slug) }}
                      className="p-1.5 text-text-muted hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-text-muted">Page {page} of {totalPages} ({data?.total ?? 0} articles)</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary p-1.5 disabled:opacity-40">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary p-1.5 disabled:opacity-40">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
