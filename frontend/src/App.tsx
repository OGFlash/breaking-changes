import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'
import { BreakingTicker } from '@/components/BreakingTicker'
import { LiveEventBanner } from '@/components/LiveEventBanner'

const HomePage = lazy(() => import('@/pages/HomePage'))
const ArticlePage = lazy(() => import('@/pages/ArticlePage'))
const CategoryPage = lazy(() => import('@/pages/CategoryPage'))
const TagPage = lazy(() => import('@/pages/TagPage'))
const AuthorPage = lazy(() => import('@/pages/AuthorPage'))
const SearchPage = lazy(() => import('@/pages/SearchPage'))
const AboutPage = lazy(() => import('@/pages/AboutPage'))
const ContactPage = lazy(() => import('@/pages/ContactPage'))
const AdvertisePage = lazy(() => import('@/pages/AdvertisePage'))
const NewsletterPage = lazy(() => import('@/pages/NewsletterPage'))
const PrivacyPage = lazy(() => import('@/pages/PrivacyPage'))
const TermsPage = lazy(() => import('@/pages/TermsPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))
const LivePage = lazy(() => import('@/pages/LivePage'))

function PageSkeleton() {
  return (
    <div className="min-h-screen bg-bg animate-pulse">
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="h-8 bg-surface rounded w-1/3 mb-4" />
        <div className="h-4 bg-surface rounded w-2/3 mb-2" />
        <div className="h-4 bg-surface rounded w-1/2" />
      </div>
    </div>
  )
}

export default function App() {
  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col">
      <BreakingTicker />
      <LiveEventBanner />
      <Navbar />
      <main className="flex-1">
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/article/:slug" element={<ArticlePage />} />
            <Route path="/category/:slug" element={<CategoryPage />} />
            <Route path="/tag/:slug" element={<TagPage />} />
            <Route path="/author/:slug" element={<AuthorPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/advertise" element={<AdvertisePage />} />
            <Route path="/newsletter" element={<NewsletterPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/live" element={<LivePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
