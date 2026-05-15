import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { Zap } from 'lucide-react'

export function BreakingTicker() {
  const { data: articles = [] } = useQuery({
    queryKey: ['breaking'],
    queryFn: () => api.getArticles({ breaking: true, limit: 10 }),
    select: (d) => d.items,
    staleTime: 2 * 60 * 1000,
  })

  if (articles.length === 0) return null

  return (
    <div className="bg-accent-red text-white py-1.5 overflow-hidden">
      <div className="flex items-center">
        <div className="flex-shrink-0 flex items-center gap-1.5 bg-red-700 px-3 py-0.5 z-10">
          <Zap className="w-3 h-3" />
          <span className="text-xs font-bold tracking-wider uppercase">Breaking</span>
        </div>
        <div className="overflow-hidden flex-1 pl-3">
          <div className="flex gap-8 animate-[ticker_30s_linear_infinite]" style={{ animation: 'ticker 30s linear infinite' }}>
            {[...articles, ...articles].map((a, i) => (
              <Link
                key={`${a.slug}-${i}`}
                to={`/article/${a.slug}`}
                className="text-xs font-medium whitespace-nowrap hover:underline"
              >
                {a.title}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}
