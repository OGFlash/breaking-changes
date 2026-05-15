import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { adminApi } from '@/lib/api'
import { cn } from '@/lib/utils'

const SLOT_LABELS: Record<string, string> = {
  leaderboard_top: 'Homepage Leaderboard (Top)',
  leaderboard_bottom: 'Homepage Leaderboard (Bottom)',
  sidebar_article: 'Article Sidebar',
  inline_article: 'Article Inline (Mid-content)',
  footer_banner: 'Footer Banner',
}

export default function AdsPage() {
  const qc = useQueryClient()
  const { data: ads = [] } = useQuery({ queryKey: ['admin-ads'], queryFn: adminApi.getAds })
  const [editing, setEditing] = useState<string | null>(null)
  const [codeMap, setCodeMap] = useState<Record<string, string>>({})

  const save = useMutation({
    mutationFn: ({ slot_id, data }: { slot_id: string; data: any }) => adminApi.updateAd(slot_id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-ads'] }); setEditing(null); toast.success('Ad slot saved') },
    onError: () => toast.error('Failed to save ad slot'),
  })
  const toggle = useMutation({
    mutationFn: ({ slot_id, is_active }: { slot_id: string; is_active: boolean }) => adminApi.updateAd(slot_id, { is_active }),
    onSuccess: (_data, vars) => { qc.invalidateQueries({ queryKey: ['admin-ads'] }); toast.success(vars.is_active ? 'Ad enabled' : 'Ad disabled') },
    onError: () => toast.error('Failed to update ad'),
  })

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="font-headline font-bold text-2xl text-text-primary">Ad Slots</h1>
        <p className="text-sm text-text-muted mt-1">Paste your ad network code (Google AdSense, Carbon, etc.) into each slot.</p>
      </div>

      <div className="space-y-4">
        {(ads as any[]).map((ad) => {
          const isEditing = editing === ad.slot_id
          const label = SLOT_LABELS[ad.slot_id] ?? ad.slot_id
          return (
            <div key={ad.slot_id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium text-text-primary">{label}</h3>
                  <p className="text-xs text-text-muted mt-0.5 font-mono">{ad.slot_id}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => toggle.mutate({ slot_id: ad.slot_id, is_active: !ad.is_active })}
                    className={cn('relative inline-flex h-5 w-9 rounded-full transition-colors', ad.is_active ? 'bg-green-500' : 'bg-zinc-700')}
                  >
                    <span className={cn('inline-block w-4 h-4 rounded-full bg-white shadow transition-transform mt-0.5', ad.is_active ? 'translate-x-4' : 'translate-x-0.5')} />
                  </button>
                  <span className="text-xs text-text-muted">{ad.is_active ? 'Active' : 'Inactive'}</span>
                  <button
                    onClick={() => { setEditing(isEditing ? null : ad.slot_id); setCodeMap(m => ({ ...m, [ad.slot_id]: ad.code ?? '' })) }}
                    className="btn-secondary text-xs py-1 px-3"
                  >{isEditing ? 'Cancel' : 'Edit Code'}</button>
                </div>
              </div>

              {isEditing && (
                <div className="mt-4">
                  <label className="label">Ad Code (HTML / JS)</label>
                  <textarea
                    className="input w-full h-36 resize-none font-mono text-xs"
                    placeholder="<!-- Your ad code here -->"
                    value={codeMap[ad.slot_id] ?? ''}
                    onChange={e => setCodeMap(m => ({ ...m, [ad.slot_id]: e.target.value }))}
                  />
                  <div className="flex justify-end gap-3 mt-3">
                    <button onClick={() => setEditing(null)} className="btn-secondary text-xs py-1 px-3">Cancel</button>
                    <button
                      onClick={() => save.mutate({ slot_id: ad.slot_id, data: { code: codeMap[ad.slot_id] } })}
                      className="btn-primary text-xs py-1 px-3"
                      disabled={save.isPending}
                    >{save.isPending ? 'Saving…' : 'Save'}</button>
                  </div>
                </div>
              )}

              {!isEditing && ad.code && (
                <p className="mt-3 text-xs text-text-muted font-mono truncate opacity-50">{ad.code.slice(0, 120)}{ad.code.length > 120 ? '…' : ''}</p>
              )}
              {!isEditing && !ad.code && (
                <p className="mt-3 text-xs text-text-muted italic">No code — click Edit Code to add</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
