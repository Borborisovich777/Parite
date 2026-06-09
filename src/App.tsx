import React, { useCallback, useEffect, useState } from 'react';
import { BottomNav, TabType } from './components/BottomNav';
import { DashboardTab } from './components/DashboardTab';
import { ExpensesTab } from './components/ExpensesTab';
import { BalancesTab } from './components/BalancesTab';
import { MembersTab } from './components/MembersTab';
import { AppHeader } from './components/AppHeader';
import { SideMenu } from './components/SideMenu';
import { ExchangeRatesSheet } from './components/ExchangeRatesSheet';
import { Currency, Settlement } from './types';
import { User } from '@supabase/supabase-js';
import {
  isSupabaseConfigured,
  signInWithEmail,
  signOut,
  signUpWithEmail,
  supabase,
} from './lib/supabase';
import {
  approveMember,
  claimLegacyMember,
  createExpenseWithSplits,
  createTripWithAdmin,
  deleteExpense,
  loadAuthWorkspace,
  PhaseOneWorkspace,
  rejectMember,
  removeMember,
  requestJoinByInvite,
  updateExchangeRate,
  updateExpenseWithSplits,
  updateMemberDisplayCurrency,
} from './lib/tripRepository';
import {
  AlertOctagon,
  ArrowLeft,
  Clock,
  Compass,
  Plus,
  UserPlus,
  X,
} from 'lucide-react';

const MEMBER_ACCESS_TOKEN_KEY = 'tripbalance_member_access_token';
const ACTIVE_MEMBER_ID_KEY = 'tripbalance_active_member_id';

export default function App() {
  const [workspace, setWorkspace] = useState<PhaseOneWorkspace | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);
  const [isExchangeRatesOpen, setIsExchangeRatesOpen] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);

  const [inviteInput, setInviteInput] = useState('');
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  const [isCreatingTripView, setIsCreatingTripView] = useState(false);
  const [newTripName, setNewTripName] = useState('');
  const [newTripAdminName, setNewTripAdminName] = useState('');
  const [newTripBaseCurrency, setNewTripBaseCurrency] = useState<Currency>('CNY');
  const [createTripError, setCreateTripError] = useState<string | null>(null);

  const [selectedExpenseIdForDetail, setSelectedExpenseIdForDetail] = useState<string | null>(null);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [localSettlementTripId, setLocalSettlementTripId] = useState<string | null>(null);
  const [localSettlements, setLocalSettlements] = useState<Settlement[]>([]);

  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const activeTrip = workspace?.trip ?? null;
  const currentMember = workspace?.currentMember ?? null;
  const tripMembers = workspace?.members ?? [];
  const tripExpenses = workspace?.expenses ?? [];
  const tripSplits = workspace?.splits ?? [];
  const tripExchangeRates = workspace?.exchangeRates ?? [];
  const isApprovedWorkspace = Boolean(activeTrip && currentMember?.status === 'approved');

  useEffect(() => {
    const nextTripId = activeTrip?.id ?? null;
    if (nextTripId === localSettlementTripId) return;

    const previousTripId = localSettlementTripId;
    setLocalSettlementTripId(nextTripId);
    setLocalSettlements([]);

    if (previousTripId !== null && nextTripId !== previousTripId) {
      setSelectedExpenseIdForDetail(null);
      setIsAddingExpense(false);
    }
  }, [activeTrip?.id, localSettlementTripId]);

  const clearAccessToken = () => {
    localStorage.removeItem(MEMBER_ACCESS_TOKEN_KEY);
  };

  const saveActiveMemberId = (memberId: string | undefined) => {
    if (memberId) {
      localStorage.setItem(ACTIVE_MEMBER_ID_KEY, memberId);
    }
  };

  const clearActiveMemberId = () => {
    localStorage.removeItem(ACTIVE_MEMBER_ID_KEY);
  };

  const applyWorkspace = (nextWorkspace: PhaseOneWorkspace) => {
    setWorkspace(nextWorkspace);
    saveActiveMemberId(nextWorkspace.currentMember?.id);
    setAppError(null);
  };

  const loadAuthenticatedWorkspace = useCallback(async (
    memberIdOverride?: string | null,
    options: { setLoading?: boolean } = {}
  ): Promise<PhaseOneWorkspace | null> => {
    if (options.setLoading) {
      setIsWorkspaceLoading(true);
    }

    try {
      const memberId = memberIdOverride ?? localStorage.getItem(ACTIVE_MEMBER_ID_KEY);
      const nextWorkspace = await loadAuthWorkspace(memberId);
      applyWorkspace(nextWorkspace);
      return nextWorkspace;
    } catch (error) {
      console.error(error);
      setWorkspace(null);
      setAppError(error instanceof Error ? error.message : 'Could not load your trip access.');
      return null;
    } finally {
      if (options.setLoading) {
        setIsWorkspaceLoading(false);
      }
    }
  }, []);

  const claimLegacyAccessIfPresent = useCallback(async (): Promise<PhaseOneWorkspace | null> => {
    const legacyAccessToken = localStorage.getItem(MEMBER_ACCESS_TOKEN_KEY);
    if (!legacyAccessToken) return null;

    try {
      const nextWorkspace = await claimLegacyMember(legacyAccessToken);
      applyWorkspace(nextWorkspace);
      clearAccessToken();
      return nextWorkspace;
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message.includes('Legacy member not found')) {
        clearAccessToken();
      }
      return null;
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteParam = params.get('invite');
    if (inviteParam) {
      setInviteInput(inviteParam.toUpperCase());
      setIsCreatingTripView(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!isSupabaseConfigured) {
        setIsBootstrapping(false);
        return;
      }

      if (!supabase) {
        setIsBootstrapping(false);
        return;
      }

      setIsBootstrapping(true);
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (cancelled) return;
        setAuthUser(data.session?.user ?? null);
        setAppError(null);
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setWorkspace(null);
          setAppError(error instanceof Error ? error.message : 'Could not restore your trip access.');
        }
      } finally {
        if (!cancelled) {
          setIsBootstrapping(false);
        }
      }
    }

    bootstrap();

    const { data: authListener } = supabase?.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
    }) ?? { data: { subscription: null } };

    return () => {
      cancelled = true;
      authListener.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isBootstrapping) return;

    if (!authUser) {
      setWorkspace(null);
      clearActiveMemberId();
      return;
    }

    let cancelled = false;

    async function restoreAccountWorkspace() {
      const claimedWorkspace = await claimLegacyAccessIfPresent();
      if (cancelled || claimedWorkspace) return;
      await loadAuthenticatedWorkspace(null, { setLoading: true });
    }

    restoreAccountWorkspace();

    return () => {
      cancelled = true;
    };
  }, [authUser, isBootstrapping, claimLegacyAccessIfPresent, loadAuthenticatedWorkspace]);

  const handleAuthSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthError(null);
    setAuthMessage(null);

    if (!authEmail.trim()) {
      setAuthError('Email is required');
      return;
    }

    if (authPassword.length < 6) {
      setAuthError('Password must be at least 6 characters');
      return;
    }

    setIsAuthSubmitting(true);
    try {
      const user = authMode === 'signup'
        ? await signUpWithEmail(authEmail.trim(), authPassword)
        : await signInWithEmail(authEmail.trim(), authPassword);

      if (user) {
        setAuthUser(user);
        setAuthPassword('');
        setAuthMessage(null);
      } else {
        setAuthMessage('Check your email to confirm your account, then log in.');
      }
    } catch (error) {
      console.error(error);
      setAuthError(error instanceof Error ? error.message : 'Authentication failed.');
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    setActionError(null);
    try {
      await signOut();
      setAuthUser(null);
      setWorkspace(null);
      setIsSideMenuOpen(false);
      clearActiveMemberId();
      setActiveTab('dashboard');
    } catch (error) {
      console.error(error);
      setActionError(error instanceof Error ? error.message : 'Could not log out.');
    }
  };

  const handleCreateTripSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreateTripError(null);
    setActionError(null);

    if (!newTripName.trim()) {
      setCreateTripError('Trip name is required');
      return;
    }
    if (!newTripAdminName.trim()) {
      setCreateTripError('Admin display name is required');
      return;
    }

    try {
      const nextWorkspace = await createTripWithAdmin(
        newTripName.trim(),
        newTripBaseCurrency,
        newTripAdminName.trim()
      );

      applyWorkspace(nextWorkspace);
      setNewTripName('');
      setNewTripAdminName('');
      setIsCreatingTripView(false);
      setActiveTab('dashboard');
    } catch (error) {
      console.error(error);
      setCreateTripError(error instanceof Error ? error.message : 'Could not create trip.');
    }
  };

  const handleJoinTripSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setJoinError(null);
    setActionError(null);

    if (!inviteInput.trim()) {
      setJoinError('Please provide an invite code');
      return;
    }
    if (!displayNameInput.trim()) {
      setJoinError('Please enter your display name');
      return;
    }

    try {
      const nextWorkspace = await requestJoinByInvite(inviteInput.trim(), displayNameInput.trim());
      applyWorkspace(nextWorkspace);
      setDisplayNameInput('');
      setActiveTab('dashboard');
    } catch (error) {
      console.error(error);
      setJoinError(error instanceof Error ? error.message : 'Could not request access.');
    }
  };

  const runAdminAction = async (action: () => Promise<void>) => {
    setActionError(null);
    try {
      await action();
      await loadAuthenticatedWorkspace(currentMember?.id ?? null, { setLoading: true });
    } catch (error) {
      console.error(error);
      setActionError(error instanceof Error ? error.message : 'Action failed.');
      throw error;
    }
  };

  const handleApproveMember = async (memberId: string) => {
    await runAdminAction(() => approveMember(memberId));
  };

  const handleRejectMember = async (memberId: string) => {
    await runAdminAction(() => rejectMember(memberId));
  };

  const handleRemoveMember = async (memberId: string) => {
    await runAdminAction(() => removeMember(memberId));
  };

  const handleUpdateExchangeRate = async (
    fromCurrency: Currency,
    toCurrency: Currency,
    rate: number
  ) => {
    if (!activeTrip) {
      throw new Error('Trip access is not loaded.');
    }

    const nextWorkspace = await updateExchangeRate(activeTrip.id, fromCurrency, toCurrency, rate);
    applyWorkspace(nextWorkspace);
    setActionError(null);
  };

  const handleUpdateDisplayCurrency = async (displayCurrency: Currency | null) => {
    if (!currentMember) {
      throw new Error('Trip member is not loaded.');
    }

    const nextWorkspace = await updateMemberDisplayCurrency(currentMember.id, displayCurrency);
    applyWorkspace(nextWorkspace);
    setActionError(null);
  };

  const rememberAdminExchangeRate = async (
    currency: Currency,
    exchangeRate: number
  ) => {
    if (!activeTrip || currentMember?.role !== 'admin' || currency === activeTrip.base_currency) {
      return;
    }

    try {
      const nextWorkspace = await updateExchangeRate(
        activeTrip.id,
        currency,
        activeTrip.base_currency,
        exchangeRate
      );
      applyWorkspace(nextWorkspace);
    } catch (error) {
      console.error(error);
      setActionError(error instanceof Error ? error.message : 'Expense saved, but default exchange rate was not updated.');
    }
  };

  const createLocalId = (prefix: string) => {
    const randomId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
    return `${prefix}_${randomId}`;
  };

  const handleCreateExpense = async (
    title: string,
    amount: number,
    currency: Currency,
    exchangeRate: number,
    convertedAmount: number,
    paidByMemberId: string,
    expenseDate: string,
    notes: string,
    splitsList: { member_id: string; amount_owed: number }[]
  ) => {
    if (!activeTrip || !currentMember) {
      throw new Error('Trip access is not loaded.');
    }

    try {
      const nextWorkspace = await createExpenseWithSplits(
        activeTrip.id,
        title,
        amount,
        currency,
        exchangeRate,
        convertedAmount,
        paidByMemberId,
        expenseDate,
        notes,
        splitsList
      );
      applyWorkspace(nextWorkspace);
      setActionError(null);
      await rememberAdminExchangeRate(currency, exchangeRate);
    } catch (error) {
      console.error(error);
      setActionError(error instanceof Error ? error.message : 'Could not save expense.');
      throw error;
    }
  };

  const handleUpdateExpense = async (
    expenseId: string,
    title: string,
    amount: number,
    currency: Currency,
    exchangeRate: number,
    convertedAmount: number,
    paidByMemberId: string,
    expenseDate: string,
    notes: string,
    splitsList: { member_id: string; amount_owed: number }[]
  ) => {
    try {
      const nextWorkspace = await updateExpenseWithSplits(
        expenseId,
        title,
        amount,
        currency,
        exchangeRate,
        convertedAmount,
        paidByMemberId,
        expenseDate,
        notes,
        splitsList
      );
      applyWorkspace(nextWorkspace);
      setActionError(null);
      await rememberAdminExchangeRate(currency, exchangeRate);
    } catch (error) {
      console.error(error);
      setActionError(error instanceof Error ? error.message : 'Could not update expense.');
      throw error;
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    try {
      const nextWorkspace = await deleteExpense(expenseId);
      applyWorkspace(nextWorkspace);
      setSelectedExpenseIdForDetail(null);
      setActionError(null);
    } catch (error) {
      console.error(error);
      setActionError(error instanceof Error ? error.message : 'Could not delete expense.');
      throw error;
    }
  };

  const handleMarkSettlementPaid = async (
    fromMemberId: string,
    toMemberId: string,
    amount: number,
    currency: Currency
  ) => {
    if (!activeTrip || !currentMember) {
      throw new Error('Trip access is not loaded.');
    }

    const now = new Date().toISOString();
    setLocalSettlements(prev => [
      {
        id: createLocalId('settlement'),
        trip_id: activeTrip.id,
        from_member_id: fromMemberId,
        to_member_id: toMemberId,
        amount,
        currency,
        status: 'paid',
        created_by_member_id: currentMember.id,
        created_at: now,
        paid_at: now,
      },
      ...prev,
    ]);

    setActionError(null);
  };

  const handleLeaveTrip = () => {
    clearActiveMemberId();
    setWorkspace(null);
    setIsCreatingTripView(false);
    setIsSideMenuOpen(false);
    setIsExchangeRatesOpen(false);
    setSelectedExpenseIdForDetail(null);
    setIsAddingExpense(false);
    setLocalSettlementTripId(null);
    setLocalSettlements([]);
    setActiveTab('dashboard');
  };

  const renderCenteredMessage = (title: string, message: string) => (
    <div className="px-6 py-8 flex flex-col justify-center items-center text-center gap-4 flex-1 bg-[#121418]">
      <div className="w-14 h-14 bg-indigo-600/15 border border-indigo-500/25 rounded-2xl flex items-center justify-center text-indigo-300">
        <Compass className="w-7 h-7" />
      </div>
      <div>
        <h1 className="text-lg font-bold text-white font-display">{title}</h1>
        <p className="text-xs text-slate-400 mt-2 max-w-xs leading-relaxed">{message}</p>
      </div>
    </div>
  );

  const renderAuthScreen = () => (
    <div className="px-5 py-8 flex flex-col gap-6 flex-1 justify-center animate-fade-in bg-[#121418]">
      <div className="text-center">
        <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-md mb-3.5 accent-glow">
          <Compass className="w-8 h-8 text-white stroke-[2.5]" />
        </div>
        <h1 className="text-3xl font-extrabold font-display text-white tracking-tight leading-none uppercase">
          TripBalance
        </h1>
        <p className="text-xs text-slate-500 font-medium mt-2 max-w-sm mx-auto">
          Sign in to keep your trip access across browsers and devices.
        </p>
      </div>

      <form onSubmit={handleAuthSubmit} className="bg-[#1a1d23] border border-slate-800 p-5 rounded-3xl shadow-sm flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-1.5 bg-[#121418] border border-slate-800 p-1 rounded-2xl">
          <button
            type="button"
            onClick={() => {
              setAuthMode('login');
              setAuthError(null);
              setAuthMessage(null);
            }}
            className={`min-h-10 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              authMode === 'login' ? 'bg-indigo-600 text-slate-950' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('signup');
              setAuthError(null);
              setAuthMessage(null);
            }}
            className={`min-h-10 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              authMode === 'signup' ? 'bg-indigo-600 text-slate-950' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Sign up
          </button>
        </div>

        {authError && (
          <div className="bg-rose-950/40 border border-rose-900/30 text-rose-300 p-2.5 rounded-xl text-[11px] flex items-start gap-1.5 leading-snug">
            <AlertOctagon className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{authError}</span>
          </div>
        )}

        {authMessage && (
          <div className="bg-indigo-950/30 border border-indigo-900/30 text-indigo-200 p-2.5 rounded-xl text-[11px] leading-snug">
            {authMessage}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Email *
            </label>
            <input
              type="email"
              required
              value={authEmail}
              onChange={event => setAuthEmail(event.target.value)}
              placeholder="you@example.com"
              className="w-full bg-[#121418] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Password *
            </label>
            <input
              type="password"
              required
              value={authPassword}
              onChange={event => setAuthPassword(event.target.value)}
              placeholder="At least 6 characters"
              className="w-full bg-[#121418] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isAuthSubmitting}
          className="w-full bg-indigo-600 disabled:opacity-60 text-slate-950 font-bold py-3 px-4 rounded-xl text-xs transition-colors mt-1.5 cursor-pointer"
        >
          {isAuthSubmitting ? 'Please wait...' : authMode === 'signup' ? 'Create Account' : 'Log In'}
        </button>
      </form>
    </div>
  );

  const renderAccountStrip = () => authUser ? (
    <div className="w-full max-w-xs mx-auto rounded-2xl bg-[#1a1d23] border border-slate-800 px-3 py-2 flex items-center justify-between gap-3">
      <span className="text-[10px] text-slate-500 truncate">
        {authUser.email}
      </span>
      <button
        type="button"
        onClick={handleLogout}
        className="text-[10px] font-bold text-indigo-300 hover:text-indigo-200 cursor-pointer shrink-0"
      >
        Log out
      </button>
    </div>
  ) : null;

  return (
    <div className="h-[100dvh] bg-[var(--color-page-background)] flex flex-col md:py-6 items-center select-none font-sans overflow-hidden">
      <div className="tripbalance-shell w-full max-w-md bg-[var(--color-app-background)] border border-slate-800/80 md:rounded-[36px] shadow-2xl overflow-hidden h-[100dvh] md:h-full md:max-h-[900px] flex flex-col relative">
        <div className="bg-[var(--color-background)] text-slate-700 text-[10px] font-mono px-6 py-1.5 shrink-0 flex justify-between select-none items-center border-b border-slate-300/70">
          <span>17:10 pm</span>
          <div className="w-24 h-4 bg-[#050607] rounded-full border border-slate-905 mx-auto hidden md:block" />
          <div className="flex gap-1.5 items-center">
            <span>5G</span>
            <div className="w-5 h-2.5 bg-slate-800 rounded-2xs border border-slate-900 p-0.5 flex">
              <div className="bg-indigo-500 flex-1 rounded-3xs" />
            </div>
          </div>
        </div>

        {activeTrip && (
          <>
            <AppHeader
              trip={activeTrip}
              currentMember={currentMember}
              onMenuOpen={() => setIsSideMenuOpen(true)}
            />
            <SideMenu
              isOpen={isSideMenuOpen}
              trip={activeTrip}
              currentMember={currentMember}
              accountEmail={authUser?.email ?? null}
              onClose={() => setIsSideMenuOpen(false)}
              onLeaveTrip={handleLeaveTrip}
              onAdminTools={() => setActiveTab('members')}
              onExchangeRates={() => setIsExchangeRatesOpen(true)}
              onUpdateDisplayCurrency={handleUpdateDisplayCurrency}
              onLogout={handleLogout}
            />
            {currentMember?.status === 'approved' && (
              <ExchangeRatesSheet
                isOpen={isExchangeRatesOpen}
                trip={activeTrip}
                currentMember={currentMember}
                exchangeRates={tripExchangeRates}
                onClose={() => setIsExchangeRatesOpen(false)}
                onUpdateRate={handleUpdateExchangeRate}
              />
            )}
          </>
        )}

        <div className={`flex-1 min-h-0 flex flex-col overflow-y-auto no-scrollbar select-text bg-[#121418] ${
            isApprovedWorkspace ? 'mb-[calc(68px+env(safe-area-inset-bottom))]' : ''
        }`}>
          {!isSupabaseConfigured && renderCenteredMessage(
            'Supabase is not configured',
            'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local, then run the Phase 4 migration.'
          )}

          {isSupabaseConfigured && isBootstrapping && renderCenteredMessage(
            'Loading SaiHat',
            'Restoring your account session.'
          )}

          {isSupabaseConfigured && !isBootstrapping && authUser && appError && !activeTrip && renderCenteredMessage(
            'Could not restore trip access',
            appError
          )}

          {isSupabaseConfigured && !isBootstrapping && !authUser && renderAuthScreen()}

          {isSupabaseConfigured && !isBootstrapping && authUser && !activeTrip && !currentMember && !isCreatingTripView && (
            <div className="px-5 py-8 flex flex-col gap-8 flex-1 justify-center animate-fade-in bg-[#121418]">
              <div className="text-center">
                <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-md mb-3.5 accent-glow">
                  <Compass className="w-8 h-8 text-white stroke-[2.5]" />
                </div>
                <h1 className="text-3xl font-extrabold font-display text-white tracking-tight leading-none uppercase">
                  TripBalance
                </h1>
                <p className="text-xs text-slate-500 font-medium mt-2 max-w-sm mx-auto">
                  Private shared trip access with invite codes and admin approval.
                </p>
              </div>

              {renderAccountStrip()}

              <form onSubmit={handleJoinTripSubmit} className="bg-[#1a1d23] border border-slate-800 p-5 rounded-3xl shadow-sm flex flex-col gap-4">
                <div className="border-b border-slate-800 pb-2.5">
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Join Shared Trip
                  </h2>
                </div>

                {joinError && (
                  <div className="bg-rose-950/40 border border-rose-900/30 text-rose-300 p-2.5 rounded-xl text-[11px] flex items-start gap-1.5 leading-snug">
                    <AlertOctagon className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{joinError}</span>
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Invite Code *
                    </label>
                    <input
                      type="text"
                      id="input-join-invite-code"
                      required
                      value={inviteInput}
                      onChange={event => setInviteInput(event.target.value.toUpperCase())}
                      placeholder="e.g. GRAD26"
                      className="w-full bg-[#121418] border border-slate-800 rounded-xl px-3.5 py-2.5 font-mono text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Your Display Name *
                    </label>
                    <input
                      type="text"
                      id="input-join-display-name"
                      required
                      value={displayNameInput}
                      onChange={event => setDisplayNameInput(event.target.value)}
                      placeholder="e.g. Aryn"
                      className="w-full bg-[#121418] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  id="btn-join-submit"
                  className="w-full bg-indigo-600 text-slate-950 font-bold py-3 px-4 rounded-xl text-xs transition-colors mt-1.5 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Request Trip Access</span>
                </button>
              </form>

              <div className="text-center flex flex-col gap-3.5 mt-2">
                <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">OR</span>
                <button
                  id="btn-goto-create-trip"
                  onClick={() => setIsCreatingTripView(true)}
                  className="bg-transparent hover:bg-slate-800/10 text-indigo-400 border border-indigo-500/20 border-dashed py-3.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4.5 h-4.5" />
                  <span>Create Brand New Trip</span>
                </button>
              </div>
            </div>
          )}

          {isSupabaseConfigured && !isBootstrapping && authUser && isCreatingTripView && !activeTrip && !currentMember && (
            <div className="px-5 py-8 flex flex-col gap-6 flex-1 justify-center animate-fade-in bg-[#121418]">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsCreatingTripView(false)}
                  className="p-1 px-2.5 bg-slate-800 border border-slate-700/80 rounded-xl text-xs text-slate-300 font-semibold flex items-center hover:bg-slate-750 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-0.5" />
                  <span>Back</span>
                </button>
              </div>

              <div>
                <h1 className="text-2xl font-bold font-display text-white tracking-tight">
                  Create trip
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Start a shared trip space and invite your group.
                </p>
              </div>

              {renderAccountStrip()}

              {createTripError && (
                <div className="bg-rose-950/40 border border-rose-900/30 text-rose-300 p-2.5 rounded-xl text-xs flex items-start gap-1">
                  <AlertOctagon className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{createTripError}</span>
                </div>
              )}

              <form onSubmit={handleCreateTripSubmit} className="bg-[#1a1d23] border border-slate-800/60 p-5 rounded-3xl shadow-sm flex flex-col gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Trip Name *
                  </label>
                  <input
                    type="text"
                    required
                    id="input-create-trip-name"
                    value={newTripName}
                    onChange={event => setNewTripName(event.target.value)}
                    placeholder="e.g. Graduation Trip"
                    className="w-full bg-[#121418] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Your Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    id="input-create-admin-name"
                    value={newTripAdminName}
                    onChange={event => setNewTripAdminName(event.target.value)}
                    placeholder="e.g. Aryn"
                    className="w-full bg-[#121418] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Base Currency *
                  </label>
                  <select
                    value={newTripBaseCurrency}
                    id="select-create-base-currency"
                    onChange={event => setNewTripBaseCurrency(event.target.value as Currency)}
                    className="w-full bg-[#121418] border border-slate-800 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-200 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="CNY">CNY (Chinese Yuan)</option>
                    <option value="AED">AED (Emirati Dirham)</option>
                    <option value="KZT">KZT (Kazakhstani Tenge)</option>
                  </select>
                  <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                    Trip base currency is used for calculations. You can still view your personal amounts in another currency later.
                  </p>
                </div>

                <button
                  type="submit"
                  id="btn-create-trip-submit"
                  className="w-full bg-indigo-600 text-slate-950 font-bold py-3 px-4 rounded-xl text-xs transition-colors mt-2 text-center cursor-pointer"
                >
                  Create Trip
                </button>
              </form>
            </div>
          )}

          {currentMember && currentMember.status === 'pending' && (
            <div className="px-6 py-8 flex flex-col justify-center items-center text-center gap-5 flex-1 animate-fade-in bg-[#121418]">
              <div className="w-16 h-16 bg-amber-950/40 text-amber-500 rounded-full border border-amber-900/40 flex items-center justify-center">
                <Clock className="w-8 h-8 stroke-[2.5]" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white font-display">Access pending</h1>
                <p id="pending-screen-msg" className="text-xs text-slate-400 mt-2 max-w-xs leading-relaxed">
                  Your request as <strong>{currentMember.display_name}</strong> is waiting for admin approval.
                </p>
              </div>
              {renderAccountStrip()}
              <button
                id="btn-pending-back-landing"
                onClick={handleLeaveTrip}
                className="w-full max-w-xs bg-[#1a1d23] hover:bg-[#20242b] text-slate-300 font-bold border border-slate-800 py-3 rounded-xl text-xs cursor-pointer"
              >
                Leave trip
              </button>
            </div>
          )}

          {currentMember && currentMember.status === 'rejected' && (
            <div className="px-6 py-8 flex flex-col justify-center items-center text-center gap-5 flex-1 animate-fade-in bg-[#121418]">
              <div className="w-16 h-16 bg-rose-950/30 text-rose-500 rounded-full border border-rose-900/30 flex items-center justify-center">
                <X className="w-8 h-8 stroke-[2.5]" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white font-display">Access rejected</h1>
                <p className="text-xs text-slate-400 mt-2 max-w-xs leading-relaxed">
                  Your request was rejected by an admin.
                </p>
              </div>
              {renderAccountStrip()}
              <button
                id="btn-rejected-leave-trip"
                onClick={handleLeaveTrip}
                className="w-full max-w-xs bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-bold py-3 rounded-xl text-xs cursor-pointer"
              >
                Exit Workspace
              </button>
            </div>
          )}

          {currentMember && currentMember.status === 'removed' && (
            <div className="px-6 py-8 flex flex-col justify-center items-center text-center gap-5 flex-1 animate-fade-in bg-[#121418]">
              <div className="w-16 h-16 bg-amber-950/30 text-amber-500 rounded-full border border-amber-900/30 flex items-center justify-center">
                <AlertOctagon className="w-8 h-8 stroke-[2.5]" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white font-display">Member removed</h1>
                <p className="text-xs text-slate-400 mt-2 max-w-xs leading-normal">
                  You have been removed from this trip by an admin.
                </p>
              </div>
              {renderAccountStrip()}
              <button
                id="btn-removed-leave-trip"
                onClick={handleLeaveTrip}
                className="w-full max-w-xs bg-[#1a1d23] hover:bg-[#20242b] border border-slate-800 text-slate-200 font-bold py-3 rounded-xl text-xs cursor-pointer"
              >
                Exit Workspace
              </button>
            </div>
          )}

          {currentMember && currentMember.status === 'approved' && !activeTrip && renderCenteredMessage(
            'Trip access unavailable',
            'Your member session is approved, but the trip data could not be loaded.'
          )}

          {activeTrip && currentMember && currentMember.status === 'approved' && (
            <div className="flex-1 flex flex-col bg-[#121418]">
              {(actionError || isWorkspaceLoading) && (
                <div className="mx-4 mt-3 rounded-2xl border border-slate-800 bg-[#1a1d23] px-3 py-2 text-[11px] text-slate-400">
                  {actionError ?? 'Syncing latest trip data...'}
                </div>
              )}

              <div className="flex-1 overflow-y-auto">
                {activeTab === 'dashboard' && (
                  <DashboardTab
                    trip={activeTrip}
                    currentMember={currentMember}
                    expenses={tripExpenses}
                    splits={tripSplits}
                    exchangeRates={tripExchangeRates}
                    members={tripMembers}
                    onAddExpenseClick={() => {
                      setIsAddingExpense(true);
                      setActiveTab('expenses');
                    }}
                    onViewExpense={(id) => {
                      setSelectedExpenseIdForDetail(id);
                      setIsAddingExpense(false);
                      setActiveTab('expenses');
                    }}
                    onChangeTab={(tab) => setActiveTab(tab)}
                  />
                )}

                {activeTab === 'expenses' && (
                  <ExpensesTab
                    trip={activeTrip}
                    currentMember={currentMember}
                    expenses={tripExpenses}
                    splits={tripSplits}
                    exchangeRates={tripExchangeRates}
                    members={tripMembers}
                    onCreateExpense={handleCreateExpense}
                    onUpdateExpense={handleUpdateExpense}
                    onDeleteExpense={handleDeleteExpense}
                    selectedExpenseIdForDetail={selectedExpenseIdForDetail}
                    onSetSelectedExpenseId={setSelectedExpenseIdForDetail}
                    isAddingExpense={isAddingExpense}
                    onSetAddingExpense={setIsAddingExpense}
                  />
                )}

                {activeTab === 'balances' && (
                  <BalancesTab
                    trip={activeTrip}
                    currentMember={currentMember}
                    expenses={tripExpenses}
                    splits={tripSplits}
                    exchangeRates={tripExchangeRates}
                    members={tripMembers}
                    settlements={localSettlements}
                    onMarkSettlementPaid={handleMarkSettlementPaid}
                  />
                )}

                {activeTab === 'members' && (
                  <MembersTab
                    trip={activeTrip}
                    currentMember={currentMember}
                    members={tripMembers}
                    onApproveMember={handleApproveMember}
                    onRejectMember={handleRejectMember}
                    onRemoveMember={handleRemoveMember}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {activeTrip && currentMember && currentMember.status === 'approved' && (
          <BottomNav
            activeTab={activeTab}
            onChangeTab={(tab) => {
              setActiveTab(tab);
              setSelectedExpenseIdForDetail(null);
              setIsAddingExpense(false);
            }}
            pendingRequestsCount={tripMembers.filter(member => member.status === 'pending').length}
            showAdminBadge={currentMember.role === 'admin'}
          />
        )}
      </div>
    </div>
  );
}
