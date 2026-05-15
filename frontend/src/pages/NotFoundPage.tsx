import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { Zap } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <>
      <Helmet><title>404 — Breaking Changes</title></Helmet>
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
        <Zap className="w-12 h-12 text-accent-red mb-4" />
        <p className="font-mono text-text-muted text-sm mb-2">// 404: Page not found</p>
        <h1 className="font-headline font-bold text-4xl md:text-5xl text-text-primary mb-4">
          This is a Breaking Change.
        </h1>
        <p className="text-text-muted max-w-md mb-8">
          The page you're looking for doesn't exist or has been moved. Let's get you back on track.
        </p>
        <Link to="/" className="btn-primary">Back to home</Link>
      </div>
    </>
  )
}
