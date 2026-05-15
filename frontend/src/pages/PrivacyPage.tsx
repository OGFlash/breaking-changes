import { Helmet } from 'react-helmet-async'

export default function PrivacyPage() {
  return (
    <>
      <Helmet>
        <title>Privacy Policy — Breaking Changes</title>
        <link rel="canonical" href="https://breakingchanges.dev/privacy" />
      </Helmet>
      <div className="max-w-article mx-auto px-4 py-12">
        <h1 className="font-headline font-bold text-4xl mb-2">Privacy Policy</h1>
        <p className="text-text-muted mb-8">Last updated: May 15, 2026</p>
        <div className="article-body space-y-6">
          <p>Breaking Changes ("we", "us", or "our") is committed to protecting your privacy. This policy explains what data we collect and how we use it.</p>
          <h2>What We Collect</h2>
          <ul>
            <li><strong>Analytics:</strong> We use Google Analytics (GA4) to understand aggregate traffic patterns. No personally identifiable information is sent to Google.</li>
            <li><strong>Newsletter:</strong> If you subscribe, your email is stored by Beehiiv. Their privacy policy applies.</li>
            <li><strong>Contact form:</strong> Name, email, and message are processed via AWS SES and stored only as long as needed to respond.</li>
            <li><strong>View counts:</strong> We count article views by slug using AWS DynamoDB. No user identifiers are stored.</li>
          </ul>
          <h2>Cookies</h2>
          <p>We use minimal localStorage to remember your theme preference and newsletter dismissal. No third-party tracking cookies are used beyond those introduced by ad providers listed on our /advertise page.</p>
          <h2>Advertising</h2>
          <p>We may show ads from Carbon Ads, EthicalAds, or Google AdSense. These providers may use cookies according to their own privacy policies.</p>
          <h2>Your Rights</h2>
          <p>If you're in the EU/EEA, you have the right to access, correct, and delete your personal data. Contact us at privacy@breakingchanges.dev.</p>
          <h2>Contact</h2>
          <p>Questions? Email privacy@breakingchanges.dev.</p>
        </div>
      </div>
    </>
  )
}
