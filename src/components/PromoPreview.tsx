import React from 'react';
import { ArrowRight, CheckCircle2, Compass } from 'lucide-react';
import { LaunchPromoVisual, type PromoScreen } from './LaunchPromoVisual';

export type PromoFormat = 'landscape' | 'feed' | 'square' | 'story';

interface PromoPreviewProps {
  format: PromoFormat;
  screen?: PromoScreen;
}

const formatCopy: Record<PromoFormat, { eyebrow: string; headline: React.ReactNode; support: string }> = {
  landscape: {
    eyebrow: 'Parité is live',
    headline: <>Shared trips.<br />Fair splits.</>,
    support: 'Track expenses, balances, and settlements across currencies — without the spreadsheet.',
  },
  feed: {
    eyebrow: 'Meet Parité',
    headline: <>The trip is shared.<br />Now the math is too.</>,
    support: 'Private group expenses with clear balances and fewer-transfer settlements.',
  },
  square: {
    eyebrow: 'Parité is live',
    headline: <>Fair splits.<br />Clear balances.</>,
    support: 'Shared expenses made easy for private groups.',
  },
  story: {
    eyebrow: 'Now live',
    headline: <>Keep the trip.<br />Lose the spreadsheet.</>,
    support: 'Track shared expenses, understand balances, and settle with less back-and-forth.',
  },
};

const featureCopy: Record<Exclude<PromoScreen, 'expenses'>, { eyebrow: string; headline: React.ReactNode; support: string }> = {
  balances: {
    eyebrow: 'Clear balances',
    headline: <>Know who owes what.<br />Settle in fewer moves.</>,
    support: 'See every member’s position and the simplest route to closing the balance.',
  },
  members: {
    eyebrow: 'Private groups',
    headline: <>Invite the group.<br />Keep it in the group.</>,
    support: 'Share a code, approve requests, and stay in control of who can see each trip.',
  },
};

export const PromoPreview: React.FC<PromoPreviewProps> = ({ format, screen = 'expenses' }) => {
  const copy = screen === 'expenses' ? formatCopy[format] : featureCopy[screen];

  return (
    <main className={`promo-canvas promo-canvas-${format}`} aria-label={`Parité ${format} launch promotion`}>
      <div className="promo-canvas-wash" aria-hidden="true" />
      <div className="promo-canvas-grain" aria-hidden="true" />

      <header className="promo-canvas-brand">
        <span className="promo-canvas-mark" aria-hidden="true">
          <Compass />
        </span>
        <span>Parité</span>
      </header>

      <section className="promo-canvas-copy">
        <p className="promo-canvas-eyebrow">
          <span aria-hidden="true" />
          {copy.eyebrow}
        </p>
        <h1>{copy.headline}</h1>
        <p className="promo-canvas-support">{copy.support}</p>
        <div className="promo-canvas-cta">
          Get started free
          <ArrowRight aria-hidden="true" />
        </div>
      </section>

      <LaunchPromoVisual screen={screen} className="promo-canvas-visual" eager />

      <footer className="promo-canvas-footer">
        <span><CheckCircle2 aria-hidden="true" /> Private invite-code groups</span>
        <span><CheckCircle2 aria-hidden="true" /> No bank connection</span>
      </footer>
    </main>
  );
};
