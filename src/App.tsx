import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BottomNav, TabType } from './components/BottomNav';
import { ExpensesTab } from './components/ExpensesTab';
import { BalancesTab } from './components/BalancesTab';
import { MembersTab } from './components/MembersTab';
import { AppHeader } from './components/AppHeader';
import { SideMenu } from './components/SideMenu';
import { ExchangeRatesSheet } from './components/ExchangeRatesSheet';
import { LandingPage } from './components/LandingPage';
import { Currency, ExpenseFeeInput, ExpenseSplitInput } from './types';
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
  approveTripClosure,
  cancelTripClosure,
  claimLegacyMember,
  createExpenseWithSplits,
  createTripWithAdmin,
  deleteExpense,
  demoteAdmin,
  leaveTrip,
  listMyWorkspaces,
  loadAuthWorkspace,
  markSettlementPaid,
  promoteMemberToAdmin,
  PhaseOneWorkspace,
  regenerateTripInviteCode,
  rejectMember,
  removeMember,
  requestJoinByInvite,
  startTripClosure,
  updateExchangeRate,
  updateExpenseWithSplits,
  updateMemberDisplayCurrency,
  updateTripName,
  voidSettlement,
  WorkspaceSummary,
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
import {
  exportBalancesCsv,
  exportExpensesCsv,
  exportSettlementsCsv,
} from './lib/csvExport';

const LEGACY_MEMBER_ACCESS_TOKEN_KEY = 'tripbalance_member_access_token';
const LEGACY_ACTIVE_MEMBER_ID_KEY = 'tripbalance_active_member_id';
const ACTIVE_MEMBER_ID_KEY = 'parite_active_member_id';

export default function App() {
  const [workspace, setWorkspace] = useState<PhaseOneWorkspace | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('expenses');
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);
  const [isExchangeRatesOpen, setIsExchangeRatesOpen] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const authCardRef = useRef<HTMLElement | null>(null);
  const authEmailInputRef = useRef<HTMLInputElement | null>(null);

  const [inviteInput, setInviteInput] = useState('');
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  const [isCreatingTripView, setIsCreatingTripView] = useState(false);
  const [isJoiningTripView, setIsJoiningTripView] = useState(false);
  const [newTripName, setNewTripName] = useState('');
  const [newTripAdminName, setNewTripAdminName] = useState('');
  const [newTripBaseCurrency, setNewTripBaseCurrency] = useState<Currency>('CNY');
  const [createTripError, setCreateTripError] = useState<string | null>(null);

  const [selectedExpenseIdForDetail, setSelectedExpenseIdForDetail] = useState<string | null>(null);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [lastRenderedTripId, setLastRenderedTripId] = useState<string | null>(null);
  const [membersInitialCategory, setMembersInitialCategory] = useState<'approved' | 'requests' | 'removed'>('approved');

  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(false);
  const [exportBusy, setExportBusy] = useState<'expenses' | 'balances' | 'settlements' | null>(null);
  const [appError, setAppError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const getActionErrorMessage = (error: unknown, fallback: string) => {
    if (!(error instanceof Error) || !error.message.trim()) return fallback;

    const message = error.message.trim();
    const looksRaw = /(PGRST|SQLSTATE|violates|constraint|duplicate key|invalid input syntax|relation .* does not exist|function .* does not exist|column .* does not exist)/i.test(message);

    return looksRaw ? fallback : message;
  };

  const setActionErrorFromUnknown = (error: unknown, fallback: string) => {
    setActionError(getActionErrorMessage(error, fallback));
  };

  const activeTrip = workspace?.trip ?? null;
  const currentMember = workspace?.currentMember ?? null;
  const tripMembers = workspace?.members ?? [];
  const tripExpenses = workspace?.expenses ?? [];
  const tripSplits = workspace?.splits ?? [];
  const tripSettlements = workspace?.settlements ?? [];
  const tripExchangeRates = workspace?.exchangeRates ?? [];
  const isApprovedWorkspace = Boolean(activeTrip && currentMember?.status === 'approved');
  const tripStatus = activeTrip?.status ?? 'active';
  const isTripActive = tripStatus === 'active';

  useEffect(() => {
    const nextTripId = activeTrip?.id ?? null;
    if (nextTripId === lastRenderedTripId) return;

    const previousTripId = lastRenderedTripId;
    setLastRenderedTripId(nextTripId);

    if (previousTripId !== null && nextTripId !== previousTripId) {
      setSelectedExpenseIdForDetail(null);
      setIsAddingExpense(false);
    }
  }, [activeTrip?.id, lastRenderedTripId]);

  const clearAccessToken = () => {
    localStorage.removeItem(LEGACY_MEMBER_ACCESS_TOKEN_KEY);
  };

  const getActiveMemberId = () => {
    const activeMemberId = localStorage.getItem(ACTIVE_MEMBER_ID_KEY);
    if (activeMemberId) return activeMemberId;

    const legacyMemberId = localStorage.getItem(LEGACY_ACTIVE_MEMBER_ID_KEY);
    if (legacyMemberId) {
      localStorage.setItem(ACTIVE_MEMBER_ID_KEY, legacyMemberId);
      localStorage.removeItem(LEGACY_ACTIVE_MEMBER_ID_KEY);
      return legacyMemberId;
    }

    return null;
  };

  const saveActiveMemberId = (memberId: string | undefined) => {
    if (memberId) {
      localStorage.setItem(ACTIVE_MEMBER_ID_KEY, memberId);
    }
  };

  const clearActiveMemberId = () => {
    localStorage.removeItem(ACTIVE_MEMBER_ID_KEY);
    localStorage.removeItem(LEGACY_ACTIVE_MEMBER_ID_KEY);
  };

  const applyWorkspace = (nextWorkspace: PhaseOneWorkspace) => {
    setWorkspace(nextWorkspace);
    saveActiveMemberId(nextWorkspace.currentMember?.id);
    setAppError(null);
  };

  const refreshWorkspaces = useCallback(async (): Promise<WorkspaceSummary[]> => {
    setIsWorkspaceLoading(true);
    try {
      const nextWorkspaces = await listMyWorkspaces();
      setWorkspaces(nextWorkspaces);
      return nextWorkspaces;
    } catch (error) {
      console.error(error);
      setWorkspaces([]);
      setAppError(error instanceof Error ? error.message : 'Could not load your trips.');
      return [];
    } finally {
      setIsWorkspaceLoading(false);
    }
  }, []);

  const loadAuthenticatedWorkspace = useCallback(async (
    memberId: string,
    options: { setLoading?: boolean } = {}
  ): Promise<PhaseOneWorkspace | null> => {
    if (options.setLoading) {
      setIsWorkspaceLoading(true);
    }

    try {
      const nextWorkspace = await loadAuthWorkspace(memberId);
      if (!nextWorkspace.currentMember) {
        clearActiveMemberId();
        setWorkspace(null);
        setAppError(null);
        return null;
      }
      applyWorkspace(nextWorkspace);
      return nextWorkspace;
    } catch (error) {
      console.error(error);
      setWorkspace(null);
      clearActiveMemberId();
      setAppError(error instanceof Error ? error.message : 'Could not load your trip access.');
      return null;
    } finally {
      if (options.setLoading) {
        setIsWorkspaceLoading(false);
      }
    }
  }, []);

  const claimLegacyAccessIfPresent = useCallback(async (): Promise<PhaseOneWorkspace | null> => {
    const legacyAccessToken = localStorage.getItem(LEGACY_MEMBER_ACCESS_TOKEN_KEY);
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
      setIsJoiningTripView(true);
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
      setWorkspaces([]);
      clearActiveMemberId();
      return;
    }

    let cancelled = false;

    async function restoreAccountWorkspace() {
      const claimedWorkspace = await claimLegacyAccessIfPresent();
      if (cancelled) return;
      await refreshWorkspaces();
      if (claimedWorkspace) return;

      const activeMemberId = getActiveMemberId();
      if (!activeMemberId) {
        setWorkspace(null);
        setAppError(null);
        return;
      }

      await loadAuthenticatedWorkspace(activeMemberId, { setLoading: true });
    }

    restoreAccountWorkspace();

    return () => {
      cancelled = true;
    };
  }, [authUser, isBootstrapping, claimLegacyAccessIfPresent, loadAuthenticatedWorkspace, refreshWorkspaces]);

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
      setWorkspaces([]);
      setIsSideMenuOpen(false);
      clearActiveMemberId();
      setActiveTab('expenses');
    } catch (error) {
      console.error(error);
      setActionErrorFromUnknown(error, 'Could not log out.');
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
      await refreshWorkspaces();
      setNewTripName('');
      setNewTripAdminName('');
      setIsCreatingTripView(false);
      setIsJoiningTripView(false);
      setActiveTab('expenses');
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
      await refreshWorkspaces();
      setDisplayNameInput('');
      setIsJoiningTripView(false);
      setIsCreatingTripView(false);
      setActiveTab('expenses');
    } catch (error) {
      console.error(error);
      setJoinError(error instanceof Error ? error.message : 'Could not request access.');
    }
  };

  const runAdminAction = async (action: () => Promise<void>) => {
    if (!currentMember) {
      throw new Error('Trip member is not loaded.');
    }

    setActionError(null);
    try {
      await action();
      await loadAuthenticatedWorkspace(currentMember.id, { setLoading: true });
      await refreshWorkspaces();
    } catch (error) {
      console.error(error);
      setActionErrorFromUnknown(error, 'Action failed.');
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

  const handlePromoteMember = async (memberId: string) => {
    await runAdminAction(() => promoteMemberToAdmin(memberId));
  };

  const handleDemoteAdmin = async (memberId: string) => {
    if (!currentMember) {
      throw new Error('Trip member is not loaded.');
    }

    setActionError(null);
    try {
      const nextWorkspace = await demoteAdmin(memberId);
      applyWorkspace(nextWorkspace);
      await refreshWorkspaces();
    } catch (error) {
      console.error(error);
      setActionErrorFromUnknown(error, 'Could not remove admin permissions.');
      throw error;
    }
  };

  const getExportContext = () => {
    if (!activeTrip || !currentMember || currentMember.status !== 'approved') {
      throw new Error('Approved trip access is required to export CSV files.');
    }

    return {
      trip: activeTrip,
      currentMember,
      members: tripMembers,
      expenses: tripExpenses,
      splits: tripSplits,
      settlements: tripSettlements,
      exchangeRates: tripExchangeRates,
    };
  };

  const runExportAction = (exportType: 'expenses' | 'balances' | 'settlements', exportAction: () => void, fallback: string) => {
    if (exportBusy) return;

    setActionError(null);
    setExportBusy(exportType);
    try {
      exportAction();
    } catch (error) {
      console.error(error);
      setActionErrorFromUnknown(error, fallback);
    } finally {
      setExportBusy(null);
    }
  };

  const handleExportExpensesCsv = () => {
    runExportAction('expenses', () => exportExpensesCsv(getExportContext()), 'Could not export expenses CSV.');
  };

  const handleExportBalancesCsv = () => {
    runExportAction('balances', () => exportBalancesCsv(getExportContext()), 'Could not export balances CSV.');
  };

  const handleExportSettlementsCsv = () => {
    runExportAction('settlements', () => exportSettlementsCsv(getExportContext()), 'Could not export settlements CSV.');
  };

  const handleLeaveTrip = async () => {
    if (!currentMember) {
      throw new Error('Trip member is not loaded.');
    }

    setActionError(null);
    try {
      await leaveTrip(currentMember.id);
      clearActiveMemberId();
      setWorkspace(null);
      setIsSideMenuOpen(false);
      setActiveTab('expenses');
      await refreshWorkspaces();
    } catch (error) {
      console.error(error);
      setActionErrorFromUnknown(error, 'Could not leave trip.');
      throw error;
    }
  };

  const handleStartTripClosure = async () => {
    if (!activeTrip) throw new Error('Trip is not loaded.');

    setActionError(null);
    try {
      const nextWorkspace = await startTripClosure(activeTrip.id);
      applyWorkspace(nextWorkspace);
      await refreshWorkspaces();
    } catch (error) {
      console.error(error);
      setActionErrorFromUnknown(error, 'Could not start close request.');
      throw error;
    }
  };

  const handleApproveTripClosure = async () => {
    if (!activeTrip) throw new Error('Trip is not loaded.');

    setActionError(null);
    try {
      const nextWorkspace = await approveTripClosure(activeTrip.id);
      applyWorkspace(nextWorkspace);
      await refreshWorkspaces();
    } catch (error) {
      console.error(error);
      setActionErrorFromUnknown(error, 'Could not approve close request.');
      throw error;
    }
  };

  const handleCancelTripClosure = async () => {
    if (!activeTrip) throw new Error('Trip is not loaded.');

    setActionError(null);
    try {
      const nextWorkspace = await cancelTripClosure(activeTrip.id);
      applyWorkspace(nextWorkspace);
      await refreshWorkspaces();
    } catch (error) {
      console.error(error);
      setActionErrorFromUnknown(error, 'Could not cancel close request.');
      throw error;
    }
  };

  const handleRegenerateTripInviteCode = async () => {
    if (!activeTrip) throw new Error('Trip is not loaded.');

    setActionError(null);
    try {
      const nextWorkspace = await regenerateTripInviteCode(activeTrip.id);
      applyWorkspace(nextWorkspace);
      await refreshWorkspaces();
    } catch (error) {
      console.error(error);
      setActionErrorFromUnknown(error, 'Could not regenerate invite code.');
      throw error;
    }
  };

  const handleUpdateTripName = async (name: string) => {
    if (!activeTrip) throw new Error('Trip is not loaded.');

    setActionError(null);
    try {
      const nextWorkspace = await updateTripName(activeTrip.id, name);
      applyWorkspace(nextWorkspace);
      await refreshWorkspaces();
    } catch (error) {
      console.error(error);
      setActionErrorFromUnknown(error, 'Could not rename trip.');
      throw error;
    }
  };

  const handleUpdateExchangeRate = async (
    fromCurrency: Currency,
    toCurrency: Currency,
    rate: number
  ) => {
    if (!activeTrip) {
      throw new Error('Trip access is not loaded.');
    }

    try {
      const nextWorkspace = await updateExchangeRate(activeTrip.id, fromCurrency, toCurrency, rate);
      applyWorkspace(nextWorkspace);
      setActionError(null);
    } catch (error) {
      console.error(error);
      setActionErrorFromUnknown(error, 'Could not save exchange rate.');
      throw error;
    }
  };

  const handleUpdateDisplayCurrency = async (displayCurrency: Currency | null) => {
    if (!currentMember) {
      throw new Error('Trip member is not loaded.');
    }

    try {
      const nextWorkspace = await updateMemberDisplayCurrency(currentMember.id, displayCurrency);
      applyWorkspace(nextWorkspace);
      await refreshWorkspaces();
      setActionError(null);
    } catch (error) {
      console.error(error);
      setActionErrorFromUnknown(error, 'Could not save display currency.');
      throw error;
    }
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
      setActionErrorFromUnknown(error, 'Expense saved, but default exchange rate was not updated.');
    }
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
    splitsList: ExpenseSplitInput[],
    feeInput?: ExpenseFeeInput | null
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
        splitsList,
        feeInput
      );
      applyWorkspace(nextWorkspace);
      setActionError(null);
      await rememberAdminExchangeRate(currency, exchangeRate);
    } catch (error) {
      console.error(error);
      setActionErrorFromUnknown(error, 'Could not save expense.');
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
    splitsList: ExpenseSplitInput[],
    feeInput?: ExpenseFeeInput | null
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
        splitsList,
        feeInput
      );
      applyWorkspace(nextWorkspace);
      setActionError(null);
      await rememberAdminExchangeRate(currency, exchangeRate);
    } catch (error) {
      console.error(error);
      setActionErrorFromUnknown(error, 'Could not update expense.');
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
      setActionErrorFromUnknown(error, 'Could not delete expense.');
      throw error;
    }
  };

  const handleMarkSettlementPaid = async (
    fromMemberId: string,
    toMemberId: string,
    amount: number
  ) => {
    if (!activeTrip || !currentMember) {
      throw new Error('Trip access is not loaded.');
    }

    try {
      const nextWorkspace = await markSettlementPaid(
        activeTrip.id,
        fromMemberId,
        toMemberId,
        amount
      );
      applyWorkspace(nextWorkspace);
      setActionError(null);
    } catch (error) {
      console.error(error);
      setActionErrorFromUnknown(error, 'Could not mark settlement as paid.');
      throw error;
    }
  };

  const handleVoidSettlement = async (settlementId: string, reason: string) => {
    try {
      const nextWorkspace = await voidSettlement(settlementId, reason);
      applyWorkspace(nextWorkspace);
      setActionError(null);
    } catch (error) {
      console.error(error);
      setActionErrorFromUnknown(error, 'Could not void settlement.');
      throw error;
    }
  };

  const handleSwitchWorkspace = async (memberId: string) => {
    setActionError(null);
    setIsWorkspaceLoading(true);
    try {
      const nextWorkspace = await loadAuthWorkspace(memberId);
      if (!nextWorkspace.currentMember) {
        throw new Error('Could not load that trip.');
      }
      applyWorkspace(nextWorkspace);
      await refreshWorkspaces();
      setIsSideMenuOpen(false);
      setIsCreatingTripView(false);
      setIsJoiningTripView(false);
      setSelectedExpenseIdForDetail(null);
      setIsAddingExpense(false);
      setIsExchangeRatesOpen(false);
      setActiveTab('expenses');
    } catch (error) {
      console.error(error);
      clearActiveMemberId();
      setWorkspace(null);
      setActionErrorFromUnknown(error, 'Could not switch trips.');
    } finally {
      setIsWorkspaceLoading(false);
    }
  };

  const handleShowTripSelection = () => {
    clearActiveMemberId();
    setWorkspace(null);
    setIsCreatingTripView(false);
    setIsJoiningTripView(false);
    setIsSideMenuOpen(false);
    setIsExchangeRatesOpen(false);
    setSelectedExpenseIdForDetail(null);
    setIsAddingExpense(false);
    setActiveTab('expenses');
    setActionError(null);
    setAppError(null);
    refreshWorkspaces();
  };

  const handleStartCreateTrip = () => {
    clearActiveMemberId();
    setWorkspace(null);
    setIsCreatingTripView(true);
    setIsJoiningTripView(false);
    setIsSideMenuOpen(false);
    setActiveTab('expenses');
  };

  const handleStartJoinTrip = () => {
    clearActiveMemberId();
    setWorkspace(null);
    setIsCreatingTripView(false);
    setIsJoiningTripView(true);
    setIsSideMenuOpen(false);
    setActiveTab('expenses');
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

  const renderAuthCard = () => {
    const authFeedbackId = authError ? 'auth-error-message' : authMessage ? 'auth-status-message' : undefined;

    return (
      <section
        ref={authCardRef}
        id="auth-card"
        aria-labelledby="auth-card-title"
        className="scroll-mt-24"
      >
        <form
          id="form-auth"
          onSubmit={handleAuthSubmit}
          aria-labelledby="auth-card-title"
          aria-describedby={authFeedbackId}
          className="bg-[#1a1d23] border border-slate-800 p-5 rounded-3xl shadow-sm flex flex-col gap-4"
        >
          <div className="border-b border-slate-800 pb-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Parité account
            </p>
            <h2 id="auth-card-title" className="text-xl font-bold font-display text-white tracking-tight mt-1">
              {authMode === 'signup' ? 'Create your account' : 'Log in to continue'}
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-2 leading-relaxed">
              Sign in to keep your trip access across browsers and devices.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-1.5 bg-[#121418] border border-slate-800 p-1 rounded-2xl">
            <button
              type="button"
              id="tab-auth-login"
              aria-pressed={authMode === 'login'}
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
              id="tab-auth-signup"
              aria-pressed={authMode === 'signup'}
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
            <div
              id="auth-error-message"
              role="alert"
              className="bg-rose-950/40 border border-rose-900/30 text-rose-300 p-2.5 rounded-xl text-[11px] flex items-start gap-1.5 leading-snug"
            >
              <AlertOctagon className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          {authMessage && (
            <div
              id="auth-status-message"
              role="status"
              className="bg-indigo-950/30 border border-indigo-900/30 text-indigo-200 p-2.5 rounded-xl text-[11px] leading-snug"
            >
              {authMessage}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <div>
              <label htmlFor="input-auth-email" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Email *
              </label>
              <input
                ref={authEmailInputRef}
                id="input-auth-email"
                type="email"
                required
                autoComplete="email"
                value={authEmail}
                onChange={event => setAuthEmail(event.target.value)}
                placeholder="you@example.com"
                aria-invalid={Boolean(authError)}
                aria-describedby={authFeedbackId}
                className="w-full bg-[#121418] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="input-auth-password" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Password *
              </label>
              <input
                id="input-auth-password"
                type="password"
                required
                autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                value={authPassword}
                onChange={event => setAuthPassword(event.target.value)}
                placeholder="At least 6 characters"
                aria-invalid={Boolean(authError)}
                aria-describedby={authFeedbackId}
                className="w-full bg-[#121418] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            id="btn-auth-submit"
            disabled={isAuthSubmitting}
            className="w-full bg-indigo-600 disabled:opacity-60 text-slate-950 font-bold py-3 px-4 rounded-xl text-xs transition-colors mt-1.5 cursor-pointer"
          >
            {isAuthSubmitting ? 'Please wait...' : authMode === 'signup' ? 'Create Account' : 'Log In'}
          </button>
        </form>
      </section>
    );
  };

  const handleLandingGetStartedClick = () => {
    setAuthMode('signup');
    setAuthError(null);
    setAuthMessage(null);

    window.requestAnimationFrame(() => {
      authCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.setTimeout(() => {
        authEmailInputRef.current?.focus({ preventScroll: true });
      }, 120);
    });
  };

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

  const renderActionErrorBanner = (className = '') => actionError ? (
    <div className={`sticky top-0 z-50 w-full bg-[#e07a5f] border-y border-[#e07a5f] text-[#3d405b] shadow-lg ${className}`}>
      <div className="px-4 py-3 flex items-start gap-3">
        <AlertOctagon className="w-5 h-5 shrink-0 mt-0.5 text-[#3d405b]" />
        <span className="flex-1 text-sm font-bold leading-snug">{actionError}</span>
        <button
          type="button"
          onClick={() => setActionError(null)}
          className="shrink-0 rounded-lg p-1 text-[#3d405b] hover:bg-[#3d405b]/10 focus:outline-none focus:ring-2 focus:ring-[#3d405b]/30"
          aria-label="Dismiss error"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  ) : null;

  const renderWorkspaceSelection = () => (
    <div className="px-5 py-8 flex flex-col gap-6 flex-1 animate-fade-in bg-[#121418] overflow-y-auto no-scrollbar">
      <div className="text-center">
        <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-md mb-3.5 accent-glow">
          <Compass className="w-8 h-8 text-white stroke-[2.5]" />
        </div>
        <h1 className="text-3xl font-extrabold font-display text-white tracking-tight leading-none">
          Parité
        </h1>
        <p className="text-xs text-slate-500 font-medium mt-2 max-w-sm mx-auto">
          Select a trip or start a new shared workspace.
        </p>
      </div>

      {renderAccountStrip()}

      {renderActionErrorBanner('-mx-5 w-auto')}

      <section className="bg-[#1a1d23] border border-slate-800 p-5 rounded-3xl shadow-sm flex flex-col gap-4">
        <div className="border-b border-slate-800 pb-2.5">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Select a trip
          </h2>
        </div>

        {isWorkspaceLoading && (
          <p className="text-xs text-slate-500">Loading trips...</p>
        )}

        {!isWorkspaceLoading && workspaces.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-[#121418] px-4 py-8 text-center">
            <p className="text-sm font-bold text-slate-200">No trips yet.</p>
            <p className="text-xs text-slate-500 mt-1">
              Create a trip or join one with an invite code.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {workspaces.map(item => (
              <button
                type="button"
                key={item.member_id}
                onClick={() => handleSwitchWorkspace(item.member_id)}
                className="w-full rounded-2xl bg-[#121418] border border-slate-800 hover:border-indigo-500/35 px-4 py-3 text-left cursor-pointer"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="text-sm font-bold text-slate-100 truncate block">
                      {item.trip_name}
                    </span>
                    <span className="text-[11px] text-slate-500 truncate block mt-1">
                      {item.display_name} - {item.role}
                    </span>
                  </span>
                  <span className="text-right shrink-0">
                    <span className="text-[10px] font-mono font-bold text-indigo-300 block">
                      {item.base_currency}
                    </span>
                    <span className="text-[9px] uppercase text-slate-500 mt-1 block">
                      {item.trip_status && item.trip_status !== 'active'
                        ? item.trip_status
                        : item.status}
                    </span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          id="btn-select-create-trip"
          onClick={handleStartCreateTrip}
          className="min-h-12 rounded-2xl bg-indigo-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Create trip
        </button>
        <button
          type="button"
          id="btn-select-join-trip"
          onClick={handleStartJoinTrip}
          className="min-h-12 rounded-2xl bg-[#1a1d23] border border-slate-800 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          Join trip
        </button>
      </div>
    </div>
  );

  if (isSupabaseConfigured && !isBootstrapping && !authUser) {
    return (
      <LandingPage
        authCard={renderAuthCard()}
        onGetStartedClick={handleLandingGetStartedClick}
      />
    );
  }

  return (
    <div className="h-[100dvh] bg-[var(--color-page-background)] flex flex-col md:py-6 items-center select-none font-sans overflow-hidden">
      <div className="parite-shell w-full max-w-md bg-[var(--color-app-background)] border border-slate-800/80 md:rounded-[36px] shadow-2xl overflow-hidden h-[100dvh] md:h-full md:max-h-[900px] flex flex-col relative">
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
              workspaces={workspaces}
              currentMemberId={currentMember?.id ?? null}
              onClose={() => setIsSideMenuOpen(false)}
              onSwitchWorkspace={handleSwitchWorkspace}
              onShowTripSelection={handleShowTripSelection}
              onCreateTrip={handleStartCreateTrip}
              onJoinTrip={handleStartJoinTrip}
              pendingRequestsCount={tripMembers.filter(member => member.status === 'pending').length}
              onAdminTools={() => {
                setMembersInitialCategory('approved');
                setActiveTab('members');
              }}
              onPendingRequests={() => {
                setMembersInitialCategory('requests');
                setActiveTab('members');
              }}
              onExchangeRates={() => setIsExchangeRatesOpen(true)}
              onRegenerateInviteCode={handleRegenerateTripInviteCode}
              onUpdateTripName={handleUpdateTripName}
              onUpdateDisplayCurrency={handleUpdateDisplayCurrency}
              onLeaveTrip={handleLeaveTrip}
              onStartTripClosure={handleStartTripClosure}
              onApproveTripClosure={handleApproveTripClosure}
              onCancelTripClosure={handleCancelTripClosure}
              onExportExpensesCsv={handleExportExpensesCsv}
              onExportBalancesCsv={handleExportBalancesCsv}
              onExportSettlementsCsv={handleExportSettlementsCsv}
              exportBusy={exportBusy}
              onActionError={setActionError}
              onLogout={handleLogout}
            />
            {currentMember?.status === 'approved' && (
              <ExchangeRatesSheet
                isOpen={isExchangeRatesOpen && isTripActive}
                trip={activeTrip}
                currentMember={currentMember}
                exchangeRates={tripExchangeRates}
                onClose={() => setIsExchangeRatesOpen(false)}
                onUpdateRate={handleUpdateExchangeRate}
                onActionError={setActionError}
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
            'Loading Parité',
            'Restoring your account session.'
          )}

          {isSupabaseConfigured && !isBootstrapping && authUser && appError && !activeTrip && renderCenteredMessage(
            'Could not restore trip access',
            appError
          )}

          {isSupabaseConfigured && !isBootstrapping && authUser && !activeTrip && !currentMember && !isCreatingTripView && !isJoiningTripView && renderWorkspaceSelection()}

          {isSupabaseConfigured && !isBootstrapping && authUser && isJoiningTripView && !activeTrip && !currentMember && (
            <div className="px-5 py-8 flex flex-col gap-6 flex-1 justify-center animate-fade-in bg-[#121418]">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsJoiningTripView(false)}
                  className="p-1 px-2.5 bg-slate-800 border border-slate-700/80 rounded-xl text-xs text-slate-300 font-semibold flex items-center hover:bg-slate-750 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-0.5" />
                  <span>Back</span>
                </button>
              </div>

              <div className="text-center">
                <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-md mb-3.5 accent-glow">
                  <Compass className="w-8 h-8 text-white stroke-[2.5]" />
                </div>
                <h1 className="text-2xl font-bold font-display text-white tracking-tight">
                  Join trip
                </h1>
                <p className="text-xs text-slate-500 font-medium mt-2 max-w-sm mx-auto">
                  Enter an invite code and your trip display name.
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
                      placeholder="e.g. Qotaqbas"
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
                    placeholder="e.g. Zaysan Trip"
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
                    placeholder="e.g. Qotaqbas"
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
                    <option value="AED">AED (Emirati Dirham)</option>
                    <option value="CNY">CNY (Chinese Yuan)</option>
                    <option value="KZT">KZT (Kazakhstani Tenge)</option>
                    <option value="USD">USD (US Dollar)</option>
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
                type="button"
                id="btn-pending-back-landing"
                onClick={handleShowTripSelection}
                className="w-full max-w-xs bg-[#1a1d23] hover:bg-[#20242b] text-slate-300 font-bold border border-slate-800 py-3 rounded-xl text-xs cursor-pointer"
              >
                Switch trip
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
                type="button"
                id="btn-rejected-leave-trip"
                onClick={handleShowTripSelection}
                className="w-full max-w-xs bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-bold py-3 rounded-xl text-xs cursor-pointer"
              >
                Switch trip
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
                type="button"
                id="btn-removed-leave-trip"
                onClick={handleShowTripSelection}
                className="w-full max-w-xs bg-[#1a1d23] hover:bg-[#20242b] border border-slate-800 text-slate-200 font-bold py-3 rounded-xl text-xs cursor-pointer"
              >
                Switch trip
              </button>
            </div>
          )}

          {currentMember && currentMember.status === 'approved' && !activeTrip && renderCenteredMessage(
            'Trip access unavailable',
            'Your member session is approved, but the trip data could not be loaded.'
          )}

          {activeTrip && currentMember && currentMember.status === 'approved' && (
            <div className="flex-1 flex flex-col bg-[#121418]">
              {renderActionErrorBanner()}

              {!actionError && isWorkspaceLoading && (
                <div className="mx-4 mt-3 rounded-2xl border border-slate-800 bg-[#1a1d23] px-3 py-2 text-[11px] text-slate-400 flex items-start gap-2">
                  <span className="flex-1">Loading the latest trip data...</span>
                </div>
              )}

              <div className="flex-1 overflow-y-auto">
                {activeTab === 'expenses' && (
                  <ExpensesTab
                    trip={activeTrip}
                    currentMember={currentMember}
                    expenses={tripExpenses}
                    splits={tripSplits}
                    settlements={tripSettlements}
                    exchangeRates={tripExchangeRates}
                    members={tripMembers}
                    onCreateExpense={handleCreateExpense}
                    onUpdateExpense={handleUpdateExpense}
                    onDeleteExpense={handleDeleteExpense}
                    selectedExpenseIdForDetail={selectedExpenseIdForDetail}
                    onSetSelectedExpenseId={setSelectedExpenseIdForDetail}
                    isAddingExpense={isAddingExpense}
                    onSetAddingExpense={setIsAddingExpense}
                    isReadOnly={!isTripActive}
                    onActionError={setActionError}
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
                    settlements={tripSettlements}
                    onMarkSettlementPaid={handleMarkSettlementPaid}
                    onVoidSettlement={handleVoidSettlement}
                  />
                )}

                {activeTab === 'members' && (
                  <MembersTab
                    trip={activeTrip}
                    currentMember={currentMember}
                    members={tripMembers}
                    initialCategory={membersInitialCategory}
                    onApproveMember={handleApproveMember}
                    onRejectMember={handleRejectMember}
                    onRemoveMember={handleRemoveMember}
                    onPromoteMember={handlePromoteMember}
                    onDemoteAdmin={handleDemoteAdmin}
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
