type StaticPageKind = 'privacy' | 'terms' | 'beta-access';

type StaticPageSection = {
  heading: string;
  body: string;
  bullets?: string[];
};

type StaticPageContent = {
  eyebrow: string;
  title: string;
  intro: string;
  updated: string;
  sections: StaticPageSection[];
};

const UPDATED_DATE = 'June 12, 2026';

const PAGES: Record<StaticPageKind, StaticPageContent> = {
  privacy: {
    eyebrow: 'Privacy',
    title: 'Privacy Policy',
    intro:
      'Parite is a free trip expense splitting app for small private groups. This page explains the basic privacy posture for the beta deployment.',
    updated: UPDATED_DATE,
    sections: [
      {
        heading: 'Data Parite needs',
        body:
          'Parite uses account and trip data needed to run shared expense workspaces. This may include your email address, display name, trip names, invite status, expenses, splits, settlements, currencies, notes you enter, and basic timestamps.',
      },
      {
        heading: 'Storage and access',
        body:
          'The app is designed to use Supabase for authentication and database storage. Access should be controlled with Supabase Auth, row-level security, and server-side RPC permissions. Production secrets must not be exposed in frontend code.',
        bullets: [
          'Use only the Supabase anon key in browser-side Vite variables.',
          'Never expose SUPABASE_SERVICE_ROLE_KEY in the frontend.',
          'Do not commit .env files or screenshots containing secrets.',
        ],
      },
      {
        heading: 'No payment processing',
        body:
          'Parite tracks shared expenses and settlement status, but it does not process card payments, bank transfers, or paid subscriptions in this deployment setup.',
      },
      {
        heading: 'Beta limitation',
        body:
          'During the 20-user beta, keep access invite-only and avoid storing sensitive information that is not needed for shared expense tracking.',
      },
      {
        heading: 'Data removal',
        body:
          'For a private beta, the project owner should handle removal requests manually from Supabase after verifying the requesting account and affected trip membership.',
      },
    ],
  },
  terms: {
    eyebrow: 'Terms',
    title: 'Terms of Use',
    intro:
      'Parite is provided as a free beta tool to help small groups track shared expenses and understand balances.',
    updated: UPDATED_DATE,
    sections: [
      {
        heading: 'Free beta access',
        body:
          'Parite is free to use for the beta. Do not add paid plans, payment flows, billing integrations, or subscription language unless the project owner explicitly changes the product direction.',
      },
      {
        heading: 'User responsibility',
        body:
          'Users are responsible for entering accurate expenses, confirming settlements truthfully, and resolving payment disputes inside their group. Parite is an organizer, not a bank or payment processor.',
      },
      {
        heading: 'No financial advice',
        body:
          'Parite provides expense calculations and balance summaries. It does not provide legal, tax, accounting, or financial advice.',
      },
      {
        heading: 'Acceptable use',
        body:
          'Use Parite only for lawful shared expense tracking. Do not upload secrets, payment card numbers, identity documents, abusive content, or data you do not have permission to share.',
      },
      {
        heading: 'Availability',
        body:
          'The beta may change, break, or become unavailable. Keep your own records for important expenses and settlements.',
      },
    ],
  },
  'beta-access': {
    eyebrow: 'Beta',
    title: 'Beta Access',
    intro:
      'Parite is being prepared for a small free deployment. The recommended launch model is invite-only access for up to 20 users.',
    updated: UPDATED_DATE,
    sections: [
      {
        heading: 'Who should use the beta',
        body:
          'The beta is intended for a small group of trusted testers who need trip or group expense tracking and can report issues clearly.',
      },
      {
        heading: 'Safe launch model',
        body:
          'Keep signup controlled through Supabase Auth settings, invite codes, and admin approval. Production should deploy only from the main branch after pull request review.',
        bullets: [
          'GitHub stores the source repository.',
          'Cloudflare Pages hosts the frontend.',
          'Cloudflare preview deployments are used for pull request review.',
          'Supabase stores auth and trip data.',
        ],
      },
      {
        heading: 'Free-tier discipline',
        body:
          'Avoid background polling, excessive API refreshes, oversized assets, and unnecessary server work. A 20-user beta should remain within free-tier limits when usage is modest.',
      },
      {
        heading: 'Before inviting users',
        body:
          'Verify signup, login, trip creation, invite-code join, admin approval, expense creation, settlement confirmation, CSV export, mobile layout, and error handling on the Cloudflare preview URL.',
      },
    ],
  },
};

export function getStaticPageKind(pathname: string): StaticPageKind | null {
  const normalizedPath = pathname.replace(/\/$/, '') || '/';

  if (normalizedPath === '/privacy') return 'privacy';
  if (normalizedPath === '/terms') return 'terms';
  if (normalizedPath === '/beta-access') return 'beta-access';

  return null;
}

export function StaticPage({ kind }: { kind: StaticPageKind }) {
  const page = PAGES[kind];

  return (
    <main className="min-h-screen bg-[#121418] text-slate-100 font-sans px-5 py-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-5 rounded-3xl border border-slate-800 bg-[#1a1d23] p-6 shadow-2xl">
          <a href="/" className="text-sm font-extrabold tracking-tight text-indigo-300">
            Parite
          </a>
          <div className="flex flex-col gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">{page.eyebrow}</p>
            <h1 className="text-3xl font-extrabold tracking-tight text-white md:text-5xl">{page.title}</h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-400">{page.intro}</p>
            <p className="text-[11px] font-semibold text-slate-500">Last updated: {page.updated}</p>
          </div>
        </header>

        <section className="flex flex-col gap-4">
          {page.sections.map(section => (
            <article key={section.heading} className="rounded-3xl border border-slate-800 bg-[#1a1d23] p-5">
              <h2 className="text-base font-bold text-white">{section.heading}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">{section.body}</p>
              {section.bullets && (
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-400">
                  {section.bullets.map(bullet => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </section>

        <footer className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <a href="/" className="font-bold text-indigo-300 hover:text-indigo-200">App</a>
          <a href="/privacy" className="hover:text-slate-300">Privacy</a>
          <a href="/terms" className="hover:text-slate-300">Terms</a>
          <a href="/beta-access" className="hover:text-slate-300">Beta Access</a>
        </footer>
      </div>
    </main>
  );
}
