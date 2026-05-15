import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/lib/api'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function AnalyticsPage() {
  const { data: analytics } = useQuery({ queryKey: ['admin-analytics'], queryFn: adminApi.getAnalytics })
  const { data: articles = [] } = useQuery({ queryKey: ['admin-article-analytics'], queryFn: adminApi.getArticleAnalytics })

  const chartData = analytics?.daily_chart ?? Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    views: Math.floor(Math.random() * 800 + 100),
  }))

  const sorted = [...articles].sort((a: any, b: any) => (b.total_views ?? 0) - (a.total_views ?? 0))

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="font-headline font-bold text-2xl text-text-primary mb-6">Analytics</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Views', value: analytics?.total_views },
          { label: 'Views Today', value: analytics?.views_today },
          { label: 'Views This Week', value: analytics?.views_week },
          { label: 'Total Articles', value: analytics?.total_articles },
        ].map(({ label, value }) => (
          <div key={label} className="card p-4">
            <p className="text-xs text-text-muted mb-1">{label}</p>
            <p className="font-headline font-bold text-2xl text-text-primary">{(value ?? 0).toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="card p-5 mb-8">
        <h2 className="font-semibold text-text-primary text-sm mb-4">Daily Views (Last 30 Days)</h2>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#222" />
            <XAxis dataKey="date" tick={{ fill: '#888', fontSize: 10 }} tickLine={false} interval={4} />
            <YAxis tick={{ fill: '#888', fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ background: '#111', border: '1px solid #222', borderRadius: 8 }} />
            <Line type="monotone" dataKey="views" stroke="#6366f1" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h2 className="font-semibold text-sm text-text-primary">All Articles by Views</h2>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr className="border-b border-border text-left">
            <th className="px-5 py-3 text-xs text-text-muted font-medium uppercase">Title</th>
            <th className="px-5 py-3 text-xs text-text-muted font-medium uppercase text-right">Total</th>
            <th className="px-5 py-3 text-xs text-text-muted font-medium uppercase text-right hidden sm:table-cell">Today</th>
            <th className="px-5 py-3 text-xs text-text-muted font-medium uppercase text-right hidden md:table-cell">Week</th>
          </tr></thead>
          <tbody>
            {sorted.map((a: any) => (
              <tr key={a.slug} className="border-b border-border/50 hover:bg-surface-raised">
                <td className="px-5 py-3 text-sm text-text-primary">{a.title ?? a.slug}</td>
                <td className="px-5 py-3 text-sm text-text-muted text-right">{(a.total_views ?? 0).toLocaleString()}</td>
                <td className="px-5 py-3 text-sm text-text-muted text-right hidden sm:table-cell">{(a.views_today ?? 0).toLocaleString()}</td>
                <td className="px-5 py-3 text-sm text-text-muted text-right hidden md:table-cell">{(a.views_week ?? 0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
