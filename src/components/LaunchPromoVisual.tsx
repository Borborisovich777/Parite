import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Receipt,
  Scale,
  ShieldCheck,
  Users,
} from 'lucide-react';

export type PromoScreen = 'expenses' | 'balances' | 'members';

const promoScreens = {
  expenses: {
    label: 'Expenses',
    eyebrow: 'Know where you stand',
    title: 'A clear view of every shared expense.',
    body: 'See what the group spent, what you covered, and what you are owed — all in one place.',
    image: '/promo/product-expenses.png',
    alt: 'Parité expense overview for Weekend in Dubai showing total spend, personal balance, and recent expenses.',
    icon: Receipt,
    proof: '12 expenses · AED 4,552.99 total',
  },
  balances: {
    label: 'Balances',
    eyebrow: 'Settle with less back-and-forth',
    title: 'Turn a busy group into a simple answer.',
    body: 'Understand every member’s position and get the fewest-transfer route to settling up.',
    image: '/promo/product-balances.png',
    alt: 'Parité balances view showing how much each member gets back or owes.',
    icon: Scale,
    proof: 'Clear positions · Fewer transfers',
  },
  members: {
    label: 'Private groups',
    eyebrow: 'Invite with confidence',
    title: 'Keep access in the hands of your group.',
    body: 'Share an invite link, QR, or manual code, approve requests, and manage the people inside each private group.',
    image: '/promo/product-members.png',
    alt: 'Parité members view showing a private invite code and group member controls.',
    icon: Users,
    proof: 'Link, QR, or code · Admin approval',
  },
} as const;

interface ProductDeviceProps {
  screen: PromoScreen;
  className?: string;
  eager?: boolean;
}

export const ProductDevice: React.FC<ProductDeviceProps> = ({
  screen,
  className = '',
  eager = false,
}) => {
  const item = promoScreens[screen];

  return (
    <figure className={`promo-device ${className}`.trim()}>
      <div className="promo-device-rail" aria-hidden="true" />
      <img
        src={item.image}
        alt={item.alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
      />
    </figure>
  );
};

interface LaunchPromoVisualProps {
  screen?: PromoScreen;
  className?: string;
  eager?: boolean;
}

export const LaunchPromoVisual: React.FC<LaunchPromoVisualProps> = ({
  screen = 'expenses',
  className = '',
  eager = false,
}) => {
  const item = promoScreens[screen];

  return (
    <div className={`launch-visual-stage ${className}`.trim()}>
      <div className="launch-visual-orbit launch-visual-orbit-one" aria-hidden="true" />
      <div className="launch-visual-orbit launch-visual-orbit-two" aria-hidden="true" />
      <div className="launch-visual-grid" aria-hidden="true" />

      <div className="launch-visual-proof launch-visual-proof-top" aria-hidden="true">
        <span className="launch-visual-proof-icon">
          <CheckCircle2 className="h-4 w-4" />
        </span>
        <span>
          <small>{item.label}</small>
          <strong>{item.proof}</strong>
        </span>
      </div>

      <ProductDevice screen={screen} className="launch-visual-device" eager={eager} />

      <div className="launch-visual-proof launch-visual-proof-bottom" aria-hidden="true">
        <span className="launch-visual-proof-icon">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <span>
          <small>Private by design</small>
          <strong>Invite link + approval</strong>
        </span>
      </div>
    </div>
  );
};

export const ProductShowcase: React.FC = () => {
  const [activeScreen, setActiveScreen] = useState<PromoScreen>('expenses');
  const [displayedScreen, setDisplayedScreen] = useState<PromoScreen>('expenses');
  const requestedScreenRef = useRef<PromoScreen>('expenses');
  const preloadPromisesRef = useRef(new Map<PromoScreen, Promise<void>>());
  const activeItem = promoScreens[activeScreen];
  const ActiveIcon = activeItem.icon;

  const preloadScreen = useCallback((screen: PromoScreen) => {
    const existing = preloadPromisesRef.current.get(screen);
    if (existing) return existing;

    const promise = new Promise<void>(resolve => {
      const image = new Image();
      let settled = false;

      const finish = async () => {
        if (settled) return;
        settled = true;

        try {
          await image.decode();
        } catch {
          // A completed load is still safe to display when decode is unavailable.
        }
        resolve();
      };

      image.addEventListener('load', finish, { once: true });
      image.addEventListener('error', finish, { once: true });
      image.src = promoScreens[screen].image;

      if (image.complete) void finish();
    });

    preloadPromisesRef.current.set(screen, promise);
    return promise;
  }, []);

  useEffect(() => {
    (Object.keys(promoScreens) as PromoScreen[]).forEach(screen => {
      void preloadScreen(screen);
    });
  }, [preloadScreen]);

  const selectScreen = (screen: PromoScreen) => {
    requestedScreenRef.current = screen;
    setActiveScreen(screen);

    void preloadScreen(screen).then(() => {
      if (requestedScreenRef.current === screen) {
        setDisplayedScreen(screen);
      }
    });
  };

  return (
    <div className="product-showcase-grid">
      <div className="product-showcase-copy">
        <div className="product-showcase-tabs" role="group" aria-label="Explore Parité">
          {(Object.keys(promoScreens) as PromoScreen[]).map(screen => {
            const item = promoScreens[screen];
            const Icon = item.icon;
            const isActive = screen === activeScreen;

            return (
              <button
                key={screen}
                type="button"
                aria-pressed={isActive}
                aria-controls="product-showcase-panel"
                onClick={() => selectScreen(screen)}
                className="product-showcase-tab"
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>

        <div
          id="product-showcase-panel"
          aria-live="polite"
          className="product-showcase-panel"
        >
          <span className="product-showcase-icon" aria-hidden="true">
            <ActiveIcon className="h-5 w-5" />
          </span>
          <p className="product-showcase-eyebrow">{activeItem.eyebrow}</p>
          <h3>{activeItem.title}</h3>
          <p>{activeItem.body}</p>
          <div className="product-showcase-proof">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {activeItem.proof}
          </div>
        </div>
      </div>

      <div className="product-showcase-visual">
        <div className="product-showcase-halo" aria-hidden="true" />
        <ProductDevice screen={displayedScreen} eager />
      </div>
    </div>
  );
};
