import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/lib/api'
import { toast } from 'sonner'
import {
  Wand2, Search, RefreshCw, ChevronRight, Check, Zap, BookOpen,
  FileText, ExternalLink, AlertTriangle, Plus, X, Globe, Hash
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Phase = 'discover' | 'research' | 'generate'

const SITE_CATEGORIES = ['ai', 'security', 'dev-tools', 'gaming', 'business', 'politics']

// ── Source badge colours ────────────────────────────────────────────────────
function SourceBadge({ source }: { source: string }) {
  const s = source.toLowerCase()
  const cls = s.includes('hacker') ? 'bg-orange-500/20 text-orange-400'
    : s.includes('reddit') ? 'bg-red-500/20 text-red-400'
    : s.includes('google') ? 'bg-blue-500/20 text-blue-400'
    : 'bg-surface-raised text-text-muted'
  return <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', cls)}>{source}</span>
}

// ── Category badge ───────────────────────────────────────────────────────────
function CategoryBadge({ cat }: { cat: string }) {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 font-medium">
      {cat}
    </span>
  )
}

// ── Score bar ────────────────────────────────────────────────────────────────
function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score))
  const color = pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-surface-raised'
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1 bg-border rounded overflow-hidden">
        <div className={cn('h-full rounded transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-text-muted w-6 text-right">{pct}</span>
    </div>
  )
}

// ── Step indicator ───────────────────────────────────────────────────────────
function StepIndicator({ phase }: { phase: Phase }) {
  const steps: { id: Phase; label: string; icon: React.ReactNode }[] = [
    { id: 'discover', label: 'Discover', icon: <Search className="w-3.5 h-3.5" /> },
    { id: 'research', label: 'Research', icon: <BookOpen className="w-3.5 h-3.5" /> },
    { id: 'generate', label: 'Generate', icon: <FileText className="w-3.5 h-3.5" /> },
  ]
  const idx = steps.findIndex(s => s.id === phase)
  return (
    <div className="flex items-center gap-0">
      {steps.map((step, i) => {
        const done = i < idx
        const active = i === idx
        return (
          <div key={step.id} className="flex items-center">
            <div className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors',
              done ? 'text-green-400' : active ? 'text-text-primary' : 'text-text-muted'
            )}>
              {done ? <Check className="w-3.5 h-3.5 text-green-400" /> : step.icon}
              {step.label}
            </div>
            {i < steps.length - 1 && (
              <ChevronRight className={cn('w-3.5 h-3.5', i < idx ? 'text-green-400' : 'text-border')} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Loading overlay ──────────────────────────────────────────────────────────
function LoadingCard({ messages }: { messages: string[] }) {
  const [msgIdx] = useState(0)
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      <div className="text-center">
        <p className="text-sm text-text-primary font-medium">{messages[msgIdx]}</p>
        <p className="text-xs text-text-muted mt-1">The AI agent is working — this may take 30–60 seconds</p>
      </div>
      <div className="flex gap-1 mt-2">
        {messages.map((_, i) => (
          <div key={i} className={cn('w-1.5 h-1.5 rounded-full', i === msgIdx ? 'bg-indigo-400' : 'bg-border')} />
        ))}
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function AiWriterPage() {
  const navigate = useNavigate()
  const { data: authors = [] } = useQuery({ queryKey: ['admin-authors'], queryFn: adminApi.getAuthors })

  // ── Phase state ──
  const [phase, setPhase] = useState<Phase>('discover')

  // ── Discover phase ──
  const [scanLoading, setScanLoading] = useState(false)
  const [topics, setTopics] = useState<any[]>([])
  const [customTitle, setCustomTitle] = useState('')
  const [customUrls, setCustomUrls] = useState('')
  const [customCategory, setCustomCategory] = useState('ai')
  const [selectedTopic, setSelectedTopic] = useState<any>(null)

  // ── Research phase ──
  const [researchLoading, setResearchLoading] = useState(false)
  const [brief, setBrief] = useState<any>(null)

  // ── Generate phase ──
  const [wordCount, setWordCount] = useState(600)
  const [authorSlug, setAuthorSlug] = useState('bc-staff')
  const [generateLoading, setGenerateLoading] = useState(false)
  const [draft, setDraft] = useState<any>(null)
  const [tagsInput, setTagsInput] = useState('')
  const [saveLoading, setSaveLoading] = useState(false)

  // ── Polling helper ──
  const pollUntilDone = async (job_id: string): Promise<any> => {
    for (;;) {
      const job = await adminApi.aiPollJob(job_id)
      if (job.status === 'done') return job.result
      if (job.status === 'error') throw new Error(job.error || 'Job failed')
      await new Promise(r => setTimeout(r, 3000))
    }
  }

  // ── Handlers ──

  const handleScan = async () => {
    setScanLoading(true)
    setTopics([])
    try {
      const { job_id } = await adminApi.aiTrends(SITE_CATEGORIES)
      const result = await pollUntilDone(job_id)
      setTopics(Array.isArray(result) ? result : result?.topics ?? [])
    } catch (e: any) {
      toast.error(e.message || 'Failed to scan for trends')
    } finally {
      setScanLoading(false)
    }
  }

  const handleSelectTopic = async (topic: any) => {
    setSelectedTopic(topic)
    setPhase('research')
    await startResearch(topic.title, [topic.original_url, topic.source_url].filter(Boolean), topic.category || 'ai')
  }

  const handleCustomTopic = async () => {
    if (!customTitle.trim()) return
    const urlList = customUrls.split('\n').map(u => u.trim()).filter(Boolean)
    const topic = { title: customTitle.trim(), original_url: urlList[0] || '', source_url: '', category: customCategory }
    setSelectedTopic(topic)
    setPhase('research')
    await startResearch(topic.title, urlList, customCategory)
  }

  const startResearch = async (title: string, urls: string[], category: string) => {
    setResearchLoading(true)
    setBrief(null)
    try {
      const { job_id } = await adminApi.aiResearch(title, urls, category)
      const result = await pollUntilDone(job_id)
      const b = result?.brief ?? result
      setBrief(b)
    } catch (e: any) {
      toast.error(e.message || 'Research failed')
      setPhase('discover')
    } finally {
      setResearchLoading(false)
    }
  }

  const handleGenerate = async () => {
    if (!brief) return
    setGenerateLoading(true)
    setDraft(null)
    try {
      const { job_id } = await adminApi.aiGenerate(brief, wordCount)
      const result = await pollUntilDone(job_id)
      const d = result?.draft ?? result
      setDraft(d)
      setTagsInput((d.tags || []).join(', '))
      setPhase('generate')
    } catch (e: any) {
      toast.error(e.message || 'Generation failed')
    } finally {
      setGenerateLoading(false)
    }
  }

  const handleRegenerate = async () => {
    if (!brief) return
    setGenerateLoading(true)
    try {
      const { job_id } = await adminApi.aiGenerate(brief, wordCount)
      const result = await pollUntilDone(job_id)
      const d = result?.draft ?? result
      setDraft(d)
      setTagsInput((d.tags || []).join(', '))
      toast.success('Article regenerated')
    } catch (e: any) {
      toast.error(e.message || 'Regeneration failed')
    } finally {
      setGenerateLoading(false)
    }
  }

  const handleSave = async () => {
    if (!draft) return
    setSaveLoading(true)
    try {
      const finalDraft = {
        ...draft,
        tags: tagsInput.split(',').map((t: string) => t.trim()).filter(Boolean),
      }
      const { slug } = await adminApi.aiSaveDraft(finalDraft, authorSlug)
      toast.success('Draft saved')
      navigate(`/articles/${slug}/edit`)
    } catch (e: any) {
      toast.error(e.message || 'Failed to save draft')
    } finally {
      setSaveLoading(false)
    }
  }

  const resetToDiscover = () => {
    setPhase('discover')
    setBrief(null)
    setDraft(null)
    setSelectedTopic(null)
    setTopics([])
  }

  // ── Render ──
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <Wand2 className="w-5 h-5 text-indigo-400" />
          <div>
            <h1 className="font-semibold text-text-primary text-sm">AI Writer</h1>
            <p className="text-xs text-text-muted">Agentic article generation · Claude {import.meta.env.VITE_LLM_MODEL || 'Sonnet 4.6'}</p>
          </div>
        </div>
        <StepIndicator phase={phase} />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">

          {/* ── Phase 1 — Discover ─────────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <Search className="w-4 h-4 text-text-muted" /> Discover Trends
              </h2>
              {phase !== 'discover' && (
                <button onClick={resetToDiscover} className="text-xs text-text-muted hover:text-text-primary flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> Start over
                </button>
              )}
            </div>

            {/* Custom topic */}
            <div className="bg-surface border border-border rounded-lg p-4 mb-4">
              <p className="text-xs font-medium text-text-muted mb-2">Custom topic (skip discovery)</p>
              <input
                className="w-full bg-surface-raised border border-border rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-indigo-500 mb-2"
                placeholder="e.g. Anthropic releases Claude Mythos Preview"
                value={customTitle}
                onChange={e => setCustomTitle(e.target.value)}
                disabled={phase !== 'discover'}
              />
              <textarea
                className="w-full bg-surface-raised border border-border rounded px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-indigo-500 mb-2 resize-none h-16"
                placeholder="Source URLs (one per line)"
                value={customUrls}
                onChange={e => setCustomUrls(e.target.value)}
                disabled={phase !== 'discover'}
              />
              <div className="flex items-center gap-2">
                <select
                  className="bg-surface-raised border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none"
                  value={customCategory}
                  onChange={e => setCustomCategory(e.target.value)}
                  disabled={phase !== 'discover'}
                >
                  {SITE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button
                  onClick={handleCustomTopic}
                  disabled={!customTitle.trim() || phase !== 'discover'}
                  className="px-3 py-1.5 text-xs rounded bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Research this topic
                </button>
              </div>
            </div>

            {/* Scan button */}
            <button
              onClick={handleScan}
              disabled={scanLoading || phase !== 'discover'}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-border text-sm text-text-muted hover:border-indigo-500 hover:text-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {scanLoading
                ? <><div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />Scanning trends…</>
                : <><Zap className="w-4 h-4" /> Scan for Trends</>
              }
            </button>

            {/* Topics list */}
            {topics.length > 0 && phase === 'discover' && (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-text-muted">{topics.length} trending topics found</p>
                {topics.map((topic, i) => (
                  <div
                    key={topic.id || i}
                    className="bg-surface border border-border rounded-lg p-3 hover:border-indigo-500/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xs text-text-muted font-mono mt-0.5 w-5 flex-shrink-0">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text-primary font-medium leading-snug mb-1">{topic.title}</p>
                        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                          <SourceBadge source={topic.source} />
                          <CategoryBadge cat={topic.category} />
                          <span className="text-[10px] text-text-muted">{topic.signals?.age_hours?.toFixed(1)}h ago</span>
                          {topic.signals?.upvotes > 0 && (
                            <span className="text-[10px] text-text-muted">▲ {topic.signals.upvotes}</span>
                          )}
                        </div>
                        <ScoreBar score={topic.score} />
                        {topic.snippet && (
                          <p className="text-[11px] text-text-muted mt-1.5 line-clamp-2">{topic.snippet}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleSelectTopic(topic)}
                          className="px-2.5 py-1 text-xs rounded bg-indigo-600 text-white hover:bg-indigo-500 whitespace-nowrap"
                        >
                          Write this
                        </button>
                        {topic.original_url && (
                          <a
                            href={topic.original_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-1 px-2 py-1 text-[10px] text-text-muted hover:text-text-primary border border-border rounded"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Phase 2 — Research ─────────────────────────────────────────── */}
          {(phase === 'research' || phase === 'generate') && (
            <section className="border-t border-border pt-6">
              <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-text-muted" /> Research Brief
                {selectedTopic && (
                  <span className="text-text-muted font-normal">— {selectedTopic.title}</span>
                )}
              </h2>

              {researchLoading && (
                <LoadingCard messages={[
                  'Fetching primary sources…',
                  'Extracting article content…',
                  'Analysing key facts…',
                  'Building research brief…',
                ]} />
              )}

              {brief && !researchLoading && (
                <div className="bg-surface border border-border rounded-lg p-4 space-y-4">
                  {/* Key Facts */}
                  {brief.key_facts?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Key Facts</p>
                      <ul className="space-y-1">
                        {brief.key_facts.map((f: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-text-primary">
                            <span className="text-indigo-400 mt-0.5 flex-shrink-0">•</span>
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Key Quotes */}
                  {brief.key_quotes?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Key Quotes</p>
                      {brief.key_quotes.map((q: any, i: number) => (
                        <blockquote key={i} className="border-l-2 border-indigo-500 pl-3 py-0.5 mb-2">
                          <p className="text-sm text-text-primary italic">"{q.quote}"</p>
                          {q.attribution && <p className="text-xs text-text-muted mt-0.5">— {q.attribution}</p>}
                        </blockquote>
                      ))}
                    </div>
                  )}

                  {/* Sources */}
                  {brief.sources?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Sources</p>
                      <div className="space-y-1">
                        {brief.sources.map((s: any, i: number) => (
                          <a
                            key={i}
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs text-indigo-400 hover:underline"
                          >
                            <Globe className="w-3 h-3 flex-shrink-0" />
                            {s.title || s.url}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggested angles */}
                  {brief.suggested_angles?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Suggested Angles</p>
                      <div className="flex flex-wrap gap-1.5">
                        {brief.suggested_angles.map((a: string, i: number) => (
                          <span key={i} className="text-[11px] px-2 py-0.5 bg-surface-raised rounded text-text-muted">{a}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Generate controls */}
                  {phase !== 'generate' && (
                    <div className="flex items-center gap-3 pt-2 border-t border-border">
                      <div>
                        <p className="text-xs text-text-muted mb-1">Word count</p>
                        <div className="flex gap-1">
                          {[400, 600, 800].map(wc => (
                            <button
                              key={wc}
                              onClick={() => setWordCount(wc)}
                              className={cn(
                                'px-2.5 py-1 text-xs rounded border',
                                wordCount === wc
                                  ? 'border-indigo-500 bg-indigo-500/20 text-indigo-400'
                                  : 'border-border text-text-muted hover:border-indigo-500/50'
                              )}
                            >
                              {wc}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-text-muted mb-1">Author</p>
                        <select
                          className="bg-surface-raised border border-border rounded px-2 py-1 text-xs text-text-primary focus:outline-none"
                          value={authorSlug}
                          onChange={e => setAuthorSlug(e.target.value)}
                        >
                          <option value="bc-staff">BC Staff</option>
                          {authors.map((a: any) => (
                            <option key={a.slug} value={a.slug}>{a.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="ml-auto">
                        <button
                          onClick={handleGenerate}
                          disabled={generateLoading}
                          className="flex items-center gap-2 px-4 py-2 text-sm rounded bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40"
                        >
                          {generateLoading
                            ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            : <Wand2 className="w-4 h-4" />
                          }
                          Generate Article
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* ── Phase 3 — Generated Draft ─────────────────────────────────── */}
          {phase === 'generate' && (
            <section className="border-t border-border pt-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  <FileText className="w-4 h-4 text-text-muted" /> Generated Draft
                </h2>
                <button
                  onClick={handleRegenerate}
                  disabled={generateLoading}
                  className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary disabled:opacity-40"
                >
                  <RefreshCw className={cn('w-3.5 h-3.5', generateLoading && 'animate-spin')} />
                  Regenerate
                </button>
              </div>

              {generateLoading && (
                <LoadingCard messages={['Generating article…', 'Writing body HTML…', 'Generating metadata…', 'Fetching cover image…']} />
              )}

              {draft && !generateLoading && (
                <div className="space-y-4">
                  {/* AI warning banner */}
                  <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-yellow-300">
                      <strong>AI-generated draft</strong> — verify all facts before publishing.
                      Check sources in the research brief above.
                    </p>
                  </div>

                  {/* Cover image */}
                  {draft.cover_image_url && (
                    <div>
                      <p className="text-xs text-text-muted mb-1.5">Cover Image</p>
                      <img
                        src={draft.cover_image_url}
                        alt="Cover"
                        className="w-full h-40 object-cover rounded-lg border border-border"
                      />
                    </div>
                  )}

                  {/* Editable metadata fields */}
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="block text-xs text-text-muted mb-1">Title</label>
                      <input
                        className="w-full bg-surface-raised border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        value={draft.title || ''}
                        onChange={e => setDraft({ ...draft, title: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-text-muted mb-1">Subtitle</label>
                      <input
                        className="w-full bg-surface-raised border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        value={draft.subtitle || ''}
                        onChange={e => setDraft({ ...draft, subtitle: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-text-muted mb-1">Excerpt</label>
                      <textarea
                        className="w-full bg-surface-raised border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none h-16"
                        value={draft.excerpt || ''}
                        onChange={e => setDraft({ ...draft, excerpt: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-text-muted mb-1">SEO Title</label>
                        <input
                          className="w-full bg-surface-raised border border-border rounded px-3 py-2 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          value={draft.seo_title || ''}
                          onChange={e => setDraft({ ...draft, seo_title: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-text-muted mb-1">Tags (comma-separated)</label>
                        <input
                          className="w-full bg-surface-raised border border-border rounded px-3 py-2 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          value={tagsInput}
                          onChange={e => setTagsInput(e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-text-muted mb-1">SEO Description</label>
                      <input
                        className="w-full bg-surface-raised border border-border rounded px-3 py-2 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        value={draft.seo_description || ''}
                        onChange={e => setDraft({ ...draft, seo_description: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Body preview */}
                  <div>
                    <p className="text-xs text-text-muted mb-2">Body Preview</p>
                    <div
                      className="prose prose-invert prose-sm max-w-none bg-surface border border-border rounded-lg p-4 text-text-primary [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-4 [&_p]:text-sm [&_p]:leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: draft.body_html || '' }}
                    />
                  </div>

                  {/* Save controls */}
                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-text-muted">Author:</p>
                      <select
                        className="bg-surface-raised border border-border rounded px-2 py-1 text-xs text-text-primary focus:outline-none"
                        value={authorSlug}
                        onChange={e => setAuthorSlug(e.target.value)}
                      >
                        <option value="bc-staff">BC Staff</option>
                        {authors.map((a: any) => (
                          <option key={a.slug} value={a.slug}>{a.name}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={handleSave}
                      disabled={saveLoading}
                      className="flex items-center gap-2 px-5 py-2.5 rounded bg-green-600 text-white text-sm hover:bg-green-500 disabled:opacity-40 font-medium"
                    >
                      {saveLoading
                        ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <FileText className="w-4 h-4" />
                      }
                      Save as Draft
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

        </div>
      </div>
    </div>
  )
}
