import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

interface AdSlotProps {
  slotId: string
  className?: string
}

export function AdSlot({ slotId, className }: AdSlotProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
    staleTime: 10 * 60 * 1000,
  })

  const slot = settings?.ad_slots?.find(s => s.id === slotId)

  useEffect(() => {
    if (!slot?.code || !slot.active || !containerRef.current) return
    const div = containerRef.current
    div.innerHTML = ''
    const wrapper = document.createElement('div')
    wrapper.innerHTML = slot.code

    // Execute scripts
    Array.from(wrapper.querySelectorAll('script')).forEach(oldScript => {
      const newScript = document.createElement('script')
      Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value))
      newScript.textContent = oldScript.textContent
      oldScript.replaceWith(newScript)
    })
    div.appendChild(wrapper)
  }, [slot])

  if (!slot?.code || !slot.active) return null

  return (
    <div className={cn('my-4', className)}>
      <p className="text-[10px] text-text-muted text-center mb-1 uppercase tracking-wider">Advertisement</p>
      <div ref={containerRef} className="flex justify-center" />
    </div>
  )
}
