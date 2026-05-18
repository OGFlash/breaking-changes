import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { api } from '@/lib/api'

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('sending')
    try {
      await api.submitContact(form)
      setStatus('sent')
      setForm({ name: '', email: '', subject: '', message: '' })
    } catch {
      setStatus('error')
    }
  }

  const field = (key: keyof typeof form, label: string, type?: string, rows?: number) => (
    <div>
      <label className="block text-sm font-medium text-text-primary mb-1.5">{label}</label>
      {rows ? (
        <textarea
          rows={rows}
          value={form[key]}
          onChange={e => setForm({ ...form, [key]: e.target.value })}
          required
          className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-text-primary placeholder-text-muted outline-none focus:border-accent-blue transition-colors resize-none"
        />
      ) : (
        <input
          type={type ?? 'text'}
          value={form[key]}
          onChange={e => setForm({ ...form, [key]: e.target.value })}
          required
          className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-text-primary placeholder-text-muted outline-none focus:border-accent-blue transition-colors"
        />
      )}
    </div>
  )

  return (
    <>
      <Helmet>
        <title>Contact — Breaking Changes</title>
        <link rel="canonical" href="https://breakchange.com/contact" />
      </Helmet>
      <div className="max-w-lg mx-auto px-4 py-12">
        <h1 className="font-headline font-bold text-4xl mb-2">Contact Us</h1>
        <p className="text-text-muted mb-8">Have a tip, question, or partnership inquiry? We'd love to hear from you.</p>

        {status === 'sent' ? (
          <div className="card p-8 text-center">
            <p className="text-2xl mb-2">✅</p>
            <h2 className="font-headline font-bold text-xl mb-2">Message sent!</h2>
            <p className="text-text-muted">We'll get back to you as soon as possible.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {field('name', 'Name')}
            {field('email', 'Email', 'email')}
            {field('subject', 'Subject')}
            {field('message', 'Message', undefined, 6)}
            {status === 'error' && (
              <p className="text-accent-red text-sm">Something went wrong. Please try again.</p>
            )}
            <button
              type="submit"
              disabled={status === 'sending'}
              className="btn-primary w-full disabled:opacity-60"
            >
              {status === 'sending' ? 'Sending...' : 'Send message'}
            </button>
          </form>
        )}
      </div>
    </>
  )
}
