import { Helmet } from 'react-helmet-async'

export default function AdvertisePage() {
  return (
    <>
      <Helmet>
        <title>Advertise — Breaking Changes</title>
        <link rel="canonical" href="https://breakchange.com/advertise" />
      </Helmet>
      <div className="max-w-article mx-auto px-4 py-12">
        <h1 className="font-headline font-bold text-4xl mb-4">Advertise with Us</h1>
        <p className="text-text-muted text-xl mb-10">Reach a highly-engaged audience of developers, gamers, and tech enthusiasts.</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          {[
            { stat: '50K+', label: 'Monthly Readers' },
            { stat: '65%', label: 'Developers & Engineers' },
            { stat: '4.2min', label: 'Average Session Time' },
          ].map(({ stat, label }) => (
            <div key={label} className="card p-6 text-center">
              <p className="font-headline font-bold text-3xl text-accent-blue mb-1">{stat}</p>
              <p className="text-sm text-text-muted">{label}</p>
            </div>
          ))}
        </div>

        <h2 className="font-headline font-bold text-2xl mb-4">Ad Placements</h2>
        <div className="space-y-4 mb-10">
          {[
            { name: 'Homepage Leaderboard', size: '728×90', placement: 'Below hero, above feed', cpm: '$3–6' },
            { name: 'Article Inline', size: '300×250', placement: 'Within article body (2 placements)', cpm: '$4–8' },
            { name: 'Article Sidebar', size: '300×600', placement: 'Sticky desktop sidebar', cpm: '$5–10' },
            { name: 'Category Banner', size: '728×90', placement: 'Top of category pages', cpm: '$3–5' },
            { name: 'Newsletter Sponsor', size: 'Email', placement: 'Dedicated sponsor slot in weekly digest', cpm: '$50–150/send' },
          ].map(slot => (
            <div key={slot.name} className="card p-4 flex flex-wrap gap-4 items-center">
              <div className="flex-1">
                <p className="font-medium text-text-primary">{slot.name}</p>
                <p className="text-sm text-text-muted">{slot.placement}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-mono bg-surface-raised px-2 py-0.5 rounded text-text-muted">{slot.size}</p>
                <p className="text-xs text-text-muted mt-1">Est. {slot.cpm} CPM</p>
              </div>
            </div>
          ))}
        </div>

        <div className="card p-6 bg-surface-raised">
          <h3 className="font-headline font-bold text-xl mb-2">Get in touch</h3>
          <p className="text-text-muted mb-4">For media kit, rates, and availability, email us at:</p>
          <a href="mailto:contact@wearesbt.com" className="text-accent-blue hover:underline font-medium">contact@wearesbt.com</a>
        </div>
      </div>
    </>
  )
}
