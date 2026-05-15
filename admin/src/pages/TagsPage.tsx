import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { adminApi } from '@/lib/api'
import { TrashIcon } from 'lucide-react'

export default function TagsPage() {
  const qc = useQueryClient()
  const { data: tags = [] } = useQuery({ queryKey: ['admin-tags'], queryFn: adminApi.getTags })
  const del = useMutation({
    mutationFn: adminApi.deleteTag,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-tags'] }); toast.success('Tag deleted') },
    onError: () => toast.error('Failed to delete tag'),
  })

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-headline font-bold text-2xl text-text-primary">Tags</h1>
          <p className="text-sm text-text-muted mt-1">Tags are derived automatically from articles. Deleting a tag removes it from all articles.</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr className="border-b border-border text-left">
            <th className="px-4 py-3 text-xs text-text-muted font-medium uppercase">Tag</th>
            <th className="px-4 py-3 text-xs text-text-muted font-medium uppercase hidden sm:table-cell">Slug</th>
            <th className="px-4 py-3 text-xs text-text-muted font-medium uppercase text-right">Articles</th>
            <th className="px-4 py-3"></th>
          </tr></thead>
          <tbody>
            {(tags as any[]).map((t) => (
              <tr key={t.slug} className="border-b border-border/50 hover:bg-surface-raised">
                <td className="px-4 py-3">
                  <span className="text-sm bg-surface-raised border border-border px-2 py-0.5 rounded text-text-secondary">{t.name}</span>
                </td>
                <td className="px-4 py-3 text-sm text-text-muted font-mono hidden sm:table-cell">{t.slug}</td>
                <td className="px-4 py-3 text-sm text-text-muted text-right">{t.article_count ?? 0}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <button
                      onClick={() => { if (confirm(`Remove tag "${t.name}" from all articles?`)) del.mutate(t.slug) }}
                      className="p-1 text-text-muted hover:text-red-400"
                    ><TrashIcon size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {(tags as any[]).length === 0 && (
              <tr><td colSpan={4}>
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-text-muted text-sm">No tags yet. Tags are auto-generated from article content when you add them.</p>
                </div>
              </td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
