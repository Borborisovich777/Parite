import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Copy,
  LogOut,
  Settings,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { Currency, Member, Trip } from '../types';

const CURRENCIES: Currency[] = ['AED', 'CNY', 'KZT'];

interface SideMenuProps {
  isOpen: boolean;
  trip: Trip;
  currentMember: Member | null;
  accountEmail: string | null;
  onClose: () => void;
  onLeaveTrip: () => void;
  onAdminTools: () => void;
  onExchangeRates: () => void;
  onUpdateDisplayCurrency: (displayCurrency: Currency | null) => Promise<void>;
  onLogout: () => void | Promise<void>;
}

export const SideMenu: React.FC<SideMenuProps> = ({
  isOpen,
  trip,
  currentMember,
  accountEmail,
  onClose,
  onLeaveTrip,
  onAdminTools,
  onExchangeRates,
  onUpdateDisplayCurrency,
  onLogout,
}) => {
  const isAdmin = currentMember?.role === 'admin';
  const [displayCurrencyInput, setDisplayCurrencyInput] = useState<Currency | ''>(currentMember?.display_currency ?? '');
  const [isSavingDisplayCurrency, setIsSavingDisplayCurrency] = useState(false);
  const [displayCurrencyError, setDisplayCurrencyError] = useState<string | null>(null);

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
  }, [currentMember?.display_currency, isOpen]);

  if (!isOpen) return null;

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
    copyText(trip.invite_code).catch(error => console.error(error));
  };

  const handleSaveDisplayCurrency = async () => {
    setIsSavingDisplayCurrency(true);
    setDisplayCurrencyError(null);

    try {
      await onUpdateDisplayCurrency(displayCurrencyInput || null);
    } catch (error) {
      console.error(error);
      setDisplayCurrencyError(error instanceof Error ? error.message : 'Could not save display currency.');
    } finally {
      setIsSavingDisplayCurrency(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex max-w-md mx-auto">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/75 backdrop-blur-[2px] cursor-default"
        aria-label="Close menu"
        onClick={onClose}
      />

      <aside className="relative z-10 h-full w-[82%] max-w-[340px] bg-[#121418] border-r border-slate-800 shadow-2xl flex flex-col animate-slide-up">
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

          <section>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                Invite code
              </p>
              <button
                type="button"
                onClick={handleCopyInvite}
                className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-300 hover:text-indigo-200 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy
              </button>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-[#1a1d23] px-4 py-3 font-mono text-lg font-bold tracking-widest text-white">
              {trip.invite_code}
            </div>
          </section>

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

          <section className="flex flex-col gap-2">
            {isAdmin && currentMember?.status === 'approved' && (
              <>
                <button
                  type="button"
                  id="btn-menu-admin-tools"
                  onClick={() => {
                    onAdminTools();
                    onClose();
                  }}
                  className="w-full min-h-11 rounded-2xl bg-[#1a1d23] border border-slate-800 text-slate-200 px-3 py-3 flex items-center gap-2 font-semibold text-sm cursor-pointer hover:border-indigo-500/40"
                >
                  <Users className="w-4 h-4 text-indigo-300" />
                  Admin tools
                </button>

                <button
                  type="button"
                  id="btn-menu-exchange-rates"
                  onClick={() => {
                    onExchangeRates();
                    onClose();
                  }}
                  className="w-full min-h-11 rounded-2xl bg-[#1a1d23] border border-slate-800 text-slate-200 px-3 py-3 flex items-center gap-2 font-semibold text-sm cursor-pointer hover:border-indigo-500/40"
                >
                  <Settings className="w-4 h-4 text-indigo-300" />
                  Exchange rates
                </button>
              </>
            )}

            <button
              type="button"
              id="btn-app-leave-trip"
              onClick={() => {
                onLeaveTrip();
                onClose();
              }}
              className="w-full min-h-11 rounded-2xl bg-[var(--color-negative)] text-slate-950 px-3 py-3 flex items-center gap-2 font-bold text-sm cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Exit workspace
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
