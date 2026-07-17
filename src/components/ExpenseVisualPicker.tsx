import React, {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { CaretRight } from '@phosphor-icons/react/dist/csr/CaretRight';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { createPortal } from 'react-dom';
import { ExpenseIcon } from './ExpenseIcon';
import {
  EXPENSE_VISUAL_CATEGORIES,
  RECENT_EXPENSE_VISUAL_STORAGE_KEY,
  getExpenseVisualCategory,
  getExpenseVisualPreset,
  getExpenseVisualPresetsForCategory,
  readRecentExpenseVisualIds,
  rememberRecentExpenseVisual,
  resolveExpenseVisual,
  type ExpenseVisualId,
} from '../lib/expenseVisuals';

export interface ExpenseVisualPickerProps {
  /** The expense title used to infer a visual when value is not set. */
  title: string;
  /** Controlled presentation-only choice. Pass null to keep title inference. */
  value?: ExpenseVisualId | null;
  onChange: (visualId: ExpenseVisualId) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
  /** Pass null to disable persistence, or a Storage object for tests/embeds. */
  storage?: Storage | null;
}

const focusableSelector = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export const ExpenseVisualPicker: React.FC<ExpenseVisualPickerProps> = ({
  title,
  value,
  onChange,
  label = 'Expense icon',
  disabled = false,
  className = '',
  storage,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [recentIds, setRecentIds] = useState<ExpenseVisualId[]>(() =>
    readRecentExpenseVisualIds(storage),
  );
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const headingId = useId();
  const descriptionId = useId();
  const dialogId = useId();
  const resolvedVisual = resolveExpenseVisual(title, value);
  const resolvedCategory = getExpenseVisualCategory(resolvedVisual.categoryId);

  const recentVisuals = useMemo(
    () => recentIds
      .map(id => getExpenseVisualPreset(id))
      .filter((visual): visual is NonNullable<typeof visual> => Boolean(visual)),
    [recentIds],
  );

  useEffect(() => {
    setRecentIds(readRecentExpenseVisualIds(storage));
  }, [storage]);

  useEffect(() => {
    if (storage !== undefined || typeof window === 'undefined') return;

    const handleStorage = (event: StorageEvent) => {
      if (event.key === RECENT_EXPENSE_VISUAL_STORAGE_KEY) {
        setRecentIds(readRecentExpenseVisualIds());
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [storage]);

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
        return;
      }

      if (event.key !== 'Tab' || !sheetRef.current) return;

      const focusableElements = Array.from(
        sheetRef.current.querySelectorAll(focusableSelector),
      ) as HTMLElement[];
      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);
      if (!firstElement || !lastElement) return;

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      triggerRef.current?.focus();
    };
  }, [isOpen]);

  const chooseVisual = (visualId: ExpenseVisualId) => {
    onChange(visualId);
    setRecentIds(rememberRecentExpenseVisual(visualId, storage));
    setIsOpen(false);
  };

  const sheet = isOpen ? (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/50 backdrop-blur-[2px] md:items-center md:p-6"
      onMouseDown={event => {
        if (event.target === event.currentTarget) setIsOpen(false);
      }}
    >
      <div
        ref={sheetRef}
        id={dialogId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-describedby={descriptionId}
        className="flex max-h-[82dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] border border-black/10 bg-[#fffdf8] text-[#1f2937] shadow-[0_-18px_55px_rgba(31,41,55,0.22)] md:max-h-[780px] md:rounded-[28px]"
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-slate-300 md:hidden" />

        <header className="flex items-start justify-between gap-4 border-b border-black/10 px-5 pb-4 pt-3 md:pt-5">
          <div>
            <h2 id={headingId} className="font-display text-lg font-bold tracking-tight">
              Choose an icon
            </h2>
            <p id={descriptionId} className="mt-1 text-xs leading-relaxed text-slate-500">
              Categories are visual only and never change expense data.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => setIsOpen(false)}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-slate-600 transition active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#81b29a]"
            aria-label="Close icon picker"
          >
            <X size={19} weight="bold" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-2">
          {EXPENSE_VISUAL_CATEGORIES.map(category => {
            const presets = getExpenseVisualPresetsForCategory(category.id);

            return (
              <section key={category.id} className="py-3" aria-labelledby={`${headingId}-${category.id}`}>
                <div className="mb-2.5 flex items-end justify-between gap-3 px-1">
                  <div>
                    <h3 id={`${headingId}-${category.id}`} className="text-sm font-bold">
                      {category.label}
                    </h3>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {category.description}
                    </p>
                  </div>
                  <span
                    className="rounded-full border px-2 py-1 text-[10px] font-bold"
                    style={{
                      backgroundColor: category.palette.surface,
                      borderColor: category.palette.border,
                      color: category.palette.foreground,
                    }}
                  >
                    {presets.length}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {presets.map(preset => {
                    const isSelected = preset.id === resolvedVisual.id;

                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => chooseVisual(preset.id)}
                        aria-pressed={isSelected}
                        className="relative flex min-h-[88px] min-w-0 flex-col items-center justify-start gap-1.5 rounded-2xl border bg-white px-1.5 py-2.5 text-center transition active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#81b29a]"
                        style={{
                          borderColor: isSelected
                            ? category.palette.foreground
                            : 'rgba(31, 41, 55, 0.10)',
                          boxShadow: isSelected
                            ? `0 0 0 2px ${category.palette.surfaceStrong}`
                            : undefined,
                        }}
                      >
                        {isSelected && (
                          <span
                            className="absolute right-1.5 top-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full"
                            style={{
                              backgroundColor: category.palette.foreground,
                              color: '#ffffff',
                            }}
                          >
                            <Check size={10} weight="bold" aria-hidden="true" />
                          </span>
                        )}
                        <ExpenseIcon title={title} visualId={preset.id} size="sm" />
                        <span className="line-clamp-2 w-full text-[10px] font-semibold leading-tight text-slate-700">
                          {preset.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        <div
          className="border-t border-black/10 bg-white px-4 pt-3"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="min-h-12 w-full rounded-2xl bg-[#81b29a] px-4 text-sm font-bold text-[#16372b] transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4f7f68] focus-visible:ring-offset-2"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <section className={`min-w-0 ${className}`} aria-label={label}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-slate-600">{label}</span>
        {!value && title.trim() && (
          <span className="text-[10px] font-medium text-slate-400">Suggested from title</span>
        )}
      </div>

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={dialogId}
        className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-black/10 bg-white p-2.5 text-left shadow-sm transition hover:border-black/20 active:scale-[0.995] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#81b29a] disabled:cursor-not-allowed disabled:opacity-55"
      >
        <ExpenseIcon title={title} visualId={value} size="md" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-slate-800">
            {resolvedVisual.label}
          </span>
          <span
            className="mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold"
            style={{
              backgroundColor: resolvedCategory.palette.surface,
              borderColor: resolvedCategory.palette.border,
              color: resolvedCategory.palette.foreground,
            }}
          >
            {resolvedCategory.label}
          </span>
        </span>
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <CaretRight size={18} weight="bold" aria-hidden="true" />
        </span>
      </button>

      <div className="mt-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
            Recent
          </p>
          {recentVisuals.length > 0 && (
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              disabled={disabled}
              className="text-[11px] font-bold text-[#4f7f68] focus:outline-none focus-visible:underline disabled:opacity-55"
            >
              See all 40
            </button>
          )}
        </div>

        {recentVisuals.length > 0 ? (
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {recentVisuals.map(visual => {
              const category = getExpenseVisualCategory(visual.categoryId);
              const isSelected = visual.id === resolvedVisual.id;

              return (
                <button
                  key={visual.id}
                  type="button"
                  onClick={() => chooseVisual(visual.id)}
                  disabled={disabled}
                  aria-pressed={isSelected}
                  className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border bg-white py-1 pl-1 pr-3 text-xs font-semibold text-slate-700 transition active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#81b29a] disabled:opacity-55"
                  style={{
                    borderColor: isSelected
                      ? category.palette.foreground
                      : 'rgba(31, 41, 55, 0.10)',
                  }}
                >
                  <ExpenseIcon title={title} visualId={visual.id} size="xs" />
                  {visual.label}
                </button>
              );
            })}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            disabled={disabled}
            className="w-full rounded-2xl border border-dashed border-black/10 bg-white/70 px-3 py-3 text-left text-xs text-slate-500 transition hover:border-black/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#81b29a] disabled:opacity-55"
          >
            Your recently used icons will appear here. Browse all 40.
          </button>
        )}
      </div>

      {sheet && typeof document !== 'undefined'
        ? createPortal(sheet, document.body)
        : sheet}
    </section>
  );
};
