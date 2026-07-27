import React from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Compass,
  FileDown,
  Globe2,
  Receipt,
  Scale,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react';
import { LaunchPromoVisual, ProductShowcase } from './LaunchPromoVisual';

interface LandingPageProps {
  authCard: React.ReactNode;
  onGetStartedClick: () => void;
}

const features = [
  {
    title: 'Private by invitation',
    body: 'Share an invite link, QR, or manual code, review join requests, and keep every trip inside the circle you approve.',
    icon: ShieldCheck,
  },
  {
    title: 'Fair beyond equal',
    body: 'Handle equal or custom splits, optional service fees, and the small details that spreadsheets make painful.',
    icon: Scale,
  },
  {
    title: 'Multi-currency, on your terms',
    body: 'Set manual exchange rates and let each member view amounts in their preferred supported currency.',
    icon: Globe2,
  },
  {
    title: 'A clean record at the end',
    body: 'Track paid settlements and export expenses, balances, or settlement history whenever the group needs it.',
    icon: FileDown,
  },
] as const;

const steps = [
  {
    title: 'Create or join a group',
    body: 'Open a private shared space, or join with an invite link, QR, or manual code and admin approval.',
    icon: UserPlus,
  },
  {
    title: 'Add what happened',
    body: 'Record who paid, the currency, optional service fee, and exactly how the expense should be split.',
    icon: Receipt,
  },
  {
    title: 'See the answer',
    body: 'Review balances, settle in fewer transfers, and export the record when the trip is done.',
    icon: CheckCircle2,
  },
] as const;

const faqs = [
  {
    question: 'Does Parité connect to banks or move money?',
    answer: 'No. Parité does not require a bank connection and does not process payments. It helps your group keep the math and the record clear.',
  },
  {
    question: 'How are currencies handled?',
    answer: 'Each group has a base currency. Admins can set manual exchange rates, and members can choose a supported display currency.',
  },
  {
    question: 'Can a group stay private?',
    answer: 'Yes. Invite links, QR codes, and manual codes only start a request; an admin still approves access before someone joins the group.',
  },
  {
    question: 'What can we export?',
    answer: 'You can export expenses, balances, and settlements as CSV files for your own records.',
  },
] as const;

export const LandingPage: React.FC<LandingPageProps> = ({
  authCard,
  onGetStartedClick,
}) => (
  <div className="parite-shell min-h-screen overflow-x-hidden bg-[var(--color-app-background)] text-[var(--color-text)] font-sans">
    <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-app-background)]/88 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3 sm:px-6 lg:px-8">
        <a href="#top" className="flex items-center gap-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-[#10271f] accent-glow">
            <Compass className="h-5 w-5 stroke-[2.6]" aria-hidden="true" />
          </span>
          <span className="font-display text-xl font-bold tracking-tight text-[var(--color-text)]">
            Parité
          </span>
        </a>

        <nav aria-label="Landing page navigation" className="hidden items-center gap-6 text-xs font-bold text-[var(--color-muted)] md:flex">
          <a className="rounded-lg hover:text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30" href="#product">
            Product
          </a>
          <a className="rounded-lg hover:text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30" href="#why-parite">
            Why Parité
          </a>
          <a className="rounded-lg hover:text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30" href="#how-it-works">
            How it works
          </a>
          <a className="rounded-lg hover:text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30" href="#faq">
            FAQ
          </a>
        </nav>

        <button
          type="button"
          onClick={onGetStartedClick}
          aria-controls="auth-card"
          className="min-h-11 rounded-full bg-[#173128] px-4 text-xs font-bold text-[#f6fbf8] shadow-sm transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 sm:px-5"
        >
          Get started free
        </button>
      </div>
    </header>

    <main id="top">
      <section className="relative mx-auto max-w-7xl px-5 pb-12 pt-9 sm:px-6 sm:pb-16 sm:pt-14 lg:px-8 lg:pb-24 lg:pt-16">
        <div className="absolute left-[-11rem] top-[-7rem] h-80 w-80 rounded-full bg-[var(--color-positive-soft)] blur-3xl" aria-hidden="true" />
        <div className="relative grid items-center gap-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(29rem,1.08fr)] lg:gap-14">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-[var(--color-positive)]/20 bg-[var(--color-positive-soft)] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.13em] text-[var(--color-positive)]">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Parité is live
            </p>

            <h1 className="mt-6 max-w-3xl font-display text-[2.8rem] font-bold leading-[0.98] tracking-[-0.045em] text-[var(--color-text)] sm:text-6xl lg:text-7xl">
              Shared trips.<br />
              <span className="text-[var(--color-positive)]">Fair splits.</span><br />
              Zero spreadsheets.
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-7 text-[var(--color-muted)] sm:text-lg sm:leading-8">
              Parité keeps expenses, service fees, balances, and settlements clear across currencies — so the group can focus on the trip, not the math.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onGetStartedClick}
                aria-controls="auth-card"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#173128] px-6 text-sm font-bold text-[#f6fbf8] shadow-[0_16px_30px_rgba(23,49,40,0.16)] transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              >
                Create your group
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <a
                href="#product"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-[var(--color-border)] bg-white px-6 text-sm font-bold text-[var(--color-text)] transition-colors hover:border-[var(--color-positive)]/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              >
                See Parité in action
              </a>
            </div>

            <p className="mt-6 flex max-w-2xl items-start gap-2 text-xs font-semibold leading-6 text-[var(--color-muted)]">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-positive)]" aria-hidden="true" />
              <span>Free to use. No bank connection. No payment processing.</span>
            </p>
          </div>

          <LaunchPromoVisual eager />
        </div>

      </section>

      <section id="product" className="scroll-mt-24 border-y border-[var(--color-border)] bg-white/55">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="mx-auto mb-10 max-w-3xl text-center lg:mb-14">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--color-positive)]">
              Inside Parité
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-[-0.035em] text-[var(--color-text)] sm:text-5xl">
              One shared picture. No awkward math.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[var(--color-muted)] sm:text-base">
              Move from the group’s expenses to clear balances and private member access without stitching together a spreadsheet, chat thread, and calculator.
            </p>
          </div>

          <ProductShowcase />
        </div>
      </section>

      <section id="why-parite" className="scroll-mt-24 bg-[#173128]">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-14">
            <div className="max-w-xl">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#8fd0b6]">
                Built for real groups
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-[-0.035em] text-[#f6fbf8] sm:text-5xl">
                The details are the product.
              </h2>
              <p className="mt-5 text-sm leading-7 text-[#bfd0c8] sm:text-base">
                Different payers, different currencies, a service fee, one person joining late — Parité keeps the edge cases visible without making the group learn accounting.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {features.map(feature => {
                const Icon = feature.icon;

                return (
                  <article key={feature.title} className="rounded-3xl border border-[#8fd0b6]/15 bg-[#214538] p-5 shadow-sm sm:p-6">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#8fd0b6]/15 text-[#a9e2cb]">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h3 className="mt-5 text-sm font-bold text-[#f6fbf8] sm:text-base">
                      {feature.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-[#bfd0c8]">
                      {feature.body}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-24">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="max-w-2xl">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--color-positive)]">
              Three simple moves
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-[-0.035em] text-[var(--color-text)] sm:text-5xl">
              From first expense to final settlement.
            </h2>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => {
              const Icon = step.icon;

              return (
                <article key={step.title} className="relative overflow-hidden rounded-3xl border border-[var(--color-border)] bg-white p-6 shadow-[var(--shadow-card)]">
                  <span className="absolute right-4 top-1 font-display text-7xl font-bold text-[var(--color-positive-soft)]" aria-hidden="true">
                    {index + 1}
                  </span>
                  <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-positive-soft)] text-[var(--color-positive)]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="relative mt-8 text-base font-bold text-[var(--color-text)]">
                    {step.title}
                  </h3>
                  <p className="relative mt-2 text-sm leading-6 text-[var(--color-muted)]">
                    {step.body}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--color-border)] bg-white/55">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,0.9fr)_minmax(22rem,0.7fr)] lg:px-8 lg:py-24">
          <div className="max-w-2xl">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-positive-soft)] text-[var(--color-positive)]">
              <Users className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="mt-6 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--color-positive)]">
              Your next group
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-[-0.035em] text-[var(--color-text)] sm:text-5xl">
              Start with a clear balance.
            </h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-[var(--color-muted)] sm:text-base">
              Create an account, open a private group, and give everyone one trusted place to see the trip’s shared expenses.
            </p>
            <div className="mt-7 flex flex-col gap-3 text-sm font-semibold text-[var(--color-text)] sm:flex-row sm:flex-wrap sm:gap-x-6">
              <span className="flex items-center gap-2"><Check className="h-4 w-4 text-[var(--color-positive)]" /> Free to use</span>
              <span className="flex items-center gap-2"><Check className="h-4 w-4 text-[var(--color-positive)]" /> Private groups</span>
              <span className="flex items-center gap-2"><Check className="h-4 w-4 text-[var(--color-positive)]" /> Exportable records</span>
            </div>
          </div>

          <div className="w-full max-w-md justify-self-center lg:justify-self-end">
            {authCard}
          </div>
        </div>
      </section>

      <section id="faq" className="scroll-mt-24">
        <div className="mx-auto max-w-5xl px-5 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="text-center">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--color-positive)]">
              Good to know
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-[-0.035em] text-[var(--color-text)] sm:text-5xl">
              Frequently asked questions
            </h2>
          </div>

          <div className="mt-10 grid gap-3 md:grid-cols-2">
            {faqs.map(item => (
              <article key={item.question} className="rounded-3xl border border-[var(--color-border)] bg-white p-6 shadow-sm">
                <h3 className="text-sm font-bold text-[var(--color-text)]">
                  {item.question}
                </h3>
                <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
                  {item.answer}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>

    <footer className="border-t border-[var(--color-border)] bg-white/55">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-7 text-xs text-[var(--color-muted)] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <span className="flex items-center gap-2 font-display text-base font-bold text-[var(--color-text)]">
          <Compass className="h-4 w-4 text-[var(--color-positive)]" aria-hidden="true" />
          Parité
        </span>
        <span>Private group expenses, clear balances, calmer trips.</span>
      </div>
    </footer>
  </div>
);
