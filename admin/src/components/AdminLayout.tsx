import { useState } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import {
  LayoutDashboard, FileText, Image, BarChart2, Tag, Users, Settings,
  Megaphone, Zap, LogOut, ExternalLink, FolderOpen, Menu, X, Wand2
} from 'lucide-react'
import { cn } from '@/lib/utils'

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/articles', icon: FileText, label: 'Articles' },
  { to: '/media', icon: Image, label: 'Media' },
  { to: '/analytics', icon: BarChart2, label: 'Analytics' },
  { to: '/categories', icon: FolderOpen, label: 'Categories' },
  { to: '/authors', icon: Users, label: 'Authors' },
  { to: '/tags', icon: Tag, label: 'Tags' },
  { to: '/ads', icon: Megaphone, label: 'Ad Manager' },
  { to: '/ai-writer', icon: Wand2, label: 'AI Writer' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

function SidebarContent({ pathname, onNav, onLogout }: { pathname: string; onNav?: () => void; onLogout: () => void }) {
  return (
    <>
      <div className="px-4 py-4 border-b border-border flex items-center gap-2 flex-shrink-0">
        <Zap className="w-5 h-5 text-accent-red" />
        <span className="font-headline font-bold text-sm">
          BC <span className="text-text-muted font-normal">Admin</span>
        </span>
      </div>

      <nav className="flex-1 p-2 overflow-y-auto">
        {nav.map(({ to, icon: Icon, label }) => {
          const active = to === '/' ? pathname === '/' : pathname.startsWith(to)
          return (
            <Link
              key={to}
              to={to}
              onClick={onNav}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors',
                active ? 'bg-indigo-600/20 text-indigo-400 font-medium' : 'text-text-muted hover:text-text-primary hover:bg-surface-raised'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="p-2 border-t border-border space-y-0.5 flex-shrink-0">
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-text-muted hover:text-text-primary hover:bg-surface-raised transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          View Site
        </a>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-text-muted hover:text-accent-red hover:bg-surface-raised transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </>
  )
}

export function AdminLayout() {
  const { pathname } = useLocation()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 flex-shrink-0 bg-surface border-r border-border flex-col">
        <SidebarContent pathname={pathname} onLogout={handleLogout} />
      </aside>

      {/* Mobile sidebar drawer */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          {/* Drawer */}
          <aside className="relative w-64 bg-surface border-r border-border flex flex-col h-full z-10">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-3 right-3 p-1.5 text-text-muted hover:text-text-primary rounded"
            >
              <X className="w-4 h-4" />
            </button>
            <SidebarContent pathname={pathname} onNav={() => setSidebarOpen(false)} onLogout={handleLogout} />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-surface flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 text-text-muted hover:text-text-primary rounded"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-accent-red" />
            <span className="font-headline font-bold text-sm">BC Admin</span>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
