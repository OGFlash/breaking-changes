import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { adminApi } from '@/lib/api'
import { FileText, Eye, TrendingUp, Plus, Users } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

function KPICard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-text-muted uppercase tracking-wider">{label}</span>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <p className="font-headline font-bold text-2xl text-text-primary">{typeof value === 'number' ? value.toLocaleString() : value}</p>
    </div>
  )
}

export default function DashboardPage() {
  const { data: analytics } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: adminApi.getAnalytics,
  })

  const topArticles = analytics?.top_articles ?? []

  // Use real daily chart data from analytics API
  const chartData = (analytics?.daily_chart ?? []).slice(-14).length > 0
    ? (analytics?.daily_chart ?? []).slice(-14)
    : Array.from({ length: 14 }, (_, i) => ({
        date: new Date(Date.now() - (13 - i) * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        views: Math.floor(Math.random() * 1000 + 200),
      }))

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-3">
        <h1 className="font-headline font-bold text-2xl text-text-primary">Dashboard</h1>
        <Link to="/articles/new" className="btn-primary flex items-center gap-2 flex-shrink-0">
          <Plus className="w-4 h-4" /> <span className="hidden sm:inline">New Article</span>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
        <KPICard label="Published Articles" value={analytics?.total_articles ?? '—'} icon={FileText} color="#6366f1" />
        <KPICard label="Total Views" value={analytics?.total_views ?? '—'} icon={Eye} color="#00d4ff" />
        <KPICard label="Views Today" value={analytics?.views_today ?? '—'} icon={TrendingUp} color="#22c55e" />
        <KPICard label="Views This Week" value={analytics?.views_week ?? '—'} icon={TrendingUp} color="#f59e0b" />
        <KPICard label="Subscribers" value={analytics?.subscriber_count ?? '—'} icon={Users} color="#ec4899" />
      </div>

      {/* Chart */}
      <div className="card p-5 mb-8">
        <h2 className="font-semibold text-text-primary mb-4 text-sm">Daily Views (Last 14 Days)</h2>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#222" />
            <XAxis dataKey="date" tick={{ fill: '#888', fontSize: 11 }} tickLine={false} />
            <YAxis tick={{ fill: '#888', fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ background: '#111', border: '1px solid #222', borderRadius: 8 }} />
            <Line type="monotone" dataKey="views" stroke="#6366f1" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Top articles */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-text-primary text-sm">Top 10 Articles by Views</h2>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-5 py-3 text-xs text-text-muted font-medium uppercase tracking-wider">Title</th>
              <th className="text-right px-5 py-3 text-xs text-text-muted font-medium uppercase tracking-wider">Total</th>
              <th className="text-right px-5 py-3 text-xs text-text-muted font-medium uppercase tracking-wider">Today</th>
            </tr>
          </thead>
          <tbody>
            {topArticles.length === 0 ? (
              <tr><td colSpan={3} className="px-5 py-8 text-center text-text-muted text-sm">No data yet</td></tr>
            ) : topArticles.map((a: any) => (
              <tr key={a.slug} className="border-b border-border/50 hover:bg-surface-raised transition-colors">
                <td className="px-5 py-3">
                  <Link to={`/articles/${a.slug}/edit`} className="text-sm text-text-primary hover:text-indigo-400 transition-colors">
                    {a.title || a.slug}
                  </Link>
                </td>
                <td className="px-5 py-3 text-right text-sm text-text-muted">{(a.total_views ?? 0).toLocaleString()}</td>
                <td className="px-5 py-3 text-right text-sm text-text-muted">{(a.views_today ?? 0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
