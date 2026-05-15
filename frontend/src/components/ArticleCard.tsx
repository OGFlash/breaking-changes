import { Link } from 'react-router-dom'
import { Clock, Eye } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import type { ArticleMeta } from '@/types'

interface ArticleCardProps {
  article: ArticleMeta
  size?: 'default' | 'large' | 'small'
  className?: string
}

export function ArticleCard({ article, size = 'default', className }: ArticleCardProps) {
  const isLarge = size === 'large'
  const isSmall = size === 'small'

  return (
    <Link
      to={`/article/${article.slug}`}
      className={cn(
        'card group flex flex-col overflow-hidden hover:border-border hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5',
        isLarge && 'md:flex-row',
        className
      )}
    >
      {/* Cover image */}
      {article.cover_image_url && (
        <div
          className={cn(
            'relative overflow-hidden bg-surface-raised flex-shrink-0',
            isLarge ? 'md:w-96 h-52 md:h-auto' : isSmall ? 'h-36' : 'h-48'
          )}
        >
          <img
            src={article.cover_image_url}
            alt={article.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          {article.is_breaking && (
            <span className="absolute top-2 left-2 bg-accent-red text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide">
              Breaking
            </span>
          )}
          {article.is_sponsored && (
            <span className="absolute top-2 right-2 bg-black/60 text-text-muted text-[10px] px-2 py-0.5 rounded">
              Sponsored
            </span>
          )}
        </div>
      )}

      {/* Content */}
      <div className={cn('flex flex-col flex-1 p-4', isLarge && 'md:p-6')}>
        {/* Category badge */}
        <span
          className="text-xs font-semibold uppercase tracking-wider mb-2 self-start"
          style={{ color: article.category.color }}
        >
          {article.category.name}
        </span>

        {/* Title */}
        <h3
          className={cn(
            'font-headline font-bold text-text-primary leading-snug mb-2 group-hover:text-accent-blue transition-colors line-clamp-2',
            isLarge ? 'text-xl md:text-2xl' : isSmall ? 'text-sm' : 'text-base'
          )}
        >
          {article.title}
        </h3>

        {/* Excerpt */}
        {!isSmall && (
          <p className="text-text-muted text-sm leading-relaxed line-clamp-2 flex-1 mb-3">
            {article.excerpt}
          </p>
        )}

        {/* Meta */}
        <div className="flex items-center gap-3 text-xs text-text-muted mt-auto">
          {article.author.avatar_url && (
            <img
              src={article.author.avatar_url}
              alt={article.author.name}
              className="w-5 h-5 rounded-full object-cover"
            />
          )}
          <span>{article.author.name}</span>
          <span>·</span>
          <span>{formatDate(article.published_at)}</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {article.read_time_minutes}m
          </span>
          {article.view_count !== undefined && (
            <span className="flex items-center gap-1 ml-auto">
              <Eye className="w-3 h-3" />
              {article.view_count.toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
