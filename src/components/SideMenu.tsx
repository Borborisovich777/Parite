import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  Edit2,
  LogOut,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { Currency, Member, Trip } from '../types';
import { WorkspaceSummary } from '../lib/tripRepository';

const CURRENCIES: Currency[] = ['AED', 'CNY', 'KZT'];
type ExportType = 'expenses' | 'balances' | 'settlements';
type LifecycleAction = 'leave' | 'start-close' | 'approve-close' | 'cancel-close';

interface SideMenuProps {
  isOpen: boolean;
  trip: Trip;
  currentMember: Member | null;
  accountEmail: string | null;
  workspaces: WorkspaceSummary[];
  currentMemberId: string | null;
  pendingRequestsCount: number;
  onClose: () => void;
  onSwitchWorkspace: (memberId: string) => void | Promise<void>;
  onShowTripSelection: () => void;
  onCreateTrip: () => void;
  onJoinTrip: () => void;
  onAdminTools: () => void;
  onPendingRequests: () => void;
  onExchangeRates: () => void;
  onRegenerateInviteCode: () => Promise<void>;
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
  pendingRequestsCount,
  onClose,
  onSwitchWorkspace,
  onShowTripSelection,
  onCreateTrip,
  onJoinTrip,
  onAdminTools,
  onPendingRequests,
  onExchangeRates,
  onRegenerateInviteCode,
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
  const [isRegeneratingInvite, setIsRegeneratingInvite] = useState(false);
  const [isSavingTripName, setIsSavingTripName] = useState(false);
  const [displayCurrencyError, setDisplayCurrencyError] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [tripNameInput, setTripNameInput] = useState(trip.name);
  const [copiedInvite, setCopiedInvite] = useState(false);

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
    setCopiedInvite(false);
  }, [currentMember?.display_currency, isOpen, trip.name, trip.invite_code]);

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

  const copyText = async (text: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      document.execCommand('copy');
    } finally {
      document.body.removeChild(textArea);
    }
  };

  const handleCopyInvite = () => {
    copyText(trip.invite_code)
      .then(() => {
        setCopiedInvite(true);
        window.setTimeout(() => setCopiedInvite(false), 1800);
      })
      .catch(error => {
        console.error(error);
        reportSettingsError('Could not copy invite code.');
      });
  };

  const handleSaveTripName = async () => {
    const nextName = tripNameInput.trim();

    if (!nextName) {
      reportSettingsError('Trip name is required.');
      return;
    }

    setIsSavingTripName(true);
    setSettingsError(null);
    try {
      await onUpdateTripName(nextName);
    } catch (error) {
      console.error(error);
      reportSettingsError(getSafeMessage(error, 'Could not rename trip.'));
    } finally {
      setIsSavingTripName(false);
    }
  };

  const handleRegenerateInvite = async () => {
    if (!confirm('Regenerate this invite code? The old code will stop working.')) return;

    setIsRegeneratingInvite(true);
    setSettingsError(null);
    try {
      await onRegenerateInviteCode();
      setCopiedInvite(false);
    } catch (error) {
      console.error(error);
      reportSettingsError(getSafeMessage(error, 'Could not regenerate invite code.'));
    } finally {
      setIsRegeneratingInvite(false);
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
    ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
    : isTripClosing
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
      : 'border-[var(--color-positive)]/30 bg-[var(--color-positive)]/10 text-[var(--color-positive)]';

  return (
    <div className="fixed inset-0 z-50 flex max-w-md mx-auto">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/75 backdrop-blur-[2px] cursor-default"
        aria-label="Close menu"
        onClick={onClose}
      />

      <aside className="relative z-10 h-full w-[84%] max-w-[350px] bg-[#121418] border-r border-slate-800 shadow-2xl flex flex-col animate-slide-up">
        <div className="px-4 py-4 border-b border-slate-800/80 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider font-mono text-slate-500">
              Current trip
            </p>
            <h2 className="text-lg font-bold text-white font-display truncate mt-1">
              {trip.name}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Base currency: <span className="font-mono text-indigo-300">{trip.base_currency}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-[#1a1d23] border border-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 flex flex-col gap-5">
          <section className="rounded-2xl bg-[#1a1d23] border border-slate-800 p-4">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-3">
              Signed in as
            </p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-500/15 border border-indigo-500/25 text-indigo-200 flex items-center justify-center font-bold uppercase">
                {currentMember ? currentMember.display_name.charAt(0) : '?'}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-100 truncate">
                  {currentMember?.display_name ?? 'No trip member'}
                </p>
                <div className="flex items-center gap-2 mt-1 text-[10px] uppercase font-mono text-slate-500">
                  <span>{currentMember?.status ?? 'not joined'}</span>
                  {isAdmin && (
                    <span className="inline-flex items-center gap-1 text-emerald-400">
                      <ShieldCheck className="w-3 h-3" />
                      Admin
                    </span>
                  )}
                </div>
                {accountEmail && (
                  <p className="text-[10px] text-slate-500 mt-1 truncate">
                    {accountEmail}
                  </p>
                )}
              </div>
            </div>
          </section>

          {isApprovedMember && (
            <section className="rounded-2xl bg-[#1a1d23] border border-slate-800 p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                  Trip status
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
                  className="w-full min-h-11 rounded-2xl bg-[var(--color-positive)] text-slate-950 px-3 py-3 font-bold text-sm cursor-pointer disabled:opacity-60"
                >
                  {lifecycleBusyAction === 'approve-close' ? 'Approving close request...' : 'Approve close trip'}
                </button>
              )}

              {isTripActive && (
                <button
                  type="button"
                  id="btn-leave-trip"
                  onClick={() => {
                    if (confirm('Leave this trip? Your historical expenses will stay visible.')) {
                      runLifecycleAction('leave', onLeaveTrip);
                    }
                  }}
                  disabled={lifecycleBusyAction !== null}
                  className="w-full min-h-11 rounded-2xl bg-[var(--color-negative)] text-slate-950 px-3 py-3 font-bold text-sm cursor-pointer disabled:opacity-60"
                >
                  {lifecycleBusyAction === 'leave' ? 'Leaving trip...' : 'Leave trip'}
                </button>
              )}

              {isTripClosed && (
                <p className="rounded-2xl border border-[#e07a5f] bg-[#e07a5f] px-3 py-2 text-xs font-semibold text-[#3d405b] leading-relaxed">
                  This trip is closed and read-only.
                </p>
              )}
            </section>
          )}

          {isAdmin && isApprovedMember && (
            <details className="rounded-2xl bg-[#1a1d23] border border-slate-800 p-4" open>
              <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
                <span>
                  <span className="block text-[10px] uppercase tracking-wider font-bold text-slate-500">
                    Admin settings
                  </span>
                  <span className="block text-xs text-slate-400 mt-1">
                    Invite, members, rates, and lifecycle
                  </span>
                </span>
                <ShieldCheck className="w-4 h-4 text-indigo-300" />
              </summary>

              <div className="mt-4 flex flex-col gap-4">
                {settingsError && (
                  <div className="rounded-2xl border border-[#e07a5f] bg-[#e07a5f] px-3 py-2 text-xs font-bold text-[#3d405b]">
                    {settingsError}
                  </div>
                )}

                {isTripActive ? (
                  <>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2">
                        Trip name
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={tripNameInput}
                          onChange={event => setTripNameInput(event.target.value)}
                          className="min-w-0 flex-1 min-h-11 rounded-2xl bg-[#121418] border border-slate-800 text-slate-100 px-3 py-2 text-sm font-semibold focus:border-[var(--color-positive)] focus:outline-none"
                          placeholder="Trip name"
                        />
                        <button
                          type="button"
                          onClick={handleSaveTripName}
                          disabled={isSavingTripName || tripNameInput.trim() === trip.name}
                          className="w-11 h-11 rounded-2xl bg-[var(--color-positive)] text-slate-950 flex items-center justify-center cursor-pointer disabled:opacity-60"
                          aria-label="Save trip name"
                        >
                          {isSavingTripName ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Edit2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                          Invite code
                        </p>
                        {copiedInvite && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                            <Check className="w-3.5 h-3.5" />
                            Copied
                          </span>
                        )}
                      </div>
                      <div className="rounded-2xl border border-slate-800 bg-[#121418] px-4 py-3 font-mono text-lg font-bold tracking-widest text-white">
                        {trip.invite_code}
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <button
                          type="button"
                          onClick={handleCopyInvite}
                          className="min-h-10 rounded-2xl bg-[#121418] border border-slate-800 text-slate-200 px-3 py-2 flex items-center justify-center gap-2 font-bold text-xs cursor-pointer"
                        >
                          <Copy className="w-4 h-4" />
                          Copy
                        </button>
                        <button
                          type="button"
                          onClick={handleRegenerateInvite}
                          disabled={isRegeneratingInvite}
                          className="min-h-10 rounded-2xl bg-[var(--color-negative)] text-slate-950 px-3 py-2 flex items-center justify-center gap-2 font-bold text-xs cursor-pointer disabled:opacity-60"
                        >
                          <RefreshCw className={`w-4 h-4 ${isRegeneratingInvite ? 'animate-spin' : ''}`} />
                          Regenerate
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="rounded-2xl border border-[#e07a5f] bg-[#e07a5f] px-3 py-2 text-xs font-semibold text-[#3d405b] leading-relaxed">
                    Admin settings are read-only while this trip is {tripStatus}.
                  </p>
                )}

                <div className="grid grid-cols-1 gap-2">
                  {isTripActive && (
                    <>
                      <button
                        type="button"
                        id="btn-menu-pending-requests"
                        onClick={() => {
                          onPendingRequests();
                          onClose();
                        }}
                        className="w-full min-h-11 rounded-2xl bg-[#121418] border border-slate-800 text-slate-200 px-3 py-3 flex items-center justify-between gap-2 font-semibold text-sm cursor-pointer hover:border-indigo-500/40"
                      >
                        <span className="inline-flex items-center gap-2">
                          <UserPlus className="w-4 h-4 text-indigo-300" />
                          Pending requests
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          {pendingRequestsCount}
                        </span>
                      </button>

                      <button
                        type="button"
                        id="btn-menu-admin-tools"
                        onClick={() => {
                          onAdminTools();
                          onClose();
                        }}
                        className="w-full min-h-11 rounded-2xl bg-[#121418] border border-slate-800 text-slate-200 px-3 py-3 flex items-center gap-2 font-semibold text-sm cursor-pointer hover:border-indigo-500/40"
                      >
                        <Users className="w-4 h-4 text-indigo-300" />
                        Member management
                      </button>

                      <button
                        type="button"
                        id="btn-menu-exchange-rates"
                        onClick={() => {
                          onExchangeRates();
                          onClose();
                        }}
                        className="w-full min-h-11 rounded-2xl bg-[#121418] border border-slate-800 text-slate-200 px-3 py-3 flex items-center gap-2 font-semibold text-sm cursor-pointer hover:border-indigo-500/40"
                      >
                        <Settings className="w-4 h-4 text-indigo-300" />
                        Exchange rates
                      </button>

                      <button
                        type="button"
                        id="btn-start-trip-closure"
                        onClick={() => {
                          if (confirm('Start closing this trip? Everyone must approve before it becomes read-only.')) {
                            runLifecycleAction('start-close', onStartTripClosure);
                          }
                        }}
                        disabled={lifecycleBusyAction !== null}
                        className="w-full min-h-11 rounded-2xl bg-[var(--color-negative)] text-slate-950 px-3 py-3 font-bold text-sm cursor-pointer disabled:opacity-60"
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
                      className="w-full min-h-11 rounded-2xl bg-[var(--color-negative)] text-slate-950 px-3 py-3 font-bold text-sm cursor-pointer disabled:opacity-60"
                    >
                      {lifecycleBusyAction === 'cancel-close' ? 'Cancelling close request...' : 'Cancel close request'}
                    </button>
                  )}
                </div>
              </div>
            </details>
          )}

          <section className="rounded-2xl bg-[#1a1d23] border border-slate-800 p-4">
            <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2">
              Display currency
            </label>
            <select
              value={displayCurrencyInput}
              onChange={event => setDisplayCurrencyInput(event.target.value as Currency | '')}
              disabled={!currentMember || isSavingDisplayCurrency}
              className="w-full min-h-11 rounded-2xl bg-[#121418] border border-slate-800 text-slate-100 px-3 py-2 text-sm font-semibold focus:border-[var(--color-positive)] focus:outline-none disabled:opacity-60"
            >
              <option value="">Same as trip base currency</option>
              {CURRENCIES.map(currency => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
              Only changes how amounts are shown to you. Trip accounting stays in {trip.base_currency}.
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
              className="mt-3 w-full min-h-10 rounded-2xl bg-[var(--color-positive)] text-slate-950 px-3 py-2 font-bold text-xs cursor-pointer disabled:opacity-60"
            >
              {isSavingDisplayCurrency ? 'Saving...' : 'Save display currency'}
            </button>
          </section>

          {isApprovedMember && (
            <section className="rounded-2xl bg-[#1a1d23] border border-slate-800 p-4">
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-3">
                Export
              </p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  id="btn-export-expenses-csv"
                  onClick={onExportExpensesCsv}
                  disabled={exportBusy !== null}
                  className="w-full min-h-11 rounded-2xl bg-[#121418] border border-slate-800 text-slate-200 px-3 py-3 flex items-center gap-2 font-semibold text-sm cursor-pointer hover:border-indigo-500/40 disabled:opacity-60"
                >
                  <Download className="w-4 h-4 text-indigo-300" />
                  {exportBusy === 'expenses' ? 'Exporting expenses...' : 'Export expenses CSV'}
                </button>
                <button
                  type="button"
                  id="btn-export-balances-csv"
                  onClick={onExportBalancesCsv}
                  disabled={exportBusy !== null}
                  className="w-full min-h-11 rounded-2xl bg-[#121418] border border-slate-800 text-slate-200 px-3 py-3 flex items-center gap-2 font-semibold text-sm cursor-pointer hover:border-indigo-500/40 disabled:opacity-60"
                >
                  <Download className="w-4 h-4 text-indigo-300" />
                  {exportBusy === 'balances' ? 'Exporting balances...' : 'Export balances CSV'}
                </button>
                <button
                  type="button"
                  id="btn-export-settlements-csv"
                  onClick={onExportSettlementsCsv}
                  disabled={exportBusy !== null}
                  className="w-full min-h-11 rounded-2xl bg-[#121418] border border-slate-800 text-slate-200 px-3 py-3 flex items-center gap-2 font-semibold text-sm cursor-pointer hover:border-indigo-500/40 disabled:opacity-60"
                >
                  <Download className="w-4 h-4 text-indigo-300" />
                  {exportBusy === 'settlements' ? 'Exporting settlements...' : 'Export settlements CSV'}
                </button>
              </div>
            </section>
          )}

          <section className="rounded-2xl bg-[#1a1d23] border border-slate-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                Trips
              </p>
              <button
                type="button"
                onClick={() => {
                  onShowTripSelection();
                  onClose();
                }}
                className="text-[10px] font-bold text-indigo-300 hover:text-indigo-200 cursor-pointer"
              >
                Switch trip
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {workspaces.map(workspace => {
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
                        ? 'bg-indigo-500/10 border-indigo-500/35'
                        : 'bg-[#121418] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="text-sm font-bold text-slate-100 truncate block">
                          {workspace.trip_name}
                        </span>
                        <span className="text-[10px] text-slate-500 mt-1 block truncate">
                          {workspace.display_name} - {workspace.role}
                        </span>
                      </span>
                      <span className="text-right shrink-0">
                        <span className="text-[10px] font-mono font-bold text-indigo-300 block">
                          {workspace.base_currency}
                        </span>
                        <span className="text-[9px] uppercase text-slate-500 block mt-1">
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
          </section>

          <section className="flex flex-col gap-2">
            <button
              type="button"
              id="btn-menu-create-trip"
              onClick={() => {
                onCreateTrip();
                onClose();
              }}
              className="w-full min-h-11 rounded-2xl bg-[#1a1d23] border border-slate-800 text-slate-200 px-3 py-3 flex items-center gap-2 font-semibold text-sm cursor-pointer hover:border-indigo-500/40"
            >
              <Plus className="w-4 h-4 text-indigo-300" />
              Create trip
            </button>

            <button
              type="button"
              id="btn-menu-join-trip"
              onClick={() => {
                onJoinTrip();
                onClose();
              }}
              className="w-full min-h-11 rounded-2xl bg-[#1a1d23] border border-slate-800 text-slate-200 px-3 py-3 flex items-center gap-2 font-semibold text-sm cursor-pointer hover:border-indigo-500/40"
            >
              <UserPlus className="w-4 h-4 text-indigo-300" />
              Join trip
            </button>

            <button
              type="button"
              id="btn-app-switch-trip"
              onClick={() => {
                onShowTripSelection();
                onClose();
              }}
              className="w-full min-h-11 rounded-2xl bg-[#1a1d23] border border-slate-800 text-slate-200 px-3 py-3 flex items-center gap-2 font-semibold text-sm cursor-pointer hover:border-indigo-500/40"
            >
              <ArrowLeft className="w-4 h-4 text-indigo-300" />
              Switch trip
            </button>

            <button
              type="button"
              id="btn-app-logout"
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="w-full min-h-11 rounded-2xl bg-[#1a1d23] border border-slate-800 text-slate-200 px-3 py-3 flex items-center gap-2 font-semibold text-sm cursor-pointer hover:border-indigo-500/40"
            >
              <LogOut className="w-4 h-4 text-indigo-300" />
              Log out
            </button>
          </section>
        </div>
      </aside>
    </div>
  );
};
