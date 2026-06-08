import React, { useCallback, useEffect, useState } from 'react';
import { BottomNav, TabType } from './components/BottomNav';
import { DashboardTab } from './components/DashboardTab';
import { ExpensesTab } from './components/ExpensesTab';
import { BalancesTab } from './components/BalancesTab';
import { MembersTab } from './components/MembersTab';
import { AppHeader } from './components/AppHeader';
import { SideMenu } from './components/SideMenu';
import { Currency } from './types';
import { isSupabaseConfigured } from './lib/supabase';
import {
  approveMember,
  createTripWithAdmin,
  loadMemberSession,
  PhaseOneWorkspace,
  rejectMember,
  removeMember,
  requestJoinByInvite,
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

export default function App() {
  const [workspace, setWorkspace] = useState<PhaseOneWorkspace | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);

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

  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const activeTrip = workspace?.trip ?? null;
  const currentMember = workspace?.currentMember ?? null;
  const tripMembers = workspace?.members ?? [];

  const saveAccessToken = (accessToken: string | undefined) => {
    if (accessToken) {
      localStorage.setItem(MEMBER_ACCESS_TOKEN_KEY, accessToken);
    }
  };

  const clearAccessToken = () => {
    localStorage.removeItem(MEMBER_ACCESS_TOKEN_KEY);
  };

  const reloadWorkspace = useCallback(async (accessTokenOverride?: string) => {
    const accessToken = accessTokenOverride ?? localStorage.getItem(MEMBER_ACCESS_TOKEN_KEY);
    if (!accessToken) {
      setWorkspace(null);
      return;
    }

    setIsWorkspaceLoading(true);
    try {
      const nextWorkspace = await loadMemberSession(accessToken);
      setWorkspace(nextWorkspace);
      saveAccessToken(nextWorkspace.currentMember.access_token);
      setAppError(null);
    } catch (error) {
      console.error(error);
      setWorkspace(null);
      clearAccessToken();
      setAppError(error instanceof Error ? error.message : 'Could not restore your trip access.');
    } finally {
      setIsWorkspaceLoading(false);
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

      setIsBootstrapping(true);
      try {
        const accessToken = localStorage.getItem(MEMBER_ACCESS_TOKEN_KEY);
        if (accessToken) {
          const nextWorkspace = await loadMemberSession(accessToken);
          if (cancelled) return;
          setWorkspace(nextWorkspace);
          saveAccessToken(nextWorkspace.currentMember.access_token);
        }
        setAppError(null);
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          clearAccessToken();
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

    return () => {
      cancelled = true;
    };
  }, []);

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
      const { member } = await createTripWithAdmin(
        newTripName.trim(),
        newTripBaseCurrency,
        newTripAdminName.trim()
      );

      saveAccessToken(member.access_token);
      setNewTripName('');
      setNewTripAdminName('');
      setIsCreatingTripView(false);
      setActiveTab('dashboard');
      await reloadWorkspace(member.access_token);
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
      const { member } = await requestJoinByInvite(inviteInput.trim(), displayNameInput.trim());
      saveAccessToken(member.access_token);
      setDisplayNameInput('');
      setActiveTab('dashboard');
      await reloadWorkspace(member.access_token);
    } catch (error) {
      console.error(error);
      setJoinError(error instanceof Error ? error.message : 'Could not request access.');
    }
  };

  const runAdminAction = async (action: (adminAccessToken: string) => Promise<void>) => {
    setActionError(null);
    const adminAccessToken = currentMember?.access_token;
    if (!adminAccessToken) {
      setActionError('Current member access token is missing.');
      return;
    }

    try {
      await action(adminAccessToken);
      await reloadWorkspace(adminAccessToken);
    } catch (error) {
      console.error(error);
      setActionError(error instanceof Error ? error.message : 'Action failed.');
      throw error;
    }
  };

  const handleApproveMember = async (memberId: string) => {
    await runAdminAction((adminAccessToken) => approveMember(adminAccessToken, memberId));
  };

  const handleRejectMember = async (memberId: string) => {
    await runAdminAction((adminAccessToken) => rejectMember(adminAccessToken, memberId));
  };

  const handleRemoveMember = async (memberId: string) => {
    await runAdminAction((adminAccessToken) => removeMember(adminAccessToken, memberId));
  };

  const handleUnavailableExpenseAction = async () => {
    setActionError('Expense persistence is not implemented in Phase 1.');
  };

  const handleLeaveTrip = () => {
    clearAccessToken();
    setWorkspace(null);
    setIsCreatingTripView(false);
    setIsSideMenuOpen(false);
    setSelectedExpenseIdForDetail(null);
    setIsAddingExpense(false);
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

  return (
    <div className="min-h-screen bg-[#090b0e] flex flex-col md:py-6 items-center select-none font-sans">
      <div className="w-full max-w-md bg-[#121418] border border-slate-800/80 md:rounded-[36px] shadow-2xl overflow-hidden min-h-screen md:min-h-[840px] flex flex-col relative">
        <div className="bg-[#090b0e] text-slate-400 text-[10px] font-mono px-6 py-1.5 shrink-0 flex justify-between select-none items-center border-b border-slate-900/45">
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
              onClose={() => setIsSideMenuOpen(false)}
              onLeaveTrip={handleLeaveTrip}
              onAdminTools={() => setActiveTab('members')}
            />
          </>
        )}

        <div className={`flex-1 flex flex-col overflow-y-auto no-scrollbar select-text bg-[#121418] ${
          activeTrip && currentMember && currentMember.status === 'approved' ? 'mb-16' : ''
        }`}>
          {!isSupabaseConfigured && renderCenteredMessage(
            'Supabase is not configured',
            'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local, then run the Phase 1 migration.'
          )}

          {isSupabaseConfigured && isBootstrapping && renderCenteredMessage(
            'Loading SaiHat',
            'Restoring your trip access from this browser.'
          )}

          {isSupabaseConfigured && !isBootstrapping && appError && !activeTrip && renderCenteredMessage(
            'Could not restore trip access',
            appError
          )}

          {isSupabaseConfigured && !isBootstrapping && !activeTrip && !isCreatingTripView && (
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
                  className="w-full bg-indigo-600 hover:bg-[#5334f5] text-white font-bold py-3 px-4 rounded-xl text-xs transition-colors mt-1.5 flex items-center justify-center gap-1 cursor-pointer"
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

          {isSupabaseConfigured && !isBootstrapping && isCreatingTripView && !activeTrip && (
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
                </div>

                <button
                  type="submit"
                  id="btn-create-trip-submit"
                  className="w-full bg-indigo-600 hover:bg-[#5334f5] text-white font-bold py-3 px-4 rounded-xl text-xs transition-colors mt-2 text-center cursor-pointer"
                >
                  Create Trip
                </button>
              </form>
            </div>
          )}

          {activeTrip && currentMember && currentMember.status === 'pending' && (
            <div className="px-6 py-8 flex flex-col justify-center items-center text-center gap-5 flex-1 animate-fade-in bg-[#121418]">
              <div className="w-16 h-16 bg-amber-950/40 text-amber-500 rounded-full border border-amber-900/40 flex items-center justify-center">
                <Clock className="w-8 h-8 stroke-[2.5]" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white font-display">Access pending</h1>
                <p id="pending-screen-msg" className="text-xs text-slate-400 mt-2 max-w-xs leading-relaxed">
                  Your request to join <strong>{activeTrip.name}</strong> as <strong>{currentMember.display_name}</strong> is waiting for admin approval.
                </p>
              </div>
              <button
                id="btn-pending-back-landing"
                onClick={handleLeaveTrip}
                className="w-full max-w-xs bg-[#1a1d23] hover:bg-[#20242b] text-slate-300 font-bold border border-slate-800 py-3 rounded-xl text-xs cursor-pointer"
              >
                Leave trip
              </button>
            </div>
          )}

          {activeTrip && currentMember && currentMember.status === 'rejected' && (
            <div className="px-6 py-8 flex flex-col justify-center items-center text-center gap-5 flex-1 animate-fade-in bg-[#121418]">
              <div className="w-16 h-16 bg-rose-950/30 text-rose-500 rounded-full border border-rose-900/30 flex items-center justify-center">
                <X className="w-8 h-8 stroke-[2.5]" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white font-display">Access rejected</h1>
                <p className="text-xs text-slate-400 mt-2 max-w-xs leading-relaxed">
                  Your request to join <strong>{activeTrip.name}</strong> was rejected by an admin.
                </p>
              </div>
              <button
                id="btn-rejected-leave-trip"
                onClick={handleLeaveTrip}
                className="w-full max-w-xs bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-bold py-3 rounded-xl text-xs cursor-pointer"
              >
                Exit Workspace
              </button>
            </div>
          )}

          {activeTrip && currentMember && currentMember.status === 'removed' && (
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
              <button
                id="btn-removed-leave-trip"
                onClick={handleLeaveTrip}
                className="w-full max-w-xs bg-[#1a1d23] hover:bg-[#20242b] border border-slate-800 text-slate-200 font-bold py-3 rounded-xl text-xs cursor-pointer"
              >
                Exit Workspace
              </button>
            </div>
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
                    expenses={[]}
                    splits={[]}
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
                    expenses={[]}
                    splits={[]}
                    members={tripMembers}
                    onCreateExpense={handleUnavailableExpenseAction}
                    onUpdateExpense={handleUnavailableExpenseAction}
                    onDeleteExpense={handleUnavailableExpenseAction}
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
                    expenses={[]}
                    splits={[]}
                    members={tripMembers}
                    settlements={[]}
                    onMarkSettlementPaid={handleUnavailableExpenseAction}
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
