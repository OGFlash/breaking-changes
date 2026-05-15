import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import { AdminLayout } from '@/components/AdminLayout'

const LoginPage = lazy(() => import('@/pages/LoginPage'))
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const ArticlesPage = lazy(() => import('@/pages/ArticlesPage'))
const ArticleEditorPage = lazy(() => import('@/pages/ArticleEditorPage'))
const MediaPage = lazy(() => import('@/pages/MediaPage'))
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage'))
const CategoriesPage = lazy(() => import('@/pages/CategoriesPage'))
const AuthorsPage = lazy(() => import('@/pages/AuthorsPage'))
const TagsPage = lazy(() => import('@/pages/TagsPage'))
const AdsPage = lazy(() => import('@/pages/AdsPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated()) return <Navigate to="/login" replace />
  return <>{children}</>
}

const Loading = () => (
  <div className="flex items-center justify-center h-64">
    <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
  </div>
)

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<RequireAuth><AdminLayout /></RequireAuth>}>
          <Route index element={<DashboardPage />} />
          <Route path="articles" element={<ArticlesPage />} />
          <Route path="articles/new" element={<ArticleEditorPage />} />
          <Route path="articles/:slug/edit" element={<ArticleEditorPage />} />
          <Route path="media" element={<MediaPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="authors" element={<AuthorsPage />} />
          <Route path="tags" element={<TagsPage />} />
          <Route path="ads" element={<AdsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
