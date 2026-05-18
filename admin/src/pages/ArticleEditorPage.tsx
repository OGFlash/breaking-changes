import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import CharacterCount from '@tiptap/extension-character-count'
import Placeholder from '@tiptap/extension-placeholder'
import { adminApi } from '@/lib/api'
import { slugify } from '@/lib/utils'
import { toast } from 'sonner'
import { Save, Eye, Trash2, Bold, Italic, Heading2, Heading3, Code, Link2, Quote, Undo, Redo, SlidersHorizontal, X, ImageIcon, Library, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

const AUTOSAVE_KEY = (slug: string) => `bc-draft-${slug}`

export default function ArticleEditorPage() {
  const { slug } = useParams<{ slug: string }>()
  const isNew = !slug
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: existing } = useQuery({
    queryKey: ['admin-article', slug],
    queryFn: () => adminApi.getArticle(slug!),
    enabled: !isNew,
  })
  const { data: categories = [] } = useQuery({ queryKey: ['admin-categories'], queryFn: adminApi.getCategories })
  const { data: authors = [] } = useQuery({ queryKey: ['admin-authors'], queryFn: adminApi.getAuthors })

  const [form, setForm] = useState<any>({
    title: '', subtitle: '', slug: '', excerpt: '', cover_image_url: '', og_image_url: '',
    category: null, author: null, tags: [], status: 'draft',
    is_featured: false, is_breaking: false, is_sponsored: false,
    seo_title: '', seo_description: '', read_time_minutes: 4,
    published_at: new Date().toISOString().slice(0, 16),
  })
  const [tagsInput, setTagsInput] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mediaLibOpen, setMediaLibOpen] = useState(false)
  const [htmlModalOpen, setHtmlModalOpen] = useState(false)
  const [htmlInput, setHtmlInput] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [mediaLibUploading, setMediaLibUploading] = useState(false)
  const mediaLibFileRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Link.configure({ openOnClick: false }),
      CharacterCount,
      Placeholder.configure({ placeholder: 'Start writing your article...' }),
    ],
    content: '',
    onUpdate: () => setDirty(true),
  })

  // Load existing article
  useEffect(() => {
    if (existing) {
      setForm({ ...existing, tags: existing.tags ?? [] })
      setTagsInput((existing.tags ?? []).join(', '))
      editor?.commands.setContent(existing.body_html ?? '')
    }
  }, [existing, editor])

  // Auto-generate slug (only if user hasn't manually edited the slug field)
  useEffect(() => {
    if (isNew && form.title && !slugEdited) {
      setForm((f: any) => ({ ...f, slug: slugify(form.title) }))
    }
  }, [form.title, isNew, slugEdited])

  // Autosave to localStorage
  useEffect(() => {
    if (!dirty) return
    const id = setTimeout(() => {
      const key = AUTOSAVE_KEY(form.slug || 'new')
      localStorage.setItem(key, JSON.stringify({ ...form, body_html: editor?.getHTML() }))
    }, 10000)
    return () => clearTimeout(id)
  }, [dirty, form, editor])

  // Warn on unload
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const { data: mediaItems = [] } = useQuery({ queryKey: ['admin-media'], queryFn: adminApi.listMedia })

  const handleMediaLibUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setMediaLibUploading(true)
    try {
      const { upload_url } = await adminApi.presignUpload(file.name, file.type)
      await fetch(upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
      qc.invalidateQueries({ queryKey: ['admin-media'] })
      toast.success('Image uploaded')
    } catch {
      toast.error('Upload failed')
    } finally {
      setMediaLibUploading(false)
      if (mediaLibFileRef.current) mediaLibFileRef.current.value = ''
    }
  }

  const insertLink = () => {
    if (editor?.isActive('link')) {
      editor.chain().focus().unsetLink().run()
      return
    }
    const url = window.prompt('Enter URL')
    if (url) editor?.chain().focus().setLink({ href: url }).run()
  }

  const insertImageUrl = () => {
    const url = window.prompt('Enter image URL')
    if (url) editor?.chain().focus().setImage({ src: url }).run()
  }
  const createMut = useMutation({ mutationFn: adminApi.createArticle })
  const updateMut = useMutation({ mutationFn: ({ slug, body }: any) => adminApi.updateArticle(slug, body) })
  const deleteMut = useMutation({
    mutationFn: () => adminApi.deleteArticle(form.slug),
    onSuccess: () => { toast.success('Article deleted'); navigate('/articles') },
    onError: () => toast.error('Failed to delete article'),
  })

  const handleSave = async (overrideStatus?: string) => {
    setSaving(true)
    const body = {
      ...form,
      status: overrideStatus ?? form.status,
      body_html: editor?.getHTML() ?? '',
      tags: tagsInput.split(',').map((t: string) => t.trim()).filter(Boolean),
      category: form.category,
      author: form.author,
    }
    try {
      if (isNew) {
        const created = await createMut.mutateAsync(body)
        setDirty(false)
        toast.success('Article created')
        navigate(`/articles/${created.slug}/edit`)
      } else {
        await updateMut.mutateAsync({ slug: form.slug, body })
        qc.invalidateQueries({ queryKey: ['admin-article', slug] })
        setDirty(false)
        toast.success('Article saved')
      }
    } catch {
      toast.error('Failed to save article')
    } finally {
      setSaving(false)
    }
  }

  const wordCount = editor?.storage.characterCount?.words?.() ?? 0
  const readTime = Math.max(1, Math.ceil(wordCount / 240))

  const ToolbarBtn = ({ onClick, active, children, title }: any) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn('p-1.5 rounded transition-colors text-sm', active ? 'bg-indigo-600 text-white' : 'text-text-muted hover:text-text-primary hover:bg-surface-raised')}
    >
      {children}
    </button>
  )

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 md:px-6 py-3 border-b border-border bg-surface flex-shrink-0 gap-2">
        <h1 className="font-semibold text-text-primary text-sm truncate">{isNew ? 'New Article' : 'Edit Article'}</h1>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {!isNew && (
            <>
              <a href={`/article/${form.slug}`} target="_blank" rel="noopener" className="btn-secondary hidden sm:flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" /> Preview
              </a>
              <button onClick={() => { if (confirm('Delete this article?')) deleteMut.mutate() }} className="btn-danger hidden sm:flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </>
          )}
          <button onClick={() => handleSave('draft')} disabled={saving} className="btn-secondary flex items-center gap-1.5">
            <Save className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Save Draft</span>
          </button>
          <button onClick={() => handleSave('published')} disabled={saving} className="btn-primary flex items-center gap-1.5">
            {saving ? 'Saving...' : (form.status === 'published' ? 'Update' : 'Publish')}
          </button>
          <button
            onClick={() => setSettingsOpen(o => !o)}
            className="lg:hidden btn-secondary p-1.5"
            title="Article settings"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          {editor && (
            <div className="flex items-center gap-0.5 px-4 py-2 border-b border-border bg-surface flex-shrink-0 overflow-x-auto">
              <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold"><Bold className="w-4 h-4" /></ToolbarBtn>
              <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic"><Italic className="w-4 h-4" /></ToolbarBtn>
              <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="H2"><Heading2 className="w-4 h-4" /></ToolbarBtn>
              <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="H3"><Heading3 className="w-4 h-4" /></ToolbarBtn>
              <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote"><Quote className="w-4 h-4" /></ToolbarBtn>
              <ToolbarBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Inline code"><Code className="w-4 h-4" /></ToolbarBtn>
              <ToolbarBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Code block">
                <span className="font-mono text-xs">{'</>'}</span>
              </ToolbarBtn>
              <div className="w-px h-5 bg-border mx-1" />
              <ToolbarBtn onClick={insertLink} active={editor.isActive('link')} title="Insert / remove link"><Link2 className="w-4 h-4" /></ToolbarBtn>
              <ToolbarBtn onClick={insertImageUrl} title="Insert image by URL"><ImageIcon className="w-4 h-4" /></ToolbarBtn>
              <ToolbarBtn onClick={() => setMediaLibOpen(true)} title="Insert from media library"><Library className="w-4 h-4" /></ToolbarBtn>
              <div className="w-px h-5 bg-border mx-1" />
              <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} title="Undo"><Undo className="w-4 h-4" /></ToolbarBtn>
              <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} title="Redo"><Redo className="w-4 h-4" /></ToolbarBtn>
              <div className="w-px h-5 bg-border mx-1" />
              <ToolbarBtn onClick={() => { setHtmlInput(editor?.getHTML() ?? ''); setHtmlModalOpen(true) }} title="Edit raw HTML"><span className="font-mono text-[10px] font-bold">HTML</span></ToolbarBtn>
            </div>
          )}

          {/* Editor area */}
          <div className="flex-1 overflow-y-auto p-6">
            <EditorContent
              editor={editor}
              className="prose prose-invert max-w-none min-h-[400px] text-text-primary [&_.tiptap]:outline-none [&_.tiptap]:min-h-[400px]"
            />
          </div>

          {/* Paste HTML modal */}
          {htmlModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setHtmlModalOpen(false)}>
              <div className="bg-surface border border-border rounded-lg w-full max-w-2xl mx-4 p-4 flex flex-col gap-3" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-text-primary text-sm">Raw HTML</h3>
                  <button onClick={() => setHtmlModalOpen(false)} className="text-text-muted hover:text-text-primary"><X className="w-4 h-4" /></button>
                </div>
                <textarea
                  className="w-full h-80 font-mono text-xs bg-surface-raised border border-border rounded p-3 text-text-primary resize-none focus:outline-none focus:ring-1 focus:ring-accent"
                  value={htmlInput}
                  onChange={e => setHtmlInput(e.target.value)}
                  spellCheck={false}
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setHtmlModalOpen(false)} className="px-3 py-1.5 text-xs rounded border border-border text-text-muted hover:text-text-primary">Cancel</button>
                  <button
                    onClick={() => { editor?.commands.setContent(htmlInput); setDirty(true); setHtmlModalOpen(false) }}
                    className="px-3 py-1.5 text-xs rounded bg-accent text-white hover:bg-accent/90"
                  >Apply</button>
                </div>
              </div>
            </div>
          )}

          {/* Bottom status */}
          <div className="flex items-center gap-4 px-6 py-2 border-t border-border bg-surface flex-shrink-0 text-xs text-text-muted">
            <span>{wordCount} words</span>
            <span>~{readTime} min read</span>
            {dirty && <span className="text-yellow-500">● Unsaved changes</span>}
          </div>
        </div>

        {/* Settings panel — drawer on mobile, fixed panel on desktop */}
        {settingsOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/50" onClick={() => setSettingsOpen(false)} />
            <aside className="relative w-80 max-w-full bg-surface border-l border-border overflow-y-auto flex-shrink-0 p-4 space-y-4 z-10">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-text-primary text-sm">Article Settings</span>
                <button onClick={() => setSettingsOpen(false)} className="p-1 text-text-muted hover:text-text-primary"><X className="w-4 h-4" /></button>
              </div>
              <ArticleSettingsFields form={form} setForm={setForm} setDirty={setDirty} setSlugEdited={setSlugEdited} tagsInput={tagsInput} setTagsInput={setTagsInput} categories={categories} authors={authors} />
            </aside>
          </div>
        )}

        {/* Desktop settings sidebar */}
        <aside className="hidden lg:flex flex-col w-80 border-l border-border bg-surface flex-shrink-0 overflow-y-auto p-4 space-y-4">
          <span className="font-semibold text-text-primary text-sm">Article Settings</span>
          <ArticleSettingsFields form={form} setForm={setForm} setDirty={setDirty} setSlugEdited={setSlugEdited} tagsInput={tagsInput} setTagsInput={setTagsInput} categories={categories} authors={authors} />
        </aside>
      </div>

      {/* Media Library Modal */}
      {mediaLibOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMediaLibOpen(false)} />
          <div className="relative bg-surface border border-border rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col z-10">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <span className="font-semibold text-text-primary">Media Library — click to insert</span>
              <div className="flex items-center gap-2">
                <input ref={mediaLibFileRef} type="file" accept="image/*" className="hidden" onChange={handleMediaLibUpload} />
                <button onClick={() => mediaLibFileRef.current?.click()} disabled={mediaLibUploading} className="btn-secondary flex items-center gap-1.5 text-xs py-1">
                  <Upload className="w-3 h-3" />{mediaLibUploading ? 'Uploading…' : 'Upload'}
                </button>
                <button onClick={() => setMediaLibOpen(false)} className="p-1 text-text-muted hover:text-text-primary"><X className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {(mediaItems as any[]).length === 0 ? (
                <p className="text-center text-text-muted py-12">No media uploaded yet.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {(mediaItems as any[]).map((item: any) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => { editor?.chain().focus().setImage({ src: item.url }).run(); setMediaLibOpen(false) }}
                      className="group relative aspect-square overflow-hidden rounded-lg border border-border hover:border-indigo-500 transition-colors"
                    >
                      <img src={item.url} alt={item.filename} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-white text-xs font-medium">Insert</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ArticleSettingsFields({ form, setForm, setDirty, setSlugEdited, tagsInput, setTagsInput, categories, authors }: any) {
  const markDirty = () => setDirty?.(true)
  return (
    <>
      <div>
        <label className="form-label">Title *</label>
        <input value={form.title} onChange={e => { setForm((f: any) => ({ ...f, title: e.target.value })); markDirty() }} className="form-input" placeholder="Article title" />
      </div>
      <div>
        <label className="form-label">Subtitle</label>
        <input value={form.subtitle} onChange={e => setForm((f: any) => ({ ...f, subtitle: e.target.value }))} className="form-input" />
      </div>
      <div>
        <label className="form-label">Slug</label>
        <input value={form.slug} onChange={e => { setForm((f: any) => ({ ...f, slug: e.target.value })); setSlugEdited?.(true) }} className="form-input font-mono text-xs" />
      </div>
      <div>
        <label className="form-label">Excerpt <span className="text-text-muted">({form.excerpt?.length ?? 0}/160)</span></label>
        <textarea rows={3} value={form.excerpt} maxLength={160} onChange={e => setForm((f: any) => ({ ...f, excerpt: e.target.value }))} className="form-input resize-none" />
      </div>
      <div>
        <label className="form-label">Cover Image URL</label>
        <input value={form.cover_image_url} onChange={e => setForm((f: any) => ({ ...f, cover_image_url: e.target.value }))} className="form-input text-xs" placeholder="https://..." />
        {form.cover_image_url && <img src={form.cover_image_url} alt="cover" className="mt-2 w-full h-28 object-cover rounded" />}
      </div>
      <div>
        <label className="form-label">Category</label>
        <select
          value={form.category?.slug ?? ''}
          onChange={e => {
            const cat = categories.find((c: any) => c.slug === e.target.value)
            setForm((f: any) => ({ ...f, category: cat ? { slug: cat.slug, name: cat.name, color: cat.color } : null }))
          }}
          className="form-input"
        >
          <option value="">Select category</option>
          {categories.map((c: any) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label className="form-label">Author</label>
        <select
          value={form.author?.slug ?? ''}
          onChange={e => {
            const a = authors.find((a: any) => a.slug === e.target.value)
            setForm((f: any) => ({ ...f, author: a ? { slug: a.slug, name: a.name, avatar_url: a.avatar_url } : null }))
          }}
          className="form-input"
        >
          <option value="">Select author</option>
          {authors.map((a: any) => <option key={a.slug} value={a.slug}>{a.name}</option>)}
        </select>
      </div>
      <div>
        <label className="form-label">Tags (comma separated)</label>
        <input value={tagsInput} onChange={e => setTagsInput(e.target.value)} className="form-input text-xs" placeholder="ai, gaming, tech" />
      </div>
      <div>
        <label className="form-label">Published Date</label>
        <input type="datetime-local" value={form.published_at?.slice(0, 16) ?? ''} onChange={e => setForm((f: any) => ({ ...f, published_at: e.target.value }))} className="form-input text-xs" />
      </div>
      <div className="space-y-2">
        {[
          { key: 'is_featured', label: 'Featured' },
          { key: 'is_breaking', label: 'Breaking News' },
          { key: 'is_sponsored', label: 'Sponsored' },
        ].map(({ key, label }) => (
          <label key={key} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form[key] ?? false}
              onChange={e => setForm((f: any) => ({ ...f, [key]: e.target.checked }))}
              className="accent-indigo-600"
            />
            <span className="text-sm text-text-muted">{label}</span>
          </label>
        ))}
      </div>
      <div className="border-t border-border pt-4">
        <p className="form-label mb-3">SEO</p>
        <div className="space-y-3">
          <div>
            <label className="form-label">Meta Title <span>({form.seo_title?.length ?? 0}/60)</span></label>
            <input value={form.seo_title ?? ''} onChange={e => setForm((f: any) => ({ ...f, seo_title: e.target.value }))} maxLength={60} className="form-input text-xs" />
          </div>
          <div>
            <label className="form-label">Meta Description <span>({form.seo_description?.length ?? 0}/160)</span></label>
            <textarea rows={2} value={form.seo_description ?? ''} onChange={e => setForm((f: any) => ({ ...f, seo_description: e.target.value }))} maxLength={160} className="form-input text-xs resize-none" />
          </div>
        </div>
      </div>
    </>
  )
}
