import React, { useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Download,
  Edit2,
  Gamepad2,
  KeyRound,
  LogOut,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { Currency, Member, SUPPORTED_CURRENCIES, Trip } from '../types';
import { WorkspaceSummary } from '../lib/tripRepository';
import { MemberAvatar } from './MemberAvatar';

type ExportType = 'expenses' | 'balances' | 'settlements';
type LifecycleAction = 'leave' | 'start-close' | 'approve-close' | 'cancel-close';

interface SideMenuProps {
  isOpen: boolean;
  trip: Trip;
  currentMember: Member | null;
  accountEmail: string | null;
  workspaces: WorkspaceSummary[];
  currentMemberId: string | null;
  onClose: () => void;
  onAccountSettings: () => void;
  onReplayGuidedTour: () => void;
  onSwitchWorkspace: (memberId: string) => void | Promise<void>;
  onCreateTrip: () => void;
  onJoinTrip: () => void;
  onAdminTools: () => void;
  onExchangeRates: () => void;
  onUpdateTripName: (name: string) => Promise<void>;
  onUpdateDisplayCurrency: (displayCurrency: Currency | null) => Promise<void>;
  onLeaveTrip: () => Promise<void>;
  onStartTripClosure: () => Promise<void>;
  onApproveTripClosure: () => Promise<void>;
  onCancelTripClosure: () => Promise<void>;
  onExportExpensesCsv: () => void;
  onExportBalancesCsv: () => void;
  onExportSettlementsCsv: () => void;
  exportBusy: ExportType | null;
  onActionError?: (message: string) => void;
  onLogout: () => void | Promise<void>;
}

export const SideMenu: React.FC<SideMenuProps> = ({
  isOpen,
  trip,
  currentMember,
  accountEmail,
  workspaces,
  currentMemberId,
  onClose,
  onAccountSettings,
  onReplayGuidedTour,
  onSwitchWorkspace,
  onCreateTrip,
  onJoinTrip,
  onAdminTools,
  onExchangeRates,
  onUpdateTripName,
  onUpdateDisplayCurrency,
  onLeaveTrip,
  onStartTripClosure,
  onApproveTripClosure,
  onCancelTripClosure,
  onExportExpensesCsv,
  onExportBalancesCsv,
  onExportSettlementsCsv,
  exportBusy,
  onActionError,
  onLogout,
}) => {
  const isAdmin = currentMember?.role === 'admin';
  const tripStatus = trip.status ?? 'active';
  const isTripActive = tripStatus === 'active';
  const isTripClosing = tripStatus === 'closing';
  const isTripClosed = tripStatus === 'closed';
  const isApprovedMember = currentMember?.status === 'approved';
  const [displayCurrencyInput, setDisplayCurrencyInput] = useState<Currency | ''>(currentMember?.display_currency ?? '');
  const [isSavingDisplayCurrency, setIsSavingDisplayCurrency] = useState(false);
  const [lifecycleBusyAction, setLifecycleBusyAction] = useState<LifecycleAction | null>(null);
  const [isSavingTripName, setIsSavingTripName] = useState(false);
  const [displayCurrencyError, setDisplayCurrencyError] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [tripNameInput, setTripNameInput] = useState(trip.name);
  const [isGroupsExpanded, setIsGroupsExpanded] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    setDisplayCurrencyInput(currentMember?.display_currency ?? '');
    setDisplayCurrencyError(null);
    setSettingsError(null);
    setTripNameInput(trip.name);
  }, [currentMember?.display_currency, isOpen, trip.name, trip.invite_code]);

  useEffect(() => {
    if (isOpen) setIsGroupsExpanded(false);
  }, [currentMemberId, isOpen]);

  if (!isOpen) return null;

  const getSafeMessage = (error: unknown, fallback: string) => {
    if (!(error instanceof Error) || !error.message.trim()) return fallback;

    const message = error.message.trim();
    const looksRaw = /(PGRST|SQLSTATE|violates|constraint|duplicate key|invalid input syntax|relation .* does not exist|function .* does not exist|column .* does not exist)/i.test(message);

    return looksRaw ? fallback : message;
  };

  const reportSettingsError = (message: string) => {
    setSettingsError(message);
    onActionError?.(message);
  };

  const handleSaveTripName = async () => {
    const nextName = tripNameInput.trim();

    if (!nextName) {
      reportSettingsError('Group name is required.');
      return;
    }

    setIsSavingTripName(true);
    setSettingsError(null);
    try {
      await onUpdateTripName(nextName);
    } catch (error) {
      console.error(error);
      reportSettingsError(getSafeMessage(error, 'Could not rename group.'));
    } finally {
      setIsSavingTripName(false);
    }
  };

  const handleSaveDisplayCurrency = async () => {
    setIsSavingDisplayCurrency(true);
    setDisplayCurrencyError(null);

    try {
      await onUpdateDisplayCurrency(displayCurrencyInput || null);
    } catch (error) {
      console.error(error);
      const message = getSafeMessage(error, 'Could not save display currency.');
      setDisplayCurrencyError(message);
      onActionError?.(message);
    } finally {
      setIsSavingDisplayCurrency(false);
    }
  };

  const runLifecycleAction = async (actionType: LifecycleAction, action: () => Promise<void>) => {
    setLifecycleBusyAction(actionType);
    try {
      await action();
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLifecycleBusyAction(null);
    }
  };

  const statusStyles = isTripClosed
    ? 'border-[var(--color-negative)]/20 bg-[var(--color-negative-soft)] text-[var(--color-negative)]'
    : isTripClosing
      ? 'border-amber-500/20 bg-amber-50 text-amber-700'
      : 'border-[var(--color-positive)]/20 bg-[var(--color-positive-soft)] text-[var(--color-positive)]';

  const orderedWorkspaces = [
    ...workspaces.filter(workspace => workspace.member_id === currentMemberId),
    ...workspaces.filter(workspace => workspace.member_id !== currentMemberId),
  ];
  const visibleWorkspaces = isGroupsExpanded ? orderedWorkspaces : orderedWorkspaces.slice(0, 3);
  const hiddenGroupCount = Math.max(orderedWorkspaces.length - 3, 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-start md:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-[#17211d]/45 backdrop-blur-[2px] cursor-default"
        aria-label="Close menu"
        onClick={onClose}
      />

      <aside className="relative z-10 flex h-full w-[90%] max-w-[380px] flex-col overflow-hidden rounded-r-[28px] border-r border-[var(--color-border)] bg-[var(--color-app-background)] shadow-[var(--shadow-sheet)] animate-slide-up md:w-[420px] md:max-w-[420px] md:rounded-[28px] md:border">
        <div className="app-header-safe header-wash flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-4 pb-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-positive)]">
              Current group
            </p>
            <h2 className="mt-1 truncate text-xl font-bold font-display text-[var(--color-text)]">
              {trip.name}
            </h2>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Base currency <span className="font-mono font-bold text-[var(--color-positive)]">{trip.base_currency}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/70 bg-white/80 text-[var(--color-text)] shadow-sm cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3.5 py-4">
          <section className="parite-card p-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
              Signed in as
            </p>
            <div className="flex items-center gap-3">
              <MemberAvatar member={currentMember} size="md" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[var(--color-text)]">
                  {currentMember?.display_name ?? 'No group member'}
                </p>
                <div className="mt-1 flex items-center gap-2 text-[10px] font-mono uppercase text-[var(--color-muted)]">
                  <span>{currentMember?.status ?? 'not joined'}</span>
                  {isAdmin && (
                    <span className="inline-flex items-center gap-1 text-[var(--color-positive)]">
                      <ShieldCheck className="w-3 h-3" />
                      Admin
                    </span>
                  )}
                </div>
                {accountEmail && (
                  <p className="mt-1 truncate text-[10px] text-[var(--color-muted)]">
                    {accountEmail}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              id="btn-menu-account-security"
              onClick={onAccountSettings}
              className="mt-4 flex min-h-11 w-full cursor-pointer items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-3 py-2.5 text-left text-sm font-semibold text-[var(--color-text)] hover:border-[var(--color-positive)]/30"
            >
              <span className="inline-flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-[var(--color-positive)]" />
                Account & security
              </span>
              <span className="text-[10px] font-bold text-[var(--color-positive)]">Manage</span>
            </button>
            {isApprovedMember && isTripActive && (
              <button
                type="button"
                id="btn-menu-guided-tour"
                onClick={() => {
                  onClose();
                  onReplayGuidedTour();
                }}
                className="mt-2 flex min-h-11 w-full cursor-pointer items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-3 py-2.5 text-left text-sm font-semibold text-[var(--color-text)] hover:border-[var(--color-positive)]/30"
              >
                <span className="inline-flex items-center gap-2">
                  <Gamepad2 className="h-4 w-4 text-[var(--color-positive)]" />
                  Guided tour
                </span>
                <span className="text-[10px] font-bold text-[var(--color-positive)]">Replay</span>
              </button>
            )}
          </section>

          {isApprovedMember && (
            <section className="parite-card flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                  Group status
                </p>
                <span className={`text-[10px] font-mono uppercase inline-flex rounded-full border px-2 py-1 ${statusStyles}`}>
                  {tripStatus}
                </span>
              </div>

              {isTripClosing && (
                <button
                  type="button"
                  id="btn-approve-trip-closure"
                  onClick={() => runLifecycleAction('approve-close', onApproveTripClosure)}
                  disabled={lifecycleBusyAction !== null}
                  className="w-full min-h-11 rounded-2xl bg-[var(--color-positive)] text-[#fff] px-3 py-3 font-bold text-sm cursor-pointer disabled:opacity-60"
                >
                  {lifecycleBusyAction === 'approve-close' ? 'Approving close request...' : 'Approve group closure'}
                </button>
              )}

              {isTripActive && (
                <button
                  type="button"
                  id="btn-leave-trip"
                  onClick={() => {
                    if (confirm('Leave this group? Your historical expenses will stay visible.')) {
                      runLifecycleAction('leave', onLeaveTrip);
                    }
                  }}
                  disabled={lifecycleBusyAction !== null}
                  className="w-full min-h-11 rounded-2xl border border-[var(--color-negative)]/15 bg-[var(--color-negative-soft)] text-[var(--color-negative)] px-3 py-3 font-bold text-sm cursor-pointer disabled:opacity-60"
                >
                  {lifecycleBusyAction === 'leave' ? 'Leaving group...' : 'Leave group'}
                </button>
              )}

              {isTripClosed && (
                <p className="rounded-2xl border border-[var(--color-negative)]/15 bg-[var(--color-negative-soft)] px-3 py-2 text-xs font-semibold text-[var(--color-negative)] leading-relaxed">
                  This group is closed and read-only.
                </p>
              )}
            </section>
          )}

          {isAdmin && isApprovedMember && (
            <details className="parite-card p-4" open>
              <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
                <span>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                    Admin settings
                  </span>
                  <span className="mt-1 block text-xs text-[var(--color-muted)]">
                    Group settings and lifecycle
                  </span>
                </span>
                <ShieldCheck className="h-4 w-4 text-[var(--color-positive)]" />
              </summary>

              <div className="mt-4 flex flex-col gap-4">
                {settingsError && (
                  <div className="rounded-2xl border border-[var(--color-negative)]/15 bg-[var(--color-negative-soft)] px-3 py-2 text-xs font-bold text-[var(--color-negative)]">
                    {settingsError}
                  </div>
                )}

                {isTripActive ? (
                  <div>
                      <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                        Group name
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={tripNameInput}
                          onChange={event => setTripNameInput(event.target.value)}
                          className="min-w-0 flex-1 min-h-11 rounded-2xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--color-text)] focus:border-[var(--color-positive)] focus:outline-none"
                          placeholder="Group name"
                        />
                        <button
                          type="button"
                          onClick={handleSaveTripName}
                          disabled={isSavingTripName || tripNameInput.trim() === trip.name}
                          className="w-11 h-11 rounded-2xl bg-[var(--color-positive)] text-[#fff] flex items-center justify-center cursor-pointer disabled:opacity-60"
                          aria-label="Save group name"
                        >
                          {isSavingTripName ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Edit2 className="w-4 h-4" />}
                        </button>
                      </div>
                  </div>
                ) : (
                  <p className="rounded-2xl border border-[var(--color-negative)]/15 bg-[var(--color-negative-soft)] px-3 py-2 text-xs font-semibold text-[var(--color-negative)] leading-relaxed">
                    Admin settings are read-only while this group is {tripStatus}.
                  </p>
                )}

                <div className="grid grid-cols-1 gap-2">
                  {isTripActive && (
                    <>
                      <button
                        type="button"
                        id="btn-menu-admin-tools"
                        onClick={() => {
                          onAdminTools();
                          onClose();
                        }}
                        className="w-full min-h-11 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] text-[var(--color-text)] px-3 py-3 flex items-center gap-2 font-semibold text-sm cursor-pointer hover:border-[var(--color-positive)]/30"
                      >
                        <Users className="h-4 w-4 text-[var(--color-positive)]" />
                        Member management
                      </button>

                      <button
                        type="button"
                        id="btn-start-trip-closure"
                        onClick={() => {
                          if (confirm('Start closing this group? Everyone must approve before it becomes read-only.')) {
                            runLifecycleAction('start-close', onStartTripClosure);
                          }
                        }}
                        disabled={lifecycleBusyAction !== null}
                        className="w-full min-h-11 rounded-2xl border border-[var(--color-negative)]/15 bg-[var(--color-negative-soft)] text-[var(--color-negative)] px-3 py-3 font-bold text-sm cursor-pointer disabled:opacity-60"
                      >
                        {lifecycleBusyAction === 'start-close' ? 'Starting close request...' : 'Start close request'}
                      </button>
                    </>
                  )}

                  {isTripClosing && (
                    <button
                      type="button"
                      id="btn-cancel-trip-closure"
                      onClick={() => runLifecycleAction('cancel-close', onCancelTripClosure)}
                      disabled={lifecycleBusyAction !== null}
                      className="w-full min-h-11 rounded-2xl border border-[var(--color-negative)]/15 bg-[var(--color-negative-soft)] text-[var(--color-negative)] px-3 py-3 font-bold text-sm cursor-pointer disabled:opacity-60"
                    >
                      {lifecycleBusyAction === 'cancel-close' ? 'Cancelling close request...' : 'Cancel close request'}
                    </button>
                  )}
                </div>
              </div>
            </details>
          )}

          <section className="parite-card p-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
              General
            </p>
            {isApprovedMember && (
              <button
                type="button"
                id="btn-menu-exchange-rates"
                onClick={() => {
                  onExchangeRates();
                  onClose();
                }}
                className="w-full min-h-11 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] text-[var(--color-text)] px-3 py-3 flex items-center gap-2 font-semibold text-sm cursor-pointer hover:border-[var(--color-positive)]/30"
              >
                <Settings className="h-4 w-4 text-[var(--color-positive)]" />
                Exchange rates
              </button>
            )}

            <div className={isApprovedMember ? 'mt-4 border-t border-[var(--color-border)] pt-4' : ''}>
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                Display currency
              </label>
              <select
                value={displayCurrencyInput}
                onChange={event => setDisplayCurrencyInput(event.target.value as Currency | '')}
                disabled={!currentMember || isSavingDisplayCurrency}
                className="w-full min-h-11 rounded-2xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--color-text)] focus:border-[var(--color-positive)] focus:outline-none disabled:opacity-60"
              >
                <option value="">Same as group base currency</option>
                {SUPPORTED_CURRENCIES.map(currency => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-[11px] leading-relaxed text-[var(--color-muted)]">
                Only changes how amounts are shown to you. Group accounting stays in {trip.base_currency}.
              </p>
              {displayCurrencyError && (
                <p className="text-[11px] text-[var(--color-negative)] mt-2 leading-relaxed">
                  {displayCurrencyError}
                </p>
              )}
              <button
                type="button"
                onClick={handleSaveDisplayCurrency}
                disabled={!currentMember || isSavingDisplayCurrency || displayCurrencyInput === (currentMember?.display_currency ?? '')}
                className="mt-3 w-full min-h-10 rounded-2xl bg-[var(--color-positive)] text-[#fff] px-3 py-2 font-bold text-xs cursor-pointer disabled:opacity-60"
              >
                {isSavingDisplayCurrency ? 'Saving...' : 'Save display currency'}
              </button>
            </div>
          </section>

          <section className="parite-card p-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
              Groups
            </p>

            <div id="side-menu-group-list" className="flex flex-col gap-2">
              {visibleWorkspaces.map(workspace => {
                const isActive = workspace.member_id === currentMemberId;
                return (
                  <button
                    type="button"
                    key={workspace.member_id}
                    onClick={() => {
                      if (!isActive) {
                        onSwitchWorkspace(workspace.member_id);
                      }
                      onClose();
                    }}
                    className={`w-full rounded-2xl border px-3 py-3 text-left cursor-pointer ${
                      isActive
                        ? 'border-[var(--color-positive)]/25 bg-[var(--color-positive-soft)]'
                        : 'border-[var(--color-border)] bg-[var(--color-surface-soft)] hover:border-[var(--color-positive)]/25'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-[var(--color-text)]">
                          {workspace.trip_name}
                        </span>
                        <span className="mt-1 block truncate text-[10px] text-[var(--color-muted)]">
                          {workspace.display_name} - {workspace.role}
                        </span>
                      </span>
                      <span className="text-right shrink-0">
                        <span className="block text-[10px] font-mono font-bold text-[var(--color-positive)]">
                          {workspace.base_currency}
                        </span>
                        <span className="mt-1 block text-[9px] uppercase text-[var(--color-muted)]">
                          {workspace.trip_status && workspace.trip_status !== 'active'
                            ? workspace.trip_status
                            : workspace.status}
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {hiddenGroupCount > 0 && (
              <button
                type="button"
                id="btn-menu-toggle-groups"
                aria-expanded={isGroupsExpanded}
                aria-controls="side-menu-group-list"
                onClick={() => setIsGroupsExpanded(current => !current)}
                className="mt-2 flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl text-xs font-bold text-[var(--color-positive)] hover:bg-[var(--color-positive-soft)]"
              >
                {isGroupsExpanded ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Show fewer groups
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Show {hiddenGroupCount} more {hiddenGroupCount === 1 ? 'group' : 'groups'}
                  </>
                )}
              </button>
            )}

            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[var(--color-border)] pt-3">
              <button
                type="button"
                id="btn-menu-create-trip"
                onClick={() => {
                  onCreateTrip();
                  onClose();
                }}
                className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-2 py-2.5 text-xs font-bold text-[var(--color-text)] hover:border-[var(--color-positive)]/30"
              >
                <Plus className="h-4 w-4 shrink-0 text-[var(--color-positive)]" />
                Create group
              </button>

              <button
                type="button"
                id="btn-menu-join-trip"
                onClick={() => {
                  onJoinTrip();
                  onClose();
                }}
                className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-2 py-2.5 text-xs font-bold text-[var(--color-text)] hover:border-[var(--color-positive)]/30"
              >
                <UserPlus className="h-4 w-4 shrink-0 text-[var(--color-positive)]" />
                Join group
              </button>
            </div>
          </section>

          <section className="flex flex-col gap-2">
            {isApprovedMember && (
              <section className="parite-card p-4">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                  Export
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    id="btn-export-expenses-csv"
                    onClick={onExportExpensesCsv}
                    disabled={exportBusy !== null}
                    className="w-full min-h-11 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] text-[var(--color-text)] px-3 py-3 flex items-center gap-2 font-semibold text-sm cursor-pointer hover:border-[var(--color-positive)]/30 disabled:opacity-60"
                  >
                    <Download className="h-4 w-4 text-[var(--color-positive)]" />
                    {exportBusy === 'expenses' ? 'Exporting expenses...' : 'Export expenses CSV'}
                  </button>
                  <button
                    type="button"
                    id="btn-export-balances-csv"
                    onClick={onExportBalancesCsv}
                    disabled={exportBusy !== null}
                    className="w-full min-h-11 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] text-[var(--color-text)] px-3 py-3 flex items-center gap-2 font-semibold text-sm cursor-pointer hover:border-[var(--color-positive)]/30 disabled:opacity-60"
                  >
                    <Download className="h-4 w-4 text-[var(--color-positive)]" />
                    {exportBusy === 'balances' ? 'Exporting balances...' : 'Export balances CSV'}
                  </button>
                  <button
                    type="button"
                    id="btn-export-settlements-csv"
                    onClick={onExportSettlementsCsv}
                    disabled={exportBusy !== null}
                    className="w-full min-h-11 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] text-[var(--color-text)] px-3 py-3 flex items-center gap-2 font-semibold text-sm cursor-pointer hover:border-[var(--color-positive)]/30 disabled:opacity-60"
                  >
                    <Download className="h-4 w-4 text-[var(--color-positive)]" />
                    {exportBusy === 'settlements' ? 'Exporting settlements...' : 'Export settlements CSV'}
                  </button>
                </div>
              </section>
            )}

            <button
              type="button"
              id="btn-app-logout"
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="w-full min-h-11 rounded-2xl border border-[var(--color-negative)]/15 bg-[var(--color-negative-soft)] text-[var(--color-negative)] px-3 py-3 flex items-center gap-2 font-semibold text-sm cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </section>
        </div>
      </aside>
    </div>
  );
};
