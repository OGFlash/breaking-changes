import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { adminApi } from '@/lib/api'
import { toast } from 'sonner'
import { PlusIcon, PencilIcon, TrashIcon } from 'lucide-react'
import { cn, slugify } from '@/lib/utils'

const schema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  color: z.string().default('#6366f1'),
  icon: z.string().optional(),
  sort_order: z.coerce.number().default(0),
  is_active: z.boolean().default(true),
})
type FormValues = z.infer<typeof schema>

export default function CategoriesPage() {
  const qc = useQueryClient()
  const [editItem, setEditItem] = useState<any>(null)
  const [showModal, setShowModal] = useState(false)
  const { data: categories = [] } = useQuery({ queryKey: ['admin-categories'], queryFn: adminApi.getCategories })
  const form = useForm<FormValues>({ resolver: zodResolver(schema) })

  const upsert = useMutation({
    mutationFn: (data: FormValues) => editItem ? adminApi.updateCategory(editItem.slug, data) : adminApi.createCategory(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-categories'] }); toast.success(editItem ? 'Category updated' : 'Category created'); closeModal() },
    onError: () => toast.error('Failed to save category'),
  })
  const del = useMutation({
    mutationFn: adminApi.deleteCategory,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-categories'] }); toast.success('Category deleted') },
    onError: () => toast.error('Failed to delete category'),
  })

  function openCreate() { setEditItem(null); form.reset({ name: '', slug: '', color: '#6366f1', sort_order: 0, is_active: true }); setShowModal(true) }
  function openEdit(item: any) { setEditItem(item); form.reset(item); setShowModal(true) }
  function closeModal() { setShowModal(false); setEditItem(null) }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-headline font-bold text-2xl text-text-primary">Categories</h1>
        <button className="btn-primary flex items-center gap-2" onClick={openCreate}><PlusIcon size={16} />New Category</button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr className="border-b border-border text-left">
            <th className="px-4 py-3 text-xs text-text-muted font-medium uppercase">Name</th>
            <th className="px-4 py-3 text-xs text-text-muted font-medium uppercase hidden sm:table-cell">Slug</th>
            <th className="px-4 py-3 text-xs text-text-muted font-medium uppercase hidden md:table-cell">Color</th>
            <th className="px-4 py-3 text-xs text-text-muted font-medium uppercase hidden md:table-cell">Sort</th>
            <th className="px-4 py-3 text-xs text-text-muted font-medium uppercase">Active</th>
            <th className="px-4 py-3"></th>
          </tr></thead>
          <tbody>
            {categories.length === 0 && (
              <tr><td colSpan={6}>
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-text-muted text-sm mb-4">No categories yet. Create one to organize your articles.</p>
                  <button className="btn-primary flex items-center gap-2" onClick={openCreate}><PlusIcon size={16} />New Category</button>
                </div>
              </td></tr>
            )}
            {categories.map((c: any) => (
              <tr key={c.slug} className="border-b border-border/50 hover:bg-surface-raised">
                <td className="px-4 py-3 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full inline-block flex-shrink-0" style={{ background: c.color }} />
                  <span className="text-sm text-text-primary font-medium">{c.name}</span>
                </td>
                <td className="px-4 py-3 text-sm text-text-muted hidden sm:table-cell">{c.slug}</td>
                <td className="px-4 py-3 text-sm text-text-muted font-mono hidden md:table-cell">{c.color}</td>
                <td className="px-4 py-3 text-sm text-text-muted hidden md:table-cell">{c.sort_order ?? 0}</td>
                <td className="px-4 py-3">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full', c.is_active ? 'bg-green-500/10 text-green-400' : 'bg-zinc-700 text-text-muted')}>{c.is_active ? 'Active' : 'Hidden'}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <button onClick={() => openEdit(c)} className="p-1 text-text-muted hover:text-text-primary"><PencilIcon size={14} /></button>
                    <button onClick={() => { if (confirm('Delete this category?')) del.mutate(c.slug) }} className="p-1 text-text-muted hover:text-red-400"><TrashIcon size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="card w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="font-headline font-bold text-lg text-text-primary mb-5">{editItem ? 'Edit Category' : 'New Category'}</h2>
            <form onSubmit={form.handleSubmit((d) => upsert.mutate(d))} className="space-y-4">
              <div>
                <label className="label">Name</label>
                <input className="input w-full" {...form.register('name')} onChange={e => { form.setValue('name', e.target.value); if (!editItem) form.setValue('slug', slugify(e.target.value)) }} />
              </div>
              <div>
                <label className="label">Slug</label>
                <input className="input w-full" {...form.register('slug')} />
              </div>
              <div>
                <label className="label">Description</label>
                <input className="input w-full" {...form.register('description')} />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="label">Color</label>
                  <input type="color" className="w-full h-10 rounded border border-border bg-surface cursor-pointer" {...form.register('color')} />
                </div>
                <div className="flex-1">
                  <label className="label">Sort Order</label>
                  <input type="number" className="input w-full" {...form.register('sort_order')} />
                </div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="w-4 h-4" {...form.register('is_active')} />
                <span className="text-sm text-text-secondary">Active / visible</span>
              </label>
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
