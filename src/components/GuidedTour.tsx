import React, {
  CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  MousePointer2,
  Sparkles,
  X,
} from 'lucide-react';

export type GuidedTourStepId =
  | 'welcome'
  | 'menu'
  | 'groups'
  | 'add-expense'
  | 'search'
  | 'balances'
  | 'settlements'
  | 'members'
  | 'finish';

export interface GuidedTourStep {
  id: GuidedTourStepId;
  eyebrow: string;
  title: string;
  description: string;
  targetLabel?: string;
  selectors?: readonly string[];
  scrollBlock?: ScrollLogicalPosition;
}

const GUIDED_TOUR_STEPS: readonly GuidedTourStep[] = [
  {
    id: 'welcome',
    eyebrow: 'First quest',
    title: 'Learn Parité in under a minute',
    description: 'Follow the animated pointer through the essentials. This tour only demonstrates controls and never changes your group data.',
  },
  {
    id: 'menu',
    eyebrow: 'Your command center',
    title: 'Start from your account',
    description: 'Open your account area for personal settings, group tools, exports, or the guided tour.',
    targetLabel: 'Account controls',
    selectors: ['#btn-open-side-menu', '#btn-desktop-account-settings'],
  },
  {
    id: 'groups',
    eyebrow: 'Move between groups',
    title: 'All your groups live here',
    description: 'Choose a group to switch context. Longer lists stay compact until you ask to see more.',
    targetLabel: 'Groups list',
    selectors: [
      '#side-menu-group-list > button:first-child',
      '#side-menu-group-list',
      '#desktop-workspace-list > button:first-child',
      '#desktop-workspace-list',
    ],
    scrollBlock: 'end',
  },
  {
    id: 'add-expense',
    eyebrow: 'Core action',
    title: 'Add a shared expense',
    description: 'Use the plus button to enter an amount, choose a category icon, select who paid, and split the cost.',
    targetLabel: 'Add expense button',
    selectors: ['#btn-add-expense-tab'],
  },
  {
    id: 'search',
    eyebrow: 'Find anything',
    title: 'Search your spending history',
    description: 'Search by expense title, category, or payer. The list filters as you type.',
    targetLabel: 'Expense search',
    selectors: ['#expense-search'],
  },
  {
    id: 'balances',
    eyebrow: 'Who owes whom',
    title: 'Open Balances',
    description: 'Balances turns every shared expense into a clear summary of who should pay whom.',
    targetLabel: 'Balances navigation button',
    selectors: ['#nav-tab-balances', '#nav-tab-balances-desktop', '#nav-tab-balances-rail'],
  },
  {
    id: 'settlements',
    eyebrow: 'Close the loop',
    title: 'Track settlement history',
    description: 'Record repayments and review paid or cancelled settlements without losing the original expense trail.',
    targetLabel: 'Settlement history button',
    selectors: ['#btn-settlement-history-tab'],
  },
  {
    id: 'members',
    eyebrow: 'Your group',
    title: 'Meet the Members section',
    description: 'Review members, requests, roles, avatars, and each person’s spending breakdown from one place.',
    targetLabel: 'Members navigation button',
    selectors: ['#nav-tab-members', '#nav-tab-members-desktop', '#nav-tab-members-rail'],
  },
  {
    id: 'finish',
    eyebrow: 'Quest complete',
    title: 'You are ready to share expenses',
    description: 'You can replay this tour any time from your avatar menu. Nothing in your group was changed.',
  },
] as const;

interface GuidedTourProps {
  isOpen: boolean;
  onComplete: () => void;
  onSkip: () => void;
  onStepChange?: (step: GuidedTourStep, index: number) => void;
}

interface HighlightRect {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

const TARGET_PADDING = 8;
const VIEWPORT_GUTTER = 12;

function isVisibleTarget(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0 || element.getClientRects().length === 0) return false;

  const style = window.getComputedStyle(element);
  return style.display !== 'none'
    && style.visibility !== 'hidden'
    && style.opacity !== '0';
}

function findVisibleTarget(selectors: readonly string[] | undefined): HTMLElement | null {
  if (!selectors) return null;

  for (const selector of selectors) {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>(selector));
    const visibleCandidate = candidates.find(isVisibleTarget);
    if (visibleCandidate) return visibleCandidate;
  }

  return null;
}

function getHighlightRect(element: HTMLElement): HighlightRect | null {
  const rect = element.getBoundingClientRect();
  const viewportRight = window.innerWidth - VIEWPORT_GUTTER;
  const viewportBottom = window.innerHeight - VIEWPORT_GUTTER;
  if (rect.right <= VIEWPORT_GUTTER
    || rect.bottom <= VIEWPORT_GUTTER
    || rect.left >= viewportRight
    || rect.top >= viewportBottom) {
    return null;
  }

  const left = Math.min(viewportRight, Math.max(VIEWPORT_GUTTER, rect.left - TARGET_PADDING));
  const top = Math.min(viewportBottom, Math.max(VIEWPORT_GUTTER, rect.top - TARGET_PADDING));
  const right = Math.max(VIEWPORT_GUTTER, Math.min(viewportRight, rect.right + TARGET_PADDING));
  const bottom = Math.max(VIEWPORT_GUTTER, Math.min(viewportBottom, rect.bottom + TARGET_PADDING));
  if (right <= left || bottom <= top) return null;

  return {
    top,
    right,
    bottom,
    left,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

function rectsMatch(left: HighlightRect | null, right: HighlightRect | null): boolean {
  if (left === right) return true;
  if (!left || !right) return false;

  return Math.abs(left.top - right.top) < 0.5
    && Math.abs(left.left - right.left) < 0.5
    && Math.abs(left.width - right.width) < 0.5
    && Math.abs(left.height - right.height) < 0.5;
}

export const GuidedTour: React.FC<GuidedTourProps> = ({
  isOpen,
  onComplete,
  onSkip,
  onStepChange,
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [highlightRect, setHighlightRect] = useState<HighlightRect | null>(null);
  const [dialogHeight, setDialogHeight] = useState(264);
  const [viewportSize, setViewportSize] = useState(() => ({
    width: typeof window === 'undefined' ? 390 : window.innerWidth,
    height: typeof window === 'undefined' ? 844 : window.innerHeight,
  }));
  const dialogRef = useRef<HTMLElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const activeTargetRef = useRef<HTMLElement | null>(null);
  const step = GUIDED_TOUR_STEPS[stepIndex];
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === GUIDED_TOUR_STEPS.length - 1;

  const updateTarget = useCallback(() => {
    const target = findVisibleTarget(step.selectors);
    activeTargetRef.current = target;
    const nextRect = target ? getHighlightRect(target) : null;
    setHighlightRect(current => rectsMatch(current, nextRect) ? current : nextRect);
  }, [step.selectors]);

  useEffect(() => {
    if (!isOpen) {
      setStepIndex(0);
      setHighlightRect(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    onStepChange?.(step, stepIndex);
  }, [isOpen, onStepChange, step, stepIndex]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let settleFrame = 0;
    const prepareFrame = window.requestAnimationFrame(() => {
      const target = findVisibleTarget(step.selectors);
      target?.scrollIntoView({
        block: step.scrollBlock ?? 'center',
        inline: 'nearest',
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });
      updateTarget();
      settleFrame = window.requestAnimationFrame(updateTarget);
    });

    const handleViewportChange = () => {
      setViewportSize(current => {
        const nextSize = { width: window.innerWidth, height: window.innerHeight };
        return current.width === nextSize.width && current.height === nextSize.height
          ? current
          : nextSize;
      });
      updateTarget();
    };
    handleViewportChange();
    const mutationObserver = new MutationObserver(updateTarget);
    mutationObserver.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
    });
    const viewportObserver = new ResizeObserver(handleViewportChange);
    viewportObserver.observe(document.documentElement);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    window.visualViewport?.addEventListener('resize', handleViewportChange);
    window.visualViewport?.addEventListener('scroll', handleViewportChange);

    return () => {
      window.cancelAnimationFrame(prepareFrame);
      window.cancelAnimationFrame(settleFrame);
      mutationObserver.disconnect();
      viewportObserver.disconnect();
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('scroll', handleViewportChange);
      activeTargetRef.current = null;
    };
  }, [isOpen, step.scrollBlock, step.selectors, updateTarget]);

  useEffect(() => {
    if (!isOpen || !dialogRef.current) return undefined;

    const resizeObserver = new ResizeObserver(entries => {
      const nextHeight = entries[0]?.contentRect.height;
      if (nextHeight) setDialogHeight(nextHeight);
    });
    resizeObserver.observe(dialogRef.current);
    return () => resizeObserver.disconnect();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    restoreFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const appRoot = document.getElementById('root');
    const previousRootInert = appRoot?.inert ?? false;
    const previousRootAriaHidden = appRoot?.getAttribute('aria-hidden') ?? null;
    if (appRoot) {
      appRoot.inert = true;
      appRoot.setAttribute('aria-hidden', 'true');
    }

    const focusFrame = window.requestAnimationFrame(() => {
      const initialFocus = dialogRef.current?.querySelector<HTMLElement>('[data-tour-autofocus]');
      (initialFocus ?? dialogRef.current)?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onSkip();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusableElements = (Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )) as HTMLElement[]).filter(element => !element.hidden && element.getClientRects().length > 0);

      if (focusableElements.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;
      if (event.shiftKey && (activeElement === firstFocusable || !dialogRef.current.contains(activeElement))) {
        event.preventDefault();
        lastFocusable.focus();
      } else if (!event.shiftKey && (activeElement === lastFocusable || !dialogRef.current.contains(activeElement))) {
        event.preventDefault();
        firstFocusable.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      if (appRoot) {
        appRoot.inert = previousRootInert;
        if (previousRootAriaHidden === null) appRoot.removeAttribute('aria-hidden');
        else appRoot.setAttribute('aria-hidden', previousRootAriaHidden);
      }
      const restoreCandidate = restoreFocusRef.current;
      const canRestoreCandidate = Boolean(
        restoreCandidate?.isConnected
        && restoreCandidate !== document.body
        && restoreCandidate !== document.documentElement,
      );
      const focusTarget = canRestoreCandidate
        ? restoreCandidate
        : document.querySelector<HTMLElement>('#btn-open-side-menu');
      focusTarget?.focus();
    };
  }, [isOpen, onSkip]);

  const dialogStyle = useMemo<CSSProperties>(() => {
    const viewportWidth = viewportSize.width;
    const viewportHeight = viewportSize.height;
    const width = Math.min(368, viewportWidth - (VIEWPORT_GUTTER * 2));
    if (!highlightRect) {
      return {
        left: Math.max(VIEWPORT_GUTTER, (viewportWidth - width) / 2),
        top: Math.max(VIEWPORT_GUTTER, (viewportHeight - dialogHeight) / 2),
        width,
      };
    }

    const horizontalCenter = highlightRect.left + (highlightRect.width / 2);
    const left = Math.min(
      viewportWidth - width - VIEWPORT_GUTTER,
      Math.max(VIEWPORT_GUTTER, horizontalCenter - (width / 2)),
    );
    const spacing = 16;
    const fitsBelow = viewportHeight - highlightRect.bottom >= dialogHeight + spacing + VIEWPORT_GUTTER;
    const fitsAbove = highlightRect.top >= dialogHeight + spacing + VIEWPORT_GUTTER;
    const top = fitsBelow
      ? highlightRect.bottom + spacing
      : fitsAbove
        ? highlightRect.top - dialogHeight - spacing
        : Math.max(VIEWPORT_GUTTER, viewportHeight - dialogHeight - VIEWPORT_GUTTER);

    return { left, top, width };
  }, [dialogHeight, highlightRect, viewportSize.height, viewportSize.width]);

  if (!isOpen || typeof document === 'undefined') return null;

  const nextStep = () => {
    if (isLastStep) {
      onComplete();
      return;
    }
    setStepIndex(current => Math.min(current + 1, GUIDED_TOUR_STEPS.length - 1));
  };

  const previousStep = () => setStepIndex(current => Math.max(current - 1, 0));
  const progress = Math.round(((stepIndex + 1) / GUIDED_TOUR_STEPS.length) * 100);

  const tour = (
    <div className="fixed inset-0 z-[100] font-sans text-[var(--color-text)]">
      {!highlightRect && (
        <div className="absolute inset-0 bg-[#17211d]/80" aria-hidden="true" />
      )}

      {highlightRect && (
        <>
          <div
            className="guided-tour-spotlight pointer-events-none fixed rounded-[22px] border-2 border-[#9fe4c8] bg-transparent shadow-[0_0_0_9999px_rgba(23,33,29,0.78),0_0_0_5px_rgba(159,228,200,0.18),0_12px_34px_rgba(0,0,0,0.2)]"
            style={{
              top: highlightRect.top,
              left: highlightRect.left,
              width: highlightRect.width,
              height: highlightRect.height,
            }}
            aria-hidden="true"
          />
          <div
            className="guided-tour-tap pointer-events-none fixed h-12 w-12 rounded-full border-2 border-[#9fe4c8]"
            style={{
              top: highlightRect.top + (highlightRect.height * 0.54) - 24,
              left: highlightRect.left + (highlightRect.width * 0.66) - 24,
            }}
            aria-hidden="true"
          />
          <MousePointer2
            className="guided-tour-pointer pointer-events-none fixed h-8 w-8 fill-white text-[#205e4c] drop-shadow-[0_3px_2px_rgba(0,0,0,0.25)]"
            style={{
              top: highlightRect.top + (highlightRect.height * 0.54) - 4,
              left: highlightRect.left + (highlightRect.width * 0.66) - 4,
            }}
            aria-hidden="true"
          />
        </>
      )}

      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guided-tour-title"
        aria-describedby="guided-tour-description"
        tabIndex={-1}
        className="guided-tour-dialog no-scrollbar fixed max-h-[calc(100dvh-24px)] overflow-y-auto rounded-[26px] border border-white/70 bg-white shadow-[0_24px_70px_rgba(8,26,20,0.35)]"
        style={dialogStyle}
      >
        <div className="h-1.5 bg-[#e3eee9]">
          <div
            className="h-full rounded-r-full bg-[#4fa889] transition-[width] duration-300"
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-label="Guided tour progress"
            aria-valuemin={1}
            aria-valuemax={GUIDED_TOUR_STEPS.length}
            aria-valuenow={stepIndex + 1}
            aria-valuetext={`Step ${stepIndex + 1} of ${GUIDED_TOUR_STEPS.length}`}
          />
        </div>

        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#2f7d66]">
              {isLastStep ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <Sparkles className="h-4 w-4 shrink-0" />}
              <span>{step.eyebrow}</span>
            </div>
            <button
              type="button"
              onClick={onSkip}
              className="-mr-1 -mt-1 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-2xl text-[#66736d] hover:bg-[#eef4f1] hover:text-[#17211d]"
              aria-label="Skip guided tour"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <h2 id="guided-tour-title" className="mt-2 font-display text-[22px] font-bold leading-tight text-[#17211d]">
            {step.title}
          </h2>
          <p id="guided-tour-description" className="mt-2 text-sm leading-relaxed text-[#66736d]">
            {step.description}
          </p>

          {step.targetLabel && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#4fa889]/20 bg-[#ddf0e8] px-3 py-1.5 text-[11px] font-bold text-[#2f7d66]">
              <span className="guided-tour-mini-tap h-2 w-2 rounded-full bg-[#4fa889]" aria-hidden="true" />
              {highlightRect ? step.targetLabel : `${step.targetLabel} is not available on this screen`}
            </div>
          )}

          <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#dfe7e3] pt-4">
            <button
              type="button"
              onClick={onSkip}
              className="min-h-11 cursor-pointer rounded-2xl px-2 text-xs font-bold text-[#66736d] hover:text-[#17211d]"
            >
              Skip tour
            </button>
            <div className="flex items-center gap-2">
              {!isFirstStep && (
                <button
                  type="button"
                  onClick={previousStep}
                  className="flex min-h-11 cursor-pointer items-center gap-1 rounded-2xl border border-[#dfe7e3] bg-white px-3 text-xs font-bold text-[#17211d] hover:bg-[#eef4f1]"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
              )}
              <button
                type="button"
                data-tour-autofocus
                onClick={nextStep}
                className="flex min-h-11 cursor-pointer items-center gap-1 rounded-2xl bg-[#4fa889] px-4 text-xs font-bold text-white shadow-[0_8px_22px_rgba(47,125,102,0.22)] hover:bg-[#3e8f75]"
              >
                {isLastStep ? 'Finish' : isFirstStep ? 'Start quest' : 'Next'}
                {isLastStep ? <CheckCircle2 className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </section>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        Step {stepIndex + 1} of {GUIDED_TOUR_STEPS.length}: {step.title}
      </p>
    </div>
  );

  return createPortal(tour, document.body);
};
