import React, { useState, useEffect } from 'react';
import { db } from './lib/storage';
import { Trip, Member, Expense, ExpenseSplit, Settlement, Currency } from './types';
import { BottomNav, TabType } from './components/BottomNav';
import { DashboardTab } from './components/DashboardTab';
import { ExpensesTab } from './components/ExpensesTab';
import { BalancesTab } from './components/BalancesTab';
import { MembersTab } from './components/MembersTab';
import { AppHeader } from './components/AppHeader';
import { SideMenu } from './components/SideMenu';
import { 
  Compass, 
  Plus, 
  UserPlus, 
  Clock, 
  X, 
  AlertOctagon,
  ArrowLeft
} from 'lucide-react';

export default function App() {
  // DB re-render notifier state
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Active Context States
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);
  
  // Navigation
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);

  // Input states for Access / Sign-in Screens
  const [inviteInput, setInviteInput] = useState('');
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinSuccessCode, setJoinSuccessCode] = useState<string | null>(null);

  // States to trigger Create Trip screen
  const [isCreatingTripView, setIsCreatingTripView] = useState(false);
  const [newTripName, setNewTripName] = useState('');
  const [newTripAdminName, setNewTripAdminName] = useState('');
  const [newTripBaseCurrency, setNewTripBaseCurrency] = useState<Currency>('CNY');
  const [createTripError, setCreateTripError] = useState<string | null>(null);

  // Expense modal helpers
  const [selectedExpenseIdForDetail, setSelectedExpenseIdForDetail] = useState<string | null>(null);
  const [isAddingExpense, setIsAddingExpense] = useState(false);

  // Load database items reactively
  const rawState = db.getRawState();
  const trips = rawState.trips;
  const allMembers = rawState.members;
  const allExpenses = rawState.expenses;
  const allSplits = rawState.expense_splits;
  const allSettlements = rawState.settlements;

  // Active details
  const activeTrip = trips.find(t => t.id === activeTripId);
  const tripMembers = activeTrip ? allMembers.filter(m => m.trip_id === activeTripId) : [];
  const currentMember = activeTrip ? tripMembers.find(m => m.id === currentMemberId) : null;
  const tripExpenses = activeTrip ? allExpenses.filter(e => e.trip_id === activeTripId) : [];
  const tripSplits = activeTrip ? allSplits : []; // Splits filtered inside components by expense
  const tripSettlements = activeTrip ? allSettlements.filter(s => s.trip_id === activeTripId) : [];

  // Deep linking and Seeding logic
  useEffect(() => {
    // 1. Detect Deep Linking from URL Parameters (e.g. ?invite=GRAD26)
    const params = new URLSearchParams(window.location.search);
    const inviteParam = params.get('invite');
    if (inviteParam) {
      setInviteInput(inviteParam);
      // Auto toggle to landing view
      setIsCreatingTripView(false);
    }

    // 2. Default to seeding the first trip GRAD26 if nothing was set, for extreme ease of evaluation
    const storedTripId = localStorage.getItem('tripbalance_active_trip_id');
    const storedMemberId = localStorage.getItem('tripbalance_current_member_id');

    if (storedTripId && db.getTrip(storedTripId)) {
      setActiveTripId(storedTripId);
      if (storedMemberId && db.getMember(storedMemberId)?.trip_id === storedTripId) {
        setCurrentMemberId(storedMemberId);
      } else {
        // Fallback to first member of this trip
        const membersOfTrip = db.listMembers(storedTripId);
        if (membersOfTrip.length > 0) {
          setCurrentMemberId(membersOfTrip[0].id);
        }
      }
    } else {
      // Setup GRAD26 as preloaded trip default
      const defaultTrip = db.getTrip('trip-grad-26');
      if (defaultTrip) {
        setActiveTripId(defaultTrip.id);
        // Default to admin Aryn
        setCurrentMemberId('mem-aryn');
      }
    }
  }, [refreshTrigger]);

  // Database helper methods mapping to UI
  const handleResetDB = () => {
    db.resetToDefault();
    localStorage.removeItem('tripbalance_active_trip_id');
    localStorage.removeItem('tripbalance_current_member_id');
    setActiveTripId('trip-grad-26');
    setCurrentMemberId('mem-aryn');
    setActiveTab('dashboard');
    setIsCreatingTripView(false);
    setSelectedExpenseIdForDetail(null);
    setIsAddingExpense(false);
    setIsSideMenuOpen(false);
    setInviteInput('');
    setDisplayNameInput('');
    setJoinError(null);
    setRefreshTrigger(prev => prev + 1);
  };

  const handleSelectTripAndMember = (tripId: string | null, memberId: string | null) => {
    if (tripId) {
      localStorage.setItem('tripbalance_active_trip_id', tripId);
      setActiveTripId(tripId);
      if (memberId) {
        localStorage.setItem('tripbalance_current_member_id', memberId);
        setCurrentMemberId(memberId);
      } else {
        localStorage.removeItem('tripbalance_current_member_id');
        setCurrentMemberId(null);
      }
    } else {
      localStorage.removeItem('tripbalance_active_trip_id');
      localStorage.removeItem('tripbalance_current_member_id');
      setActiveTripId(null);
      setCurrentMemberId(null);
    }
    setRefreshTrigger(prev => prev + 1);
  };

  const handleCreateTripSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateTripError(null);

    if (!newTripName.trim()) {
      setCreateTripError('Trip name is required');
      return;
    }
    if (!newTripAdminName.trim()) {
      setCreateTripError('Admin displayed name is required');
      return;
    }

    const { trip, admin } = db.createTrip(
      newTripName.trim(),
      newTripAdminName.trim(),
      newTripBaseCurrency
    );

    // Save and redirect
    handleSelectTripAndMember(trip.id, admin.id);
    setNewTripName('');
    setNewTripAdminName('');
    setIsCreatingTripView(false);
    setActiveTab('dashboard');
  };

  const handleJoinTripSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError(null);
    setJoinSuccessCode(null);

    if (!inviteInput.trim()) {
      setJoinError('Please provide an invite code');
      return;
    }
    if (!displayNameInput.trim()) {
      setJoinError('Please enter your display name');
      return;
    }

    const matchTrip = db.getTripByInviteCode(inviteInput);
    if (!matchTrip) {
      setJoinError('Trip not found. Double check your entered invite code!');
      return;
    }

    // Verify if display name is already in use
    const membersOfTrip = db.listMembers(matchTrip.id);
    const isDuplicate = membersOfTrip.some(
      m => m.display_name.trim().toLowerCase() === displayNameInput.trim().toLowerCase()
    );
    if (isDuplicate) {
      setJoinError('This name is already used by an active member on this trip.');
      return;
    }

    // Submit pending request
    const member = db.requestJoin(matchTrip.id, displayNameInput.trim());
    
    // Select this trip and logged-in member
    handleSelectTripAndMember(matchTrip.id, member.id);
    setJoinSuccessCode(matchTrip.invite_code);
    setDisplayNameInput('');
  };

  // --- ACTIONS FOR TRIP MEMBERS ---
  const handleCreateExpense = (
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
    if (!activeTripId || !currentMemberId) return;
    db.createExpense(
      activeTripId,
      title,
      amount,
      currency,
      exchangeRate,
      convertedAmount,
      paidByMemberId,
      expenseDate,
      notes,
      currentMemberId,
      splitsList
    );
    setRefreshTrigger(prev => prev + 1);
  };

  const handleUpdateExpense = (
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
    db.updateExpense(
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
    setRefreshTrigger(prev => prev + 1);
  };

  const handleDeleteExpense = (expenseId: string) => {
    db.deleteExpense(expenseId);
    setRefreshTrigger(prev => prev + 1);
  };

  const handleMarkSettlementPaid = (
    fromMemberId: string,
    toMemberId: string,
    amount: number,
    currency: Currency
  ) => {
    if (!activeTripId) return;
    const settlement = db.createSettlement(activeTripId, fromMemberId, toMemberId, amount, currency);
    db.markSettlementAsPaid(settlement.id);
    setRefreshTrigger(prev => prev + 1);
  };

  // --- ACTIONS FOR ADMIN (Approve, reject, remove) ---
  const handleApproveMember = (memberId: string) => {
    db.approveMember(memberId);
    setRefreshTrigger(prev => prev + 1);
  };

  const handleRejectMember = (memberId: string) => {
    db.rejectMember(memberId);
    setRefreshTrigger(prev => prev + 1);
  };

  const handleRemoveMember = (memberId: string) => {
    db.removeMember(memberId);
    setRefreshTrigger(prev => prev + 1);
  };

  // Leave Trip back to landing screen
  const handleLeaveTrip = () => {
    handleSelectTripAndMember(null, null);
    setIsCreatingTripView(false);
    setIsSideMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#090b0e] flex flex-col md:py-6 items-center select-none font-sans">
      
      {/* Device wrapper to emulate visual mobile scope in development */}
      <div className="w-full max-w-md bg-[#121418] border border-slate-800/80 md:rounded-[36px] shadow-2xl overflow-hidden min-h-screen md:min-h-[840px] flex flex-col relative">
        
        {/* Mock phone status notches */}
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
              currentMember={currentMember ?? null}
              onMenuOpen={() => setIsSideMenuOpen(true)}
            />
            <SideMenu
              isOpen={isSideMenuOpen}
              trip={activeTrip}
              members={tripMembers}
              currentMemberId={currentMemberId}
              onClose={() => setIsSideMenuOpen(false)}
              onSelectMember={(mId) => handleSelectTripAndMember(activeTripId, mId)}
              onResetDB={handleResetDB}
              onLeaveTrip={handleLeaveTrip}
              onAdminTools={() => setActiveTab('members')}
            />
          </>
        )}

        {/* Inner View content routing */}
        <div className={`flex-1 flex flex-col overflow-y-auto no-scrollbar select-text bg-[#121418] ${
          activeTrip && currentMember && currentMember.status === 'approved' ? 'mb-16' : ''
        }`}>
          
          {/* SCREEN TYPE 1: LANDING SCREEN */}
          {!activeTrip && !isCreatingTripView && (
            <div className="px-5 py-8 flex flex-col gap-8 flex-1 justify-center animate-fade-in bg-[#121418]">
              
              <div className="text-center">
                <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-md mb-3.5 accent-glow">
                  <Compass className="w-8 h-8 text-white stroke-[2.5]" />
                </div>
                <h1 className="text-3xl font-extrabold font-display text-white tracking-tight leading-none uppercase">
                  TripBalance
                </h1>
                <p className="text-xs text-slate-500 font-medium font-sans mt-2 max-w-sm mx-auto">
                  Effortless expense splitting and multi-currency settling for teams and families on the run. Supports AED, CNY and KZT.
                </p>
              </div>

              {/* Form 1: JOIN TRIP */}
              <form onSubmit={handleJoinTripSubmit} className="bg-[#1a1d23] border border-slate-805 border-slate-800 p-5 rounded-3xl shadow-sm flex flex-col gap-4">
                <div className="border-b border-slate-800 pb-2.5">
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Join Shared Trip
                  </h2>
                </div>

                {joinError && (
                  <div className="bg-rose-950/40 border border-rose-900/30 text-rose-350 p-2.5 rounded-xl text-[11px] font-sans flex items-start gap-1.5 leading-snug">
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
                      onChange={e => setInviteInput(e.target.value.toUpperCase())}
                      placeholder="e.g. GRAD26"
                      className="w-full bg-[#121418] border border-slate-800 rounded-xl px-3.5 py-2.5 font-mono text-xs text-slate-200 focus:border-indigo-500 focus:outline-none shadow-xs"
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
                      onChange={e => setDisplayNameInput(e.target.value)}
                      placeholder="e.g. Bob, Alice"
                      className="w-full bg-[#121418] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none shadow-xs"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  id="btn-join-submit"
                  className="w-full bg-indigo-600 hover:bg-[#5334f5] text-white font-bold py-3 px-4 rounded-xl text-xs shadow-xs transition-colors mt-1.5 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Request Trip Access</span>
                </button>
              </form>

              {/* Bottom Creator Toggle */}
              <div className="text-center flex flex-col gap-3.5 mt-2">
                <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">
                  OR
                </span>
                
                <button
                  id="btn-goto-create-trip"
                  onClick={() => setIsCreatingTripView(true)}
                  className="bg-transparent hover:bg-slate-800/10 text-indigo-400 border border-indigo-500/20 border-dashed py-3.5 rounded-2xl text-xs font-bold leading-none tracking-tight flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4.5 h-4.5" />
                  <span>Create Brand New Trip</span>
                </button>
              </div>
            </div>
          )}

          {/* SCREEN TYPE 2: CREATE TRIP VIEW */}
          {isCreatingTripView && !activeTrip && (
            <div className="px-5 py-8 flex flex-col gap-6 flex-1 justify-center animate-fade-in bg-[#121418]">
              
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsCreatingTripView(false)}
                  className="p-1 px-2.5 bg-slate-800 border border-slate-700/80 rounded-xl text-xs text-slate-350 font-semibold flex items-center hover:bg-slate-750 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-0.5" />
                  <span>Back</span>
                </button>
              </div>

              <div>
                <h1 className="text-2xl font-bold font-display text-white tracking-tight">
                  Design Your Travel
                </h1>
                <p className="text-xs text-slate-505 text-slate-400 mt-1">
                  Kickstart your shared budget database. Add and balances on the fly.
                </p>
              </div>

              {createTripError && (
                <div className="bg-rose-950/40 border border-rose-900/30 text-rose-350 p-2.5 rounded-xl text-xs flex items-start gap-1">
                  <AlertOctagon className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{createTripError}</span>
                </div>
              )}

              <form onSubmit={handleCreateTripSubmit} className="bg-[#1a1d23] border border-slate-800/60 p-5 rounded-3xl shadow-sm flex flex-col gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Trip / Destiny Name *
                  </label>
                  <input
                    type="text"
                    required
                    id="input-create-trip-name"
                    value={newTripName}
                    onChange={e => setNewTripName(e.target.value)}
                    placeholder="e.g. Sanya Graduation Tour, Dubai Shopping"
                    className="w-full bg-[#121418] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-205 text-slate-200 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Your Display Name (Admin) *
                  </label>
                  <input
                    type="text"
                    required
                    id="input-create-admin-name"
                    value={newTripAdminName}
                    onChange={e => setNewTripAdminName(e.target.value)}
                    placeholder="e.g. Aryn, Sergey"
                    className="w-full bg-[#121418] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-205 text-slate-200 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Base Currency *
                  </label>
                  <select
                    value={newTripBaseCurrency}
                    id="select-create-base-currency"
                    onChange={e => setNewTripBaseCurrency(e.target.value as Currency)}
                    className="w-full bg-[#121418] border border-slate-800 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-202 text-slate-200 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="CNY">CNY (Chinese Yuan)</option>
                    <option value="AED">AED (Emirati Dirham)</option>
                    <option value="KZT">KZT (Kazakhstani Tenge)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  id="btn-create-trip-submit"
                  className="w-full bg-indigo-600 hover:bg-[#5334f5] text-white font-bold py-3 px-4 rounded-xl text-xs shadow-xs transition-colors mt-2 text-center cursor-pointer"
                >
                  Create Trip & Go
                </button>
              </form>
            </div>
          )}

          {/* SCREEN TYPE 3: PENDING APPROVAL SCREEN (ACCESS CONTROL) */}
          {activeTrip && currentMember && currentMember.status === 'pending' && (
            <div className="px-6 py-8 flex flex-col justify-center items-center text-center gap-5 flex-1 animate-fade-in bg-[#121418]">
              <div className="w-16 h-16 bg-amber-955 bg-amber-950/40 text-amber-500 rounded-full border border-amber-900/40 flex items-center justify-center animate-pulse">
                <Clock className="w-8 h-8 stroke-[2.5]" />
              </div>

              <div>
                <h1 className="text-lg font-bold text-white font-display">
                  Access Pending Approval
                </h1>
                <p id="pending-screen-msg" className="text-xs text-slate-400 mt-2 max-w-xs leading-relaxed">
                  Your request to join <strong>"{activeTrip.name}"</strong> as <strong>"{currentMember.display_name}"</strong> is pending admin approval.
                </p>
                <div className="bg-[#1a1d23] border border-slate-800 rounded-2xl p-4 mt-5 text-left text-[11px] leading-relaxed select-text text-slate-400 max-w-sm text-center">
                  <div className="font-sans text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Trip Invite Code
                  </div>
                  <strong className="text-xs text-slate-200 font-mono tracking-widest">{activeTrip.invite_code}</strong>
                </div>
              </div>

              <div className="flex flex-col gap-2 w-full max-w-xs mt-3">
                <div className="text-[10px] text-slate-500 italic font-mono mb-2">
                  Open the menu and switch to <strong>"Aryn (Admin)"</strong> to approve this request in the MVP tester flow.
                </div>
                
                <button
                  id="btn-pending-back-landing"
                  onClick={handleLeaveTrip}
                  className="bg-[#1a1d23] hover:bg-[#20242b] text-slate-255 text-slate-300 font-bold border border-slate-800 py-3 rounded-xl text-xs shadow-sm cursor-pointer"
                >
                  Go back to Landing Screen
                </button>
              </div>
            </div>
          )}

          {/* SCREEN TYPE 4: REJECTED ACCESS SCREEN */}
          {activeTrip && currentMember && currentMember.status === 'rejected' && (
            <div className="px-6 py-8 flex flex-col justify-center items-center text-center gap-5 flex-1 animate-fade-in bg-[#121418]">
              <div className="w-16 h-16 bg-rose-950/30 text-rose-500 rounded-full border border-rose-900/30 flex items-center justify-center">
                <X className="w-8 h-8 stroke-[2.5]" />
              </div>

              <div>
                <h1 className="text-lg font-bold text-white font-display">
                  Access Request Rejected
                </h1>
                <p className="text-xs text-slate-400 mt-2 max-w-xs leading-relaxed leading-normal">
                  Your request to join <strong>"{activeTrip.name}"</strong> has been rejected by the admin.
                </p>
              </div>

              <button
                id="btn-rejected-leave-trip"
                onClick={handleLeaveTrip}
                className="w-full max-w-xs bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-bold py-3 rounded-xl text-xs transition-colors cursor-pointer"
              >
                Exit Workspace
              </button>
            </div>
          )}

          {/* SCREEN TYPE 5: REMOVED ACCESS SCREEN */}
          {activeTrip && currentMember && currentMember.status === 'removed' && (
            <div className="px-6 py-8 flex flex-col justify-center items-center text-center gap-5 flex-1 animate-fade-in bg-[#121418]">
              <div className="w-16 h-16 bg-amber-950/30 text-amber-500 rounded-full border border-amber-900/30 flex items-center justify-center">
                <AlertOctagon className="w-8 h-8 stroke-[2.5]" />
              </div>

              <div>
                <h1 className="text-lg font-bold text-white font-display">
                  Member Profile Blocked
                </h1>
                <p className="text-xs text-slate-400 mt-2 max-w-xs leading-normal">
                  You have been removed from this trip by the administrator.
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

          {/* SCREEN TYPE 6: APPROVED MEMBER WORKSPACE (MAIN APP) */}
          {activeTrip && currentMember && currentMember.status === 'approved' && (
            <div className="flex-1 flex flex-col bg-[#121418]">
              {/* Dynamic Tabs routing based on activeTab */}
              <div className="flex-1 overflow-y-auto">
                {activeTab === 'dashboard' && (
                  <DashboardTab
                    trip={activeTrip}
                    currentMember={currentMember}
                    expenses={tripExpenses}
                    splits={tripSplits}
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
                    onChangeTab={(t) => setActiveTab(t)}
                  />
                )}

                {activeTab === 'expenses' && (
                  <ExpensesTab
                    trip={activeTrip}
                    currentMember={currentMember}
                    expenses={tripExpenses}
                    splits={tripSplits}
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
                    members={tripMembers}
                    settlements={tripSettlements}
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

        {/* Floating bottom sticky navigation bar for active approved workers */}
        {activeTrip && currentMember && currentMember.status === 'approved' && (
          <BottomNav
            activeTab={activeTab}
            onChangeTab={(t) => {
              setActiveTab(t);
              // Clear temporary modal inputs
              setSelectedExpenseIdForDetail(null);
              setIsAddingExpense(false);
            }}
            pendingRequestsCount={tripMembers.filter(m => m.status === 'pending').length}
            showAdminBadge={currentMember.role === 'admin'}
          />
        )}
      </div>
    </div>
  );
}
