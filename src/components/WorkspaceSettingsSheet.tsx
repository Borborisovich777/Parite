import React, { useEffect, useId, useRef, useState } from 'react';
import {
  Download,
  Edit2,
  KeyRound,
  RefreshCw,
  Settings,
  UserMinus,
  Users,
  X,
} from 'lucide-react';
import type {
  Currency,
  Member,
  Trip,
  TripClosureVote,
} from '../types';
import { SUPPORTED_CURRENCIES } from '../types';
import {
  CloseoutProgressCard,
  type CloseoutBusyAction,
} from './CloseoutProgressCard';

export type WorkspaceSettingsExportType = 'expenses' | 'balances' | 'settlements';
export type WorkspaceSettingsMode = 'settings' | 'closeout';

type SettingsBusyAction =
  | 'save-name'
  | 'save-currency'
  | 'leave'
  | 'start'
  | 'approve'
  | 'cancel'
  | 'review'
  | `export-${WorkspaceSettingsExportType}`;

export interface WorkspaceSettingsSheetProps {
  isOpen: boolean;
  mode?: WorkspaceSettingsMode;
  trip: Trip;
  currentMember: Member | null;
  members: Member[];
  closureVotes: TripClosureVote[];
  closeoutBlockers?: readonly string[];
  onClose: () => void;
  onAdminTools: () => void;
  onExchangeRates: () => void;
  onUpdateTripName: (name: string) => Promise<void>;
  onUpdateDisplayCurrency: (currency: Currency | null) => Promise<void>;
  onLeaveTrip: () => Promise<void>;
  onStartTripClosure: () => Promise<void>;
  onApproveTripClosure: () => Promise<void>;
  onCancelTripClosure: () => Promise<void>;
  onReviewBalances: () => void | Promise<void>;
  onExportExpensesCsv: () => void | Promise<void>;
  onExportBalancesCsv: () => void | Promise<void>;
  onExportSettlementsCsv: () => void | Promise<void>;
  exportBusy: WorkspaceSettingsExportType | null;
  onActionError?: (message: string) => void;
}

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const getSafeMessage = (error: unknown, fallback: string) => {
  if (!(error instanceof Error) || !error.message.trim()) return fallback;

  const message = error.message.trim();
  const looksRaw = /(PGRST|SQLSTATE|violates|constraint|duplicate key|invalid input syntax|relation .* does not exist|function .* does not exist|column .* does not exist)/i.test(message);

  return looksRaw ? fallback : message;
};

export const WorkspaceSettingsSheet: React.FC<WorkspaceSettingsSheetProps> = ({
  isOpen,
  mode = 'settings',
  trip,
  currentMember,
  members,
  closureVotes,
  closeoutBlockers = [],
  onClose,
  onAdminTools,
  onExchangeRates,
  onUpdateTripName,
  onUpdateDisplayCurrency,
  onLeaveTrip,
  onStartTripClosure,
  onApproveTripClosure,
  onCancelTripClosure,
  onReviewBalances,
  onExportExpensesCsv,
  onExportBalancesCsv,
  onExportSettlementsCsv,
  exportBusy,
  onActionError,
}) => {
  const headingId = useId();
  const descriptionId = useId();
  const tripNameInputId = useId();
  const displayCurrencyInputId = useId();
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const [tripNameInput, setTripNameInput] = useState(trip.name);
  const [displayCurrencyInput, setDisplayCurrencyInput] = useState<Currency | ''>(
    currentMember?.display_currency ?? '',
  );
  const [busyAction, setBusyAction] = useState<SettingsBusyAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const tripStatus = trip.status ?? 'active';
  const isTripActive = tripStatus === 'active';
  const isApprovedMember = currentMember?.status === 'approved';
  const isAdmin = isApprovedMember && currentMember?.role === 'admin';
  const isSavingTripName = busyAction === 'save-name';
  const isSavingDisplayCurrency = busyAction === 'save-currency';
  const lifecycleBusyAction: CloseoutBusyAction | null = (
    busyAction === 'start'
    || busyAction === 'approve'
    || busyAction === 'cancel'
    || busyAction === 'review'
  )
    ? busyAction
    : null;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    setTripNameInput(trip.name);
  }, [isOpen, trip.id, trip.name]);

  useEffect(() => {
    if (!isOpen) return;

    setDisplayCurrencyInput(currentMember?.display_currency ?? '');
  }, [currentMember?.display_currency, currentMember?.id, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    setActionError(null);
    setBusyAction(null);
  }, [isOpen, mode, trip.id]);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedElementRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusableCandidates = Array.from(
        dialog.querySelectorAll(focusableSelector),
      ) as HTMLElement[];
      const focusableElements = focusableCandidates.filter(element => (
        !element.hasAttribute('disabled')
        && element.getAttribute('aria-hidden') !== 'true'
        && element.getClientRects().length > 0
      ));

      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && (activeElement === firstElement || !dialog.contains(activeElement))) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && (activeElement === lastElement || !dialog.contains(activeElement))) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = previousBodyOverflow;
      const previousFocus = previouslyFocusedElementRef.current;
      if (
        previousFocus
        && previousFocus !== document.body
        && previousFocus.isConnected
        && previousFocus.getClientRects().length > 0
      ) {
        previousFocus.focus();
      } else {
        const fallbackFocus = Array.from(document.querySelectorAll<HTMLElement>(
          '#btn-menu-closeout, #btn-desktop-closeout, #btn-open-side-menu, #btn-desktop-group-settings',
        )).find(element => element.getClientRects().length > 0);
        fallbackFocus?.focus();
      }
    };
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const reportActionError = (message: string) => {
    setActionError(message);
    onActionError?.(message);
  };

  const runAction = async (
    actionType: SettingsBusyAction,
    action: () => void | Promise<void>,
    fallback: string,
    onSuccess?: () => void,
  ) => {
    if (busyAction !== null) return;

    setBusyAction(actionType);
    setActionError(null);

    try {
      await action();
      onSuccess?.();
    } catch (error) {
      console.error(error);
      reportActionError(getSafeMessage(error, fallback));
    } finally {
      setBusyAction(null);
    }
  };

  const openDestination = (action: () => void, fallback: string) => {
    setActionError(null);

    try {
      action();
      onClose();
    } catch (error) {
      console.error(error);
      reportActionError(getSafeMessage(error, fallback));
    }
  };

  const handleSaveTripName = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextName = tripNameInput.trim();

    if (!nextName) {
      reportActionError('Group name is required.');
      return;
    }

    await runAction(
      'save-name',
      () => onUpdateTripName(nextName),
      'Could not rename group.',
    );
  };

  const handleSaveDisplayCurrency = async (event: React.FormEvent) => {
    event.preventDefault();

    await runAction(
      'save-currency',
      () => onUpdateDisplayCurrency(displayCurrencyInput || null),
      'Could not save display currency.',
    );
  };

  const handleStartCloseout = async () => {
    const confirmed = window.confirm(
      `Start closeout for "${trip.name}"? New expenses and group changes will pause while every approved member reviews the balances and approves closing the group. You can cancel closeout before the final approval.`,
    );

    if (!confirmed) return;

    await runAction(
      'start',
      onStartTripClosure,
      'Could not start closeout.',
    );
  };

  const handleLeaveTrip = async () => {
    const confirmed = window.confirm(
      `Leave "${trip.name}"? You will lose access to this group, but your historical expenses and balances will remain visible to its other members.`,
    );

    if (!confirmed) return;

    await runAction(
      'leave',
      onLeaveTrip,
      'Could not leave this group.',
      onClose,
    );
  };

  const handleReviewBalances = async () => {
    await runAction(
      'review',
      onReviewBalances,
      'Could not open group balances.',
      onClose,
    );
  };

  const runExport = async (
    exportType: WorkspaceSettingsExportType,
    action: () => void | Promise<void>,
  ) => {
    await runAction(
      `export-${exportType}`,
      action,
      `Could not export ${exportType}.`,
    );
  };

  const isExporting = (exportType: WorkspaceSettingsExportType) => (
    exportBusy === exportType || busyAction === `export-${exportType}`
  );
  const exportsDisabled = exportBusy !== null
    || busyAction?.startsWith('export-') === true;

  return (
    <div className="fixed inset-0 z-[55] flex justify-end md:p-6">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-[#17211d]/45 backdrop-blur-[2px]"
        aria-label={mode === 'closeout' ? 'Close group closeout' : 'Close workspace settings'}
        onClick={onClose}
      />

      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="relative z-10 flex h-full min-h-0 w-full max-w-[620px] flex-col overflow-hidden border-l border-[var(--color-border)] bg-[var(--color-app-background)] shadow-[var(--shadow-sheet)] animate-slide-up md:max-h-[calc(100dvh-3rem)] md:rounded-[28px] md:border"
      >
        <header className="app-header-safe header-wash flex shrink-0 items-start justify-between gap-4 border-b border-[var(--color-border)] px-4 pb-4 sm:px-5">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-positive)]">
              {mode === 'closeout' ? 'Group closeout' : 'Workspace settings'}
            </p>
            <h2
              id={headingId}
              className="mt-1 truncate font-display text-xl font-bold text-[var(--color-text)]"
            >
              {trip.name}
            </h2>
            <p
              id={descriptionId}
              className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]"
            >
              {mode === 'closeout'
                ? 'Review balances, approvals, and the final group status.'
                : 'Personal preferences, group controls, and exports.'}
            </p>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            id="btn-settings-close"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-2xl border border-white/70 bg-white/80 text-[var(--color-text)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-positive)] focus:ring-offset-2"
            aria-label={mode === 'closeout' ? 'Close group closeout' : 'Close workspace settings'}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3.5 py-4 sm:px-5 sm:py-5">
          {actionError && (
            <div
              className="rounded-2xl border border-[var(--color-negative)]/15 bg-[var(--color-negative-soft)] px-3 py-3 text-xs font-bold leading-relaxed text-[var(--color-negative)]"
              role="alert"
              aria-live="assertive"
            >
              {actionError}
            </div>
          )}

          {mode === 'settings' ? (
            <>
          <section className="parite-card p-4 sm:p-5" aria-labelledby="settings-personal-title">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-positive-soft)] text-[var(--color-positive)]">
                <KeyRound className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <h3 id="settings-personal-title" className="text-sm font-bold text-[var(--color-text)]">
                  Personal
                </h3>
                <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-muted)]">
                  Settings that only affect your account and how you see amounts.
                </p>
              </div>
            </div>

            <form
              className="mt-4"
              onSubmit={handleSaveDisplayCurrency}
            >
              <label
                htmlFor={displayCurrencyInputId}
                className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]"
              >
                Display currency
              </label>
              <select
                id={displayCurrencyInputId}
                value={displayCurrencyInput}
                onChange={event => setDisplayCurrencyInput(event.target.value as Currency | '')}
                disabled={!currentMember || isSavingDisplayCurrency}
                className="min-h-11 w-full rounded-2xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--color-text)] focus:border-[var(--color-positive)] focus:outline-none focus:ring-2 focus:ring-[var(--color-positive)]/20 disabled:opacity-60"
              >
                <option value="">Same as group base currency</option>
                {SUPPORTED_CURRENCIES.map(currency => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-[11px] leading-relaxed text-[var(--color-muted)]">
                This only changes how amounts are shown to you. Group accounting always stays in{' '}
                <span className="font-mono font-bold">{trip.base_currency}</span>.
              </p>
              <button
                type="submit"
                disabled={
                  !currentMember
                  || isSavingDisplayCurrency
                  || displayCurrencyInput === (currentMember?.display_currency ?? '')
                }
                className="mt-3 min-h-10 w-full cursor-pointer rounded-2xl bg-[var(--color-positive)] px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingDisplayCurrency ? 'Saving...' : 'Save display currency'}
              </button>
            </form>
          </section>

          <section className="parite-card p-4 sm:p-5" aria-labelledby="settings-group-title">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-positive-soft)] text-[var(--color-positive)]">
                  <Users className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <h3 id="settings-group-title" className="text-sm font-bold text-[var(--color-text)]">
                    Group
                  </h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-muted)]">
                    Shared details and currency conversion rules.
                  </p>
                </div>
              </div>
              <span className="inline-flex min-h-7 shrink-0 items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-2.5 font-mono text-[10px] font-bold uppercase text-[var(--color-muted)]">
                {tripStatus}
              </span>
            </div>

            {isAdmin && isTripActive && (
              <form className="mt-4" onSubmit={handleSaveTripName}>
                <label
                  htmlFor={tripNameInputId}
                  className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]"
                >
                  Group name
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id={tripNameInputId}
                    type="text"
                    value={tripNameInput}
                    onChange={event => setTripNameInput(event.target.value)}
                    className="min-h-11 min-w-0 flex-1 rounded-2xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--color-text)] focus:border-[var(--color-positive)] focus:outline-none focus:ring-2 focus:ring-[var(--color-positive)]/20"
                    placeholder="Group name"
                    autoComplete="off"
                  />
                  <button
                    type="submit"
                    disabled={isSavingTripName || tripNameInput.trim() === trip.name}
                    className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-2xl bg-[var(--color-positive)] text-white disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label="Save group name"
                  >
                    {isSavingTripName ? (
                      <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Edit2 className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </form>
            )}

            {isAdmin && !isTripActive && (
              <p className="mt-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-3 py-3 text-xs font-semibold leading-relaxed text-[var(--color-muted)]">
                Group name and member controls are read-only while this group is {tripStatus}.
              </p>
            )}

            {!isAdmin && isApprovedMember && (
              <p className="mt-4 text-[11px] leading-relaxed text-[var(--color-muted)]">
                Group admins can rename the group and manage members while it is active.
              </p>
            )}

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {isAdmin && isTripActive && (
                <button
                  type="button"
                  id="btn-menu-admin-tools"
                  onClick={() => openDestination(onAdminTools, 'Could not open member management.')}
                  className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-3 py-3 text-left text-sm font-semibold text-[var(--color-text)] hover:border-[var(--color-positive)]/30"
                >
                  <Users className="h-4 w-4 text-[var(--color-positive)]" aria-hidden="true" />
                  Member management
                </button>
              )}

              <button
                type="button"
                id="btn-menu-exchange-rates"
                onClick={() => openDestination(onExchangeRates, 'Could not open exchange rates.')}
                disabled={!isApprovedMember}
                className={`flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-3 py-3 text-left text-sm font-semibold text-[var(--color-text)] hover:border-[var(--color-positive)]/30 disabled:cursor-not-allowed disabled:opacity-60 ${
                  isAdmin && isTripActive ? '' : 'sm:col-span-2'
                }`}
              >
                <Settings className="h-4 w-4 text-[var(--color-positive)]" aria-hidden="true" />
                {isAdmin && isTripActive ? 'Manage exchange rates' : 'View exchange rates'}
              </button>
            </div>
          </section>

          <section className="parite-card p-4 sm:p-5" aria-labelledby="settings-data-title">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-positive-soft)] text-[var(--color-positive)]">
                <Download className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <h3 id="settings-data-title" className="text-sm font-bold text-[var(--color-text)]">
                  Data
                </h3>
                <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-muted)]">
                  Download a CSV copy of the group records currently available to you.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                id="btn-export-expenses-csv"
                onClick={() => void runExport('expenses', onExportExpensesCsv)}
                disabled={exportsDisabled}
                className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-3 py-2.5 text-xs font-bold text-[var(--color-text)] hover:border-[var(--color-positive)]/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download className="h-4 w-4 text-[var(--color-positive)]" aria-hidden="true" />
                {isExporting('expenses') ? 'Exporting...' : 'Expenses CSV'}
              </button>
              <button
                type="button"
                id="btn-export-balances-csv"
                onClick={() => void runExport('balances', onExportBalancesCsv)}
                disabled={exportsDisabled}
                className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-3 py-2.5 text-xs font-bold text-[var(--color-text)] hover:border-[var(--color-positive)]/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download className="h-4 w-4 text-[var(--color-positive)]" aria-hidden="true" />
                {isExporting('balances') ? 'Exporting...' : 'Balances CSV'}
              </button>
              <button
                type="button"
                id="btn-export-settlements-csv"
                onClick={() => void runExport('settlements', onExportSettlementsCsv)}
                disabled={exportsDisabled}
                className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-3 py-2.5 text-xs font-bold text-[var(--color-text)] hover:border-[var(--color-positive)]/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download className="h-4 w-4 text-[var(--color-positive)]" aria-hidden="true" />
                {isExporting('settlements') ? 'Exporting...' : 'Settlements CSV'}
              </button>
            </div>
          </section>

            {isApprovedMember && isTripActive && (
              <section
                className="parite-card border-[var(--color-negative)]/15 p-4 sm:p-5"
                aria-labelledby="settings-membership-title"
              >
                <div className="flex items-start gap-3">
                  <UserMinus className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-negative)]" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <h3 id="settings-membership-title" className="text-xs font-bold text-[var(--color-text)]">
                      Leave this group
                    </h3>
                    <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-muted)]">
                      Your historical entries stay with the group, but you will lose access after leaving.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  id="btn-leave-trip"
                  onClick={() => void handleLeaveTrip()}
                  disabled={busyAction !== null}
                  className="mt-3 min-h-11 w-full cursor-pointer rounded-2xl border border-[var(--color-negative)]/15 bg-[var(--color-negative-soft)] px-3 py-3 text-sm font-bold text-[var(--color-negative)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyAction === 'leave' ? 'Leaving group...' : 'Leave group'}
                </button>
              </section>
            )}
            </>
          ) : (
            <section aria-label="Group closeout controls">
              <CloseoutProgressCard
                trip={trip}
                members={members}
                closureVotes={closureVotes}
                currentMember={currentMember}
                blockers={closeoutBlockers}
                idPrefix="btn-settings-closeout"
                busyAction={lifecycleBusyAction}
                onStartTripClosure={handleStartCloseout}
                onApproveTripClosure={() => runAction(
                  'approve',
                  onApproveTripClosure,
                  'Could not approve closeout.',
                )}
                onCancelTripClosure={() => runAction(
                  'cancel',
                  onCancelTripClosure,
                  'Could not cancel closeout.',
                )}
                onReviewBalances={handleReviewBalances}
              />
            </section>
          )}
        </div>
      </section>
    </div>
  );
};
