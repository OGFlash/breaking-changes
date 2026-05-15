import { useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { adminApi } from '@/lib/api'

export default function SettingsPage() {
  const { data: settings } = useQuery({ queryKey: ['admin-settings'], queryFn: adminApi.getSettings })
  const { register, handleSubmit, reset, watch, formState: { isDirty, isSubmitting } } = useForm()

  useEffect(() => { if (settings) reset(settings) }, [settings, reset])

  const save = useMutation({
    mutationFn: (data: any) => adminApi.updateSettings(data),
    onSuccess: () => toast.success('Settings saved'),
    onError: () => toast.error('Failed to save settings'),
  })

  const [logoUrl, logoDarkUrl, faviconUrl, ogImageUrl] = watch(['logo_url', 'logo_dark_url', 'favicon_url', 'default_og_image'])

  const ImgPreview = ({ src }: { src?: string }) =>
    src ? <img src={src} alt="preview" className="mt-2 h-10 max-w-[200px] rounded object-contain bg-surface-raised border border-border p-1" onError={e => (e.currentTarget.style.display = 'none')} /> : null

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="font-headline font-bold text-2xl text-text-primary mb-6">Site Settings</h1>

      <form onSubmit={handleSubmit((d) => save.mutate(d))} className="space-y-8">
        {/* Brand */}
        <Section title="Brand">
          <Field label="Site Name"><input className="input w-full" {...register('site_name')} /></Field>
          <Field label="Tagline"><input className="input w-full" {...register('tagline')} /></Field>
          <Field label="Logo URL (light)"><input className="input w-full" placeholder="https://…" {...register('logo_url')} /><ImgPreview src={logoUrl} /></Field>
          <Field label="Logo URL (dark)"><input className="input w-full" placeholder="https://…" {...register('logo_dark_url')} /><ImgPreview src={logoDarkUrl} /></Field>
          <Field label="Favicon URL"><input className="input w-full" placeholder="https://…" {...register('favicon_url')} /><ImgPreview src={faviconUrl} /></Field>
        </Section>

        {/* Newsletter */}
        <Section title="Newsletter">
          <Field label="Beehiiv Publication ID"><input className="input w-full" placeholder="pub_xxxxxxxx" {...register('beehiiv_publication_id')} /></Field>
          <Field label="Beehiiv Embed URL"><input className="input w-full" placeholder="https://embeds.beehiiv.com/…" {...register('beehiiv_embed_url')} /></Field>
          <Field label="Newsletter CTA Text"><input className="input w-full" {...register('newsletter_cta')} /></Field>
        </Section>

        {/* Social */}
        <Section title="Social Links">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Twitter / X"><input className="input w-full" placeholder="@handle" {...register('social_twitter')} /></Field>
            <Field label="GitHub"><input className="input w-full" placeholder="org/user" {...register('social_github')} /></Field>
            <Field label="Mastodon"><input className="input w-full" placeholder="https://…" {...register('social_mastodon')} /></Field>
            <Field label="YouTube"><input className="input w-full" placeholder="https://…" {...register('social_youtube')} /></Field>
          </div>
        </Section>

        {/* Analytics */}
        <Section title="Analytics & Tracking">
          <Field label="Google Analytics ID" hint="e.g. G-XXXXXXXXXX"><input className="input w-full" placeholder="G-…" {...register('ga_measurement_id')} /></Field>
        </Section>

        {/* SEO Defaults */}
        <Section title="SEO Defaults">
          <Field label="Default OG Image URL"><input className="input w-full" placeholder="https://…" {...register('default_og_image')} /><ImgPreview src={ogImageUrl} /></Field>
          <Field label="Site Description (meta)"><textarea className="input w-full h-20 resize-none" {...register('site_description')} /></Field>
        </Section>

        <div className="flex gap-3">
          <button type="submit" className="btn-primary" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? 'Saving…' : 'Save Settings'}
          </button>
          {save.isSuccess && <span className="text-sm text-green-400 leading-9">Saved!</span>}
        </div>
      </form>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h2 className="font-semibold text-text-primary text-sm mb-4 pb-3 border-b border-border">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}{hint && <span className="text-text-muted font-normal ml-2">{hint}</span>}</label>
      {children}
    </div>
  )
}
