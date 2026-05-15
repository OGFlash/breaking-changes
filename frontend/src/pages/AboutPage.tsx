import { Helmet } from 'react-helmet-async'
import { Zap, Target, TrendingUp, Users } from 'lucide-react'

export default function AboutPage() {
  return (
    <>
      <Helmet>
        <title>About — Breaking Changes</title>
        <link rel="canonical" href="https://breakingchanges.dev/about" />
        <meta name="description" content="Learn about Breaking Changes — your source for tech, AI, and gaming news." />
      </Helmet>
      <div className="max-w-article mx-auto px-4 py-12">
        <div className="flex items-center gap-3 mb-8">
          <Zap className="w-8 h-8 text-accent-red" />
          <h1 className="font-headline font-bold text-4xl">About Breaking Changes</h1>
        </div>

        <div className="article-body space-y-6">
          <p className="text-xl text-text-muted">
            Breaking Changes is an independent tech and gaming news platform dedicated to delivering
            fast, honest, and well-researched coverage without the noise.
          </p>

          <h2>Our Mission</h2>
          <p>
            We started Breaking Changes because we were tired of tech news that was either too shallow,
            too slow, or buried under ads and clickbait. We cover what matters: artificial intelligence,
            video games, developer tools, cybersecurity, and the business of tech — with the depth
            and speed the industry deserves.
          </p>

          <h2>What We Cover</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 not-prose">
            {[
              { icon: '🤖', title: 'Artificial Intelligence', desc: 'Models, research, products, and the companies shaping the AI landscape.' },
              { icon: '🎮', title: 'Video Games', desc: 'Game releases, industry news, reviews, and gaming culture.' },
              { icon: '🛠️', title: 'Developer Tools', desc: 'IDEs, frameworks, platforms, and everything that ships working software.' },
              { icon: '🔐', title: 'Security', desc: 'Vulnerabilities, breaches, and the evolving threat landscape.' },
              { icon: '💼', title: 'Tech Business', desc: 'Acquisitions, funding, layoffs, and the deals that reshape the industry.' },
              { icon: '📱', title: 'Consumer Tech', desc: 'Devices, apps, and the technology billions of people use every day.' },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="card p-4">
                <p className="text-2xl mb-2">{icon}</p>
                <h3 className="font-headline font-bold text-text-primary mb-1">{title}</h3>
                <p className="text-sm text-text-muted">{desc}</p>
              </div>
            ))}
          </div>

          <h2>Our Principles</h2>
          <ul>
            <li><strong>Speed without sacrifice</strong> — we break news fast and fill it in as facts emerge.</li>
            <li><strong>No sensationalism</strong> — headlines that reflect reality, not clickbait.</li>
            <li><strong>Transparency on sponsorships</strong> — sponsored content is always clearly labeled.</li>
            <li><strong>Privacy-first</strong> — no invasive tracking, minimal cookies.</li>
          </ul>
        </div>
      </div>
    </>
  )
}
