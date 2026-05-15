import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { adminApi } from '@/lib/api'
import { toast } from 'sonner'
import { PlusIcon, PencilIcon, TrashIcon } from 'lucide-react'
import { slugify } from '@/lib/utils'

const schema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  bio: z.string().optional(),
  avatar_url: z.string().optional(),
  twitter: z.string().optional(),
  github: z.string().optional(),
  website: z.string().optional(),
  email: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

export default function AuthorsPage() {
  const qc = useQueryClient()
  const [editItem, setEditItem] = useState<any>(null)
  const [showModal, setShowModal] = useState(false)
  const { data: authors = [] } = useQuery({ queryKey: ['admin-authors'], queryFn: adminApi.getAuthors })
  const form = useForm<FormValues>({ resolver: zodResolver(schema) })

  const upsert = useMutation({
    mutationFn: (data: FormValues) => editItem ? adminApi.updateAuthor(editItem.slug, data) : adminApi.createAuthor(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-authors'] }); toast.success(editItem ? 'Author updated' : 'Author created'); closeModal() },
    onError: () => toast.error('Failed to save author'),
  })
  const del = useMutation({
    mutationFn: adminApi.deleteAuthor,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-authors'] }); toast.success('Author deleted') },
    onError: () => toast.error('Failed to delete author'),
  })

  function openCreate() { setEditItem(null); form.reset({ name: '', slug: '' }); setShowModal(true) }
  function openEdit(item: any) { setEditItem(item); form.reset(item); setShowModal(true) }
  function closeModal() { setShowModal(false); setEditItem(null) }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-headline font-bold text-2xl text-text-primary">Authors</h1>
        <button className="btn-primary flex items-center gap-2" onClick={openCreate}><PlusIcon size={16} />New Author</button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr className="border-b border-border text-left">
            <th className="px-4 py-3 text-xs text-text-muted font-medium uppercase">Author</th>
            <th className="px-4 py-3 text-xs text-text-muted font-medium uppercase hidden sm:table-cell">Slug</th>
            <th className="px-4 py-3 text-xs text-text-muted font-medium uppercase hidden md:table-cell">Bio</th>
            <th className="px-4 py-3 text-xs text-text-muted font-medium uppercase hidden lg:table-cell">Links</th>
            <th className="px-4 py-3"></th>
          </tr></thead>
          <tbody>
            {authors.length === 0 && (
              <tr><td colSpan={5}>
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-text-muted text-sm mb-4">No authors yet. Add an author to credit your writing.</p>
                  <button className="btn-primary flex items-center gap-2" onClick={openCreate}><PlusIcon size={16} />New Author</button>
                </div>
              </td></tr>
            )}
            {authors.map((a: any) => (
              <tr key={a.slug} className="border-b border-border/50 hover:bg-surface-raised">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {a.avatar_url ? <img src={a.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" /> : <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{a.name[0]}</div>}
                    <span className="text-sm text-text-primary font-medium">{a.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-text-muted hidden sm:table-cell">{a.slug}</td>
                <td className="px-4 py-3 text-sm text-text-muted max-w-xs truncate hidden md:table-cell">{a.bio}</td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <div className="flex gap-2 text-xs text-text-muted">
                    {a.twitter && <span>@{a.twitter}</span>}
                    {a.github && <span>github/{a.github}</span>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <button onClick={() => openEdit(a)} className="p-1 text-text-muted hover:text-text-primary"><PencilIcon size={14} /></button>
                    <button onClick={() => { if (confirm('Delete this author?')) del.mutate(a.slug) }} className="p-1 text-text-muted hover:text-red-400"><TrashIcon size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="font-headline font-bold text-lg text-text-primary mb-5">{editItem ? 'Edit Author' : 'New Author'}</h2>
            <form onSubmit={form.handleSubmit((d) => upsert.mutate(d))} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Name</label>
                  <input className="input w-full" {...form.register('name')} onChange={e => { form.setValue('name', e.target.value); if (!editItem) form.setValue('slug', slugify(e.target.value)) }} />
                </div>
                <div>
                  <label className="label">Slug</label>
                  <input className="input w-full" {...form.register('slug')} />
                </div>
              </div>
              <div>
                <label className="label">Bio</label>
                <textarea className="input w-full h-20 resize-none" {...form.register('bio')} />
              </div>
              <div>
                <label className="label">Avatar URL</label>
                <input className="input w-full" placeholder="https://…" {...form.register('avatar_url')} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Twitter handle</label>
                  <input className="input w-full" placeholder="username" {...form.register('twitter')} />
                </div>
                <div>
                  <label className="label">GitHub username</label>
                  <input className="input w-full" placeholder="username" {...form.register('github')} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Website</label>
                  <input className="input w-full" placeholder="https://…" {...form.register('website')} />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input className="input w-full" type="email" {...form.register('email')} />
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={closeModal} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary" disabled={upsert.isPending}>{upsert.isPending ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
