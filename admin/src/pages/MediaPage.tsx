import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { adminApi } from '@/lib/api'
import { Upload, Trash2, Copy } from 'lucide-react'

export default function MediaPage() {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const { data: media = [], isLoading } = useQuery({ queryKey: ['admin-media'], queryFn: adminApi.listMedia })
  const deleteMut = useMutation({
    mutationFn: adminApi.deleteMedia,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-media'] }); toast.success('File deleted') },
    onError: () => toast.error('Failed to delete file'),
  })

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const { upload_url, public_url } = await adminApi.presignUpload(file.name, file.type)
      await fetch(upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
      qc.invalidateQueries({ queryKey: ['admin-media'] })
      toast.success('File uploaded')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url)
    setCopied(url)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-headline font-bold text-2xl text-text-primary">Media Library</h1>
        <div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
          <button onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-primary flex items-center gap-2">
            <Upload className="w-4 h-4" />
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-3">
          {Array.from({ length: 14 }).map((_, i) => <div key={i} className="aspect-square bg-surface-raised rounded animate-pulse" />)}
        </div>
      ) : (media as any[]).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-text-muted text-sm mb-4">No media uploaded yet. Upload your first image.</p>
          <button onClick={() => fileRef.current?.click()} className="btn-primary flex items-center gap-2"><Upload className="w-4 h-4" />Upload Image</button>
        </div>
      ) : (
        <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-3">
          {(media as any[]).map((obj: any) => (
            <div key={obj.key} className="group relative aspect-square rounded overflow-hidden bg-surface-raised border border-border">
              <img src={obj.url} alt={obj.key} className="w-full h-full object-cover" loading="lazy" />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button onClick={() => copyUrl(obj.url)} className="p-1.5 bg-bg/80 rounded text-white hover:bg-indigo-600 transition-colors" title="Copy URL">
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => { if (confirm('Delete this file?')) deleteMut.mutate(obj.key) }} className="p-1.5 bg-bg/80 rounded text-white hover:bg-red-600 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {copied === obj.url && (
                <div className="absolute bottom-0 left-0 right-0 bg-green-600 text-white text-[10px] text-center py-0.5">Copied!</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
