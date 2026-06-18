import React from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  FileDown,
  Receipt,
  Scale,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';

interface LandingPageProps {
  authCard: React.ReactNode;
  onGetStartedClick: () => void;
}

const features = [
  {
    title: 'Private trip groups',
    body: 'Create invite-code trips, review member requests, and keep shared expenses scoped to your group.',
    icon: Users,
  },
  {
    title: 'Fair expense splits',
    body: 'Track service fees, smart splits, settlements, and balances without a spreadsheet.',
    icon: Scale,
  },
  {
    title: 'Manual currency control',
    body: 'Use manual exchange rates and display currency settings while trip accounting stays consistent.',
    icon: Receipt,
  },
] as const;

const steps = [
  {
    title: 'Create or join a trip',
    body: 'Start a private trip space or enter an invite code and wait for admin approval.',
    icon: UserPlus,
  },
  {
    title: 'Add shared expenses',
    body: 'Record who paid, service fees, currencies, and how each expense should be split.',
    icon: Compass,
  },
  {
    title: 'Settle clear balances',
    body: 'Review balances, settlement suggestions, and CSV exports when the group needs a record.',
    icon: FileDown,
  },
] as const;

const faqs = [
  {
    question: 'Does Parité connect to banks?',
    answer: 'No. Parité does not require bank connections or payment processing.',
  },
  {
    question: 'How are currencies handled?',
    answer: 'Trips use a base currency, admins can set manual exchange rates, and members can choose a display currency.',
  },
  {
    question: 'Can a trip stay private?',
    answer: 'Yes. Trips use invite codes, and admins approve member access before people join the group.',
  },
  {
    question: 'Can we export the final records?',
    answer: 'Yes. Parité supports CSV export for expenses, balances, and settlements.',
  },
] as const;

export const LandingPage: React.FC<LandingPageProps> = ({
  authCard,
  onGetStartedClick,
}) => (
  <div className="parite-shell min-h-screen overflow-x-hidden bg-[var(--color-app-background)] text-[var(--color-text)] font-sans">
    <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-app-background)]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-6 lg:px-8">
        <a href="#top" className="flex items-center gap-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-600 text-white accent-glow">
            <Compass className="h-5 w-5 stroke-[2.5]" aria-hidden="true" />
          </span>
          <span className="font-display text-lg font-extrabold tracking-tight text-[var(--color-text)]">
            Parité
          </span>
        </a>

        <nav aria-label="Landing page navigation" className="hidden items-center gap-5 text-xs font-bold text-[var(--color-muted)] sm:flex">
          <a className="hover:text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 rounded-lg" href="#features">
            Features
          </a>
          <a className="hover:text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 rounded-lg" href="#how-it-works">
            How it works
          </a>
          <a className="hover:text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 rounded-lg" href="#faq">
            FAQ
          </a>
        </nav>

        <button
          type="button"
          onClick={onGetStartedClick}
          aria-controls="auth-card"
          className="min-h-11 rounded-2xl bg-indigo-600 px-4 text-xs font-bold text-slate-950 shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
        >
          Get started free
        </button>
      </div>
    </header>

    <main id="top">
      <section className="mx-auto grid max-w-6xl gap-8 px-5 pb-14 pt-10 sm:px-6 sm:pb-16 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] lg:items-center lg:px-8 lg:pb-20 lg:pt-16">
        <div className="max-w-3xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white/70 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#4f7f68]">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Private group expenses
          </p>
          <h1 className="mt-5 max-w-3xl font-display text-4xl font-extrabold leading-[1.04] tracking-tight text-[var(--color-text)] sm:text-5xl lg:text-6xl">
            Split expenses fairly. Understand balances instantly.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--color-muted)] sm:text-lg">
            Parité helps private groups track shared trip expenses, service fees, settlements, and balances across multiple currencies — without spreadsheets or payment integrations.
          </p>
          <p className="mt-4 flex max-w-2xl items-start gap-2 text-sm font-semibold leading-6 text-[var(--color-text)]">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#4f7f68]" aria-hidden="true" />
            <span>Free for your group to use. No bank connection, no payment processing, no subscription flow.</span>
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onGetStartedClick}
              aria-controls="auth-card"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 text-sm font-bold text-slate-950 shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            >
              Get started free
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <a
              href="#how-it-works"
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-white px-5 text-sm font-bold text-[var(--color-text)] transition-colors hover:border-indigo-500/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            >
              See how it works
            </a>
          </div>
          <p className="mt-6 max-w-2xl text-xs font-semibold leading-6 text-[var(--color-muted)]">
            Supports invite-code trips, admin approval, manual exchange rates, display currency, service fees, smart splits, settlements, and CSV export.
          </p>
        </div>

        <div className="w-full max-w-md justify-self-center lg:justify-self-end">
          {authCard}
        </div>
      </section>

      <section id="features" className="scroll-mt-24 border-y border-[var(--color-border)] bg-white/45">
        <div className="mx-auto max-w-6xl px-5 py-12 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="font-display text-2xl font-bold tracking-tight text-[var(--color-text)]">
              Features
            </h2>
          </div>
          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {features.map(feature => {
              const Icon = feature.icon;

              return (
                <article key={feature.title} className="rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600/15 text-[#4f7f68]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 text-sm font-bold text-[var(--color-text)]">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
                    {feature.body}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-24">
        <div className="mx-auto max-w-6xl px-5 py-12 sm:px-6 lg:px-8">
          <h2 className="font-display text-2xl font-bold tracking-tight text-[var(--color-text)]">
            How it works
          </h2>
          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => {
              const Icon = step.icon;

              return (
                <article key={step.title} className="rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-xs font-bold text-[#4f7f68]">
                      0{index + 1}
                    </span>
                    <Icon className="h-5 w-5 text-[var(--color-muted)]" aria-hidden="true" />
                  </div>
                  <h3 className="mt-5 text-sm font-bold text-[var(--color-text)]">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
                    {step.body}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="faq" className="scroll-mt-24 border-t border-[var(--color-border)] bg-white/45">
        <div className="mx-auto max-w-4xl px-5 py-12 sm:px-6 lg:px-8">
          <h2 className="font-display text-2xl font-bold tracking-tight text-[var(--color-text)]">
            FAQ
          </h2>
          <div className="mt-7 grid gap-3">
            {faqs.map(item => (
              <article key={item.question} className="rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
                <h3 className="text-sm font-bold text-[var(--color-text)]">
                  {item.question}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
                  {item.answer}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>

    <footer className="border-t border-[var(--color-border)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-xs text-[var(--color-muted)] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <span className="font-bold text-[var(--color-text)]">Parité</span>
        <span>Private trip expenses, balances, settlements, and exports.</span>
      </div>
    </footer>
  </div>
);
