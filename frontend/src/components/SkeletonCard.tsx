import { cn } from '@/lib/utils'

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('card animate-pulse', className)}>
      <div className="h-48 bg-surface-raised" />
      <div className="p-4 space-y-3">
        <div className="h-3 bg-surface-raised rounded w-1/4" />
        <div className="h-5 bg-surface-raised rounded w-full" />
        <div className="h-5 bg-surface-raised rounded w-3/4" />
        <div className="h-3 bg-surface-raised rounded w-2/3" />
        <div className="flex gap-2 pt-1">
          <div className="h-3 bg-surface-raised rounded w-16" />
          <div className="h-3 bg-surface-raised rounded w-20" />
          <div className="h-3 bg-surface-raised rounded w-12" />
        </div>
      </div>
    </div>
  )
}
