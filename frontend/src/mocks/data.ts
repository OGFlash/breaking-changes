export const categories = [
  { slug: 'ai', name: 'AI', description: 'Artificial intelligence, large language models, and the companies building them.', color: '#6366f1', active: true, sort_order: 1 },
  { slug: 'gaming', name: 'Gaming', description: 'Console, PC, and mobile gaming — industry news, reviews, and controversy.', color: '#10b981', active: true, sort_order: 2 },
  { slug: 'dev-tools', name: 'Dev Tools', description: 'IDEs, CLIs, frameworks, and the tools developers use every day.', color: '#f59e0b', active: true, sort_order: 3 },
  { slug: 'security', name: 'Security', description: 'Vulnerabilities, breaches, CVEs, and defensive security research.', color: '#ef4444', active: true, sort_order: 4 },
  { slug: 'business', name: 'Business', description: 'Acquisitions, funding rounds, layoffs, and the money behind the industry.', color: '#0ea5e9', active: true, sort_order: 5 },
]

export const authors = [
  {
    slug: 'alex-king',
    name: 'Alex King',
    bio: 'Senior editor at Breaking Changes. Writes about AI policy, developer tools, and the intersection of tech and culture.',
    avatar_url: 'https://api.dicebear.com/8.x/avataaars/svg?seed=alex',
    twitter: 'alexking_dev',
  },
  {
    slug: 'riley-chen',
    name: 'Riley Chen',
    bio: 'Gaming and immersive tech journalist. Covers the console wars, AAA development, and the indie scene.',
    avatar_url: 'https://api.dicebear.com/8.x/avataaars/svg?seed=riley',
    twitter: 'rileychen_plays',
  },
]

const authorMap: Record<string, (typeof authors)[0]> = Object.fromEntries(authors.map(a => [a.slug, a]))
const catMap: Record<string, (typeof categories)[0]> = Object.fromEntries(categories.map(c => [c.slug, c]))

const raw = [
  {
    slug: 'openai-gpt5-release-what-we-know',
    title: 'OpenAI GPT-5: Everything We Know About the Next Generation Model',
    subtitle: 'Faster reasoning, longer context, cheaper API pricing — and a launch date that might actually stick',
    excerpt: 'OpenAI is preparing to ship GPT-5, its most capable model yet. Here\'s the full rundown of what\'s confirmed, what\'s rumored, and what it means for developers.',
    cover_image_url: 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=1200&q=80',
    _category: 'ai',
    _author: 'alex-king',
    tags: ['openai', 'llm', 'gpt', 'api'],
    status: 'published' as const,
    is_featured: true,
    is_breaking: false,
    is_sponsored: false,
    published_at: '2025-01-15T09:00:00Z',
    read_time_minutes: 6,
    body: `<h2>The Model Everyone Has Been Waiting For</h2><p>After months of leaks, executive interviews, and carefully worded "no comments," OpenAI is finally moving toward a public launch of GPT-5. The company has confirmed the model exists; what remains murky is exactly when it ships and at what price.</p><p>What's emerged from a combination of internal documents shared with enterprise customers, developer beta access, and statements from Sam Altman is a clearer picture than we've had at any other pre-launch stage.</p><h2>What's Actually New</h2><p>GPT-5 is not merely a scaled-up GPT-4. According to individuals with early access, several architectural changes distinguish it fundamentally from its predecessor:</p><ul><li><strong>Extended reasoning traces</strong> — The model can work through multi-step problems with visible chain-of-thought, similar to o1 but integrated natively.</li><li><strong>1M+ token context</strong> — Current previews support context windows far exceeding GPT-4 Turbo's 128k limit.</li><li><strong>Multimodal by default</strong> — Vision, audio, and document understanding baked in without separate endpoints.</li></ul><h2>Pricing: The Developer Question</h2><p>OpenAI has signaled that input token pricing will drop significantly from GPT-4o rates. Competitive pressure from Anthropic, Google, and open-source alternatives has forced the company's hand. Expect something in the range of $2–5 per million input tokens at launch, with aggressive volume discounts for enterprise.</p>`,
  },
  {
    slug: 'gta-6-release-window-rockstar-confirms-fall-2025',
    title: 'GTA 6 Release Window Confirmed: Rockstar Targets Fall 2025',
    subtitle: 'After the most watched trailer in YouTube history, Rockstar pins down a window',
    excerpt: 'Rockstar Games has confirmed Grand Theft Auto VI is targeting a fall 2025 release on PlayStation 5 and Xbox Series X|S, with PC to follow.',
    cover_image_url: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1200&q=80',
    _category: 'gaming',
    _author: 'riley-chen',
    tags: ['gta6', 'rockstar', 'console', 'open-world'],
    status: 'published' as const,
    is_featured: true,
    is_breaking: true,
    is_sponsored: false,
    published_at: '2025-01-10T12:00:00Z',
    read_time_minutes: 5,
    body: `<h2>Rockstar Makes It Official</h2><p>In an update posted to the Rockstar Newswire, the studio confirmed that Grand Theft Auto VI is targeting a fall 2025 launch on PlayStation 5 and Xbox Series X|S. A PC release "will follow," though no timeline was given.</p><p>The announcement does not include a specific date, which is deliberate. Sources familiar with Rockstar's release strategy say the studio learned from the Red Dead Redemption 2 experience: announcing a precise date that then slips creates significant PR damage.</p><h2>What We Know About the Game</h2><p>The first trailer, released in December 2023, became the most watched gaming video in YouTube history within 24 hours. It confirmed the game is set in a fictional Miami-inspired state called Leonida, features a female protagonist named Lucia, and opens with a Bonnie-and-Clyde-style setup.</p>`,
  },
  {
    slug: 'github-copilot-now-writes-entire-pull-requests',
    title: 'GitHub Copilot Can Now Write Entire Pull Requests',
    subtitle: 'Copilot Workspace moves from completing lines to completing features. We tested it.',
    excerpt: 'GitHub\'s Copilot Workspace takes a GitHub Issue and produces a plan, writes code across multiple files, and opens a PR. We ran it against real tasks.',
    cover_image_url: 'https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?w=1200&q=80',
    _category: 'dev-tools',
    _author: 'alex-king',
    tags: ['github', 'copilot', 'ai', 'developer-tools'],
    status: 'published' as const,
    is_featured: false,
    is_breaking: false,
    is_sponsored: false,
    published_at: '2025-01-08T08:00:00Z',
    read_time_minutes: 7,
    body: `<h2>From Autocomplete to Autonomous Agent</h2><p>When GitHub introduced Copilot in 2021, the value proposition was simple: it autocompletes your code. Four years later, the pitch is fundamentally different. Copilot Workspace begins with a GitHub Issue, reasons about what changes are necessary, and produces a fully formed pull request.</p><p>This is not autocomplete. This is closer to delegating a task to a junior engineer and reviewing their output.</p><h2>How It Works in Practice</h2><p>The workflow begins in any GitHub repository. From an open issue, a new button appears: "Open in Copilot Workspace." Clicking it launches a web-based environment where Copilot presents its interpretation, a plan, and the actual code changes file by file.</p>`,
  },
  {
    slug: 'npm-supply-chain-attack-popular-packages-compromised',
    title: 'Critical npm Supply Chain Attack Targets Popular Packages With 50M+ Weekly Downloads',
    subtitle: 'Malicious code injected into dependency tree — update immediately',
    excerpt: 'A coordinated supply chain attack has compromised several high-download npm packages. The malicious payload exfiltrates environment variables including API keys.',
    cover_image_url: 'https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=1200&q=80',
    _category: 'security',
    _author: 'alex-king',
    tags: ['npm', 'supply-chain', 'security', 'cve'],
    status: 'published' as const,
    is_featured: false,
    is_breaking: true,
    is_sponsored: false,
    published_at: '2025-01-05T15:30:00Z',
    read_time_minutes: 4,
    body: `<h2>What Happened</h2><p>Security researchers at Socket.dev identified a coordinated supply chain attack targeting the npm ecosystem. The attack vector begins with account takeovers of package maintainers, followed by new patch-level releases containing obfuscated malicious code that exfiltrates <code>process.env</code> to an attacker-controlled server.</p><h2>How to Check Your Project</h2><pre><code class="language-bash">npx @socket/cli audit\nnpm audit --audit-level=moderate</code></pre><p>The Socket CLI provides the most complete picture.</p>`,
  },
  {
    slug: 'microsoft-activision-one-year-later',
    title: 'Microsoft + Activision, One Year Later: What the $69B Deal Actually Changed',
    subtitle: 'Game Pass grew, Call of Duty stayed on PlayStation, Bobby Kotick is gone. The scorecard.',
    excerpt: 'It was the biggest gaming acquisition in history. Twelve months in, we take stock of what Microsoft got, what it gave up, and whether the deal made strategic sense.',
    cover_image_url: 'https://images.unsplash.com/photo-1486401899868-0e435ed85128?w=1200&q=80',
    _category: 'business',
    _author: 'riley-chen',
    tags: ['microsoft', 'activision', 'gaming', 'acquisitions'],
    status: 'published' as const,
    is_featured: false,
    is_breaking: false,
    is_sponsored: false,
    published_at: '2025-01-03T10:00:00Z',
    read_time_minutes: 8,
    body: `<h2>The Deal That Took Two Years to Close</h2><p>After navigating regulatory challenges in the UK, EU, and US, Microsoft closed its $68.7 billion acquisition of Activision Blizzard King in October 2023. Twelve months on, it's worth asking: what actually changed?</p><h2>Game Pass: Meaningful Growth, But Not a Step Change</h2><p>Call of Duty did arrive on Game Pass, driving what Microsoft called the "biggest day" in Game Pass history. But subscriber numbers remain tightly held, and third-party estimates suggest growth of roughly 20–30% over the year — meaningful, not transformational.</p>`,
  },
]

function enrich(a: typeof raw[0]) {
  const { _category, _author, ...rest } = a
  return {
    ...rest,
    category: catMap[_category] ?? { slug: _category, name: _category, color: '#888' },
    author: authorMap[_author] ?? { slug: _author, name: _author },
    body_html: (rest as any).body ?? '',
  }
}

export const articles = raw.map(enrich)

export const settings = {
  site_name: 'Breaking Changes',
  tagline: 'Tech & gaming news that moves fast',
  newsletter_cta: 'Get the weekly digest — no spam, unsubscribe anytime.',
  social_twitter: '@breakingchanges',
  social_github: null,
  social_linkedin: null,
  social_youtube: null,
  beehiiv_embed_url: '',
  ad_slots: [
    { id: 'homepage_leaderboard', label: 'Homepage Leaderboard', active: false, code: '' },
    { id: 'article_inline_1', label: 'Article Inline 1', active: false, code: '' },
    { id: 'article_inline_2', label: 'Article Inline 2', active: false, code: '' },
    { id: 'article_sidebar', label: 'Article Sidebar', active: false, code: '' },
    { id: 'category_banner', label: 'Category Banner', active: false, code: '' },
  ],
}

export const ads = {
  leaderboard_top: { is_active: false, code: '' },
  sidebar_article: { is_active: false, code: '' },
  inline_article: { is_active: false, code: '' },
}
