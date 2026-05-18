import { Helmet } from 'react-helmet-async'

export default function TermsPage() {
  return (
    <>
      <Helmet>
        <title>Terms of Use — Breaking Changes</title>
        <link rel="canonical" href="https://breakchange.com/terms" />
      </Helmet>
      <div className="max-w-article mx-auto px-4 py-12">
        <h1 className="font-headline font-bold text-4xl mb-2">Terms of Use</h1>
        <p className="text-text-muted mb-8">Last updated: May 15, 2026</p>
        <div className="article-body space-y-6">
          <p>By accessing Breaking Changes ("the Site"), you agree to these terms.</p>
          <h2>Use of Content</h2>
          <p>All content published on the Site is owned by Breaking Changes or its contributors. You may share excerpts with attribution and a link back to the original article. Republishing full articles without permission is prohibited.</p>
          <h2>User Conduct</h2>
          <p>You agree not to use the Site to: scrape content at scale, submit false information via the contact form, or attempt to interfere with the Site's infrastructure.</p>
          <h2>Affiliate Links</h2>
          <p>Some articles may contain affiliate links. We receive a commission if you make a purchase through these links at no additional cost to you. Affiliate relationships are disclosed in the relevant articles.</p>
          <h2>Sponsored Content</h2>
          <p>Sponsored articles are clearly labeled as "Sponsored." The opinions expressed in sponsored content are those of the sponsor, not Breaking Changes editorial.</p>
          <h2>Disclaimer</h2>
          <p>Content is provided for informational purposes only. Breaking Changes makes no warranties about the accuracy of information and accepts no liability for decisions made based on Site content.</p>
          <h2>Changes</h2>
          <p>We may update these terms. Continued use of the Site constitutes acceptance of the updated terms.</p>
          <h2>Contact</h2>
          <p>Questions? Email contact@wearesbt.com.</p>
        </div>
      </div>
    </>
  )
}
