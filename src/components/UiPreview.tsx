import React, { useCallback, useMemo, useState } from 'react';
import { AppHeader } from './AppHeader';
import { AccountSecuritySheet } from './AccountSecuritySheet';
import { BalancesTab } from './BalancesTab';
import { BottomNav, TabType } from './BottomNav';
import { ExpensesTab } from './ExpensesTab';
import { MemberBreakdownSheet } from './MemberBreakdownSheet';
import { MembersTab } from './MembersTab';
import { OverviewTab } from './OverviewTab';
import { SideMenu } from './SideMenu';
import {
  WorkspaceSettingsSheet,
  type WorkspaceSettingsMode,
} from './WorkspaceSettingsSheet';
import { DesktopWorkspaceRail } from './DesktopWorkspaceRail';
import { DesktopContextRail } from './DesktopContextRail';
import { ExchangeRatesSheet } from './ExchangeRatesSheet';
import { GuidedTour, type GuidedTourStep } from './GuidedTour';
import { JoinGroupView } from './JoinGroupView';
import { createUiPreviewWorkspace } from '../lib/uiPreviewData';
import type { WorkspaceSummary } from '../lib/tripRepository';
import {
  calculateOpenMemberBalances,
  calculateSettlementRecommendations,
} from '../lib/calculations';
import {
  normalizeInviteCode,
  readInviteCodeFromSearch,
  removeInviteFromUrl,
} from '../lib/inviteLinks';
import type {
  AccountAccess,
  Currency,
  ExchangeRate,
  Expense,
  ExpenseSplit,
  Member,
  Settlement,
  TripClosureVote,
} from '../types';

type ExpenseTabProps = React.ComponentProps<typeof ExpensesTab>;
type BalanceTabProps = React.ComponentProps<typeof BalancesTab>;
type MembersTabProps = React.ComponentProps<typeof MembersTab>;

const nowIso = () => new Date().toISOString();

type PreviewScenario =
  | 'active-open'
  | 'active-settled'
  | 'closing-voted'
  | 'closing-final'
  | 'closed';

const getPreviewScenario = (): PreviewScenario => {
  const requestedScenario = new URLSearchParams(window.location.search).get('scenario');
  return [
    'active-open',
    'active-settled',
    'closing-voted',
    'closing-final',
    'closed',
  ].includes(requestedScenario ?? '')
    ? requestedScenario as PreviewScenario
    : 'active-open';
};

const createPreviewClosureVote = (
  tripId: string,
  memberId: string,
  index: number,
): TripClosureVote => ({
  id: `preview-closure-vote-${index + 1}`,
  trip_id: tripId,
  member_id: memberId,
  approved_at: nowIso(),
});

const createScenarioWorkspace = () => {
  const baseWorkspace = createUiPreviewWorkspace();
  const scenario = getPreviewScenario();
  const trip = baseWorkspace.trip!;
  const approvedMembers = baseWorkspace.members.filter(member => member.status === 'approved');

  if (scenario === 'active-open') return baseWorkspace;

  const openBalances = calculateOpenMemberBalances(
    baseWorkspace.expenses,
    baseWorkspace.splits,
    [],
    approvedMembers,
  );
  const settlementRecommendations = calculateSettlementRecommendations(
    openBalances,
    [],
    trip.base_currency,
  );
  const settlements: Settlement[] = settlementRecommendations.map((recommendation, index) => ({
    id: `preview-closeout-settlement-${index + 1}`,
    trip_id: trip.id,
    from_member_id: recommendation.from_member_id,
    to_member_id: recommendation.to_member_id,
    amount: recommendation.amount,
    currency: trip.base_currency,
    status: 'paid',
    created_by_member_id: approvedMembers[0]?.id,
    paid_confirmed_by_member_id: approvedMembers[0]?.id,
    created_at: nowIso(),
    paid_at: nowIso(),
  }));

  if (scenario === 'active-settled') {
    return { ...baseWorkspace, settlements };
  }

  const isFinalApproverScenario = scenario === 'closing-final';
  const currentMember = isFinalApproverScenario
    ? approvedMembers[approvedMembers.length - 1] ?? baseWorkspace.currentMember
    : baseWorkspace.currentMember;
  const voteMembers = scenario === 'closed'
    ? approvedMembers
    : isFinalApproverScenario
      ? approvedMembers.slice(0, -1)
      : approvedMembers.slice(0, 2);
  const closureVotes = voteMembers.map((member, index) => (
    createPreviewClosureVote(trip.id, member.id, index)
  ));

  return {
    ...baseWorkspace,
    trip: {
      ...trip,
      status: scenario === 'closed' ? 'closed' as const : 'closing' as const,
      closed_at: scenario === 'closed' ? nowIso() : undefined,
    },
    currentMember,
    settlements,
    closureVotes,
  };
};

export const JoinPreview: React.FC = () => {
  const initialInviteCode = readInviteCodeFromSearch(window.location.search) ?? '';
  const [inviteCode, setInviteCode] = useState(initialInviteCode);
  const [displayName, setDisplayName] = useState('');
  const [isInviteLinkPrefilled, setIsInviteLinkPrefilled] = useState(Boolean(initialInviteCode));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleInviteCodeChange = (value: string) => {
    setInviteCode(value.toUpperCase());
    setIsInviteLinkPrefilled(false);
    setError(null);
    window.history.replaceState(
      window.history.state,
      '',
      removeInviteFromUrl(window.location.href),
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    const normalizedCode = normalizeInviteCode(inviteCode);
    if (!normalizedCode || !displayName.trim()) return;

    setInviteCode(normalizedCode);
    setError(null);
    setIsSubmitting(true);
    await new Promise(resolve => window.setTimeout(resolve, 350));

    if (normalizedCode !== 'PARITE') {
      setError('This invite link or code is invalid or no longer active.');
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    setIsPending(true);
  };

  return (
    <div className="h-[100dvh] overflow-hidden bg-[var(--color-page-background)] font-sans md:p-6">
      <div className="parite-shell mx-auto flex h-full w-full max-w-3xl flex-col overflow-y-auto border border-[var(--color-border)] bg-[var(--color-app-background)] shadow-2xl md:rounded-[36px]">
        {isPending ? (
          <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-5 py-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-positive-soft)] text-2xl text-[var(--color-positive)]">
              ✓
            </span>
            <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-positive)]">
              Request sent
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold text-[var(--color-text)]">
              Waiting for admin approval
            </h1>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--color-muted)]">
              Your request to join with code <span className="font-mono font-bold">{inviteCode}</span> is pending.
              You will get access after a group admin approves it.
            </p>
            <button
              type="button"
              id="btn-join-preview-reset"
              onClick={() => {
                setIsPending(false);
                setInviteCode('');
                setDisplayName('');
                setIsInviteLinkPrefilled(false);
              }}
              className="mt-6 min-h-11 rounded-2xl border border-[var(--color-border)] bg-white px-5 text-xs font-bold text-[var(--color-positive)]"
            >
              Try manual code
            </button>
          </div>
        ) : (
          <JoinGroupView
            inviteCode={inviteCode}
            displayName={displayName}
            isInviteLinkPrefilled={isInviteLinkPrefilled}
            isSubmitting={isSubmitting}
            submitDisabled={!inviteCode.trim() || !displayName.trim()}
            error={error}
            accountContext={(
              <div className="mx-auto flex w-full max-w-sm items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-white px-3 py-2">
                <span className="truncate text-[10px] text-[var(--color-muted)]">mira@example.com</span>
                <span className="text-[10px] font-bold text-[var(--color-positive)]">Preview account</span>
              </div>
            )}
            onInviteCodeChange={handleInviteCodeChange}
            onDisplayNameChange={(value) => {
              setDisplayName(value);
              setError(null);
            }}
            onSubmit={handleSubmit}
            onBack={() => window.location.assign('/?preview=ui')}
          />
        )}
      </div>
    </div>
  );
};

export const UiPreview: React.FC = () => {
  const [workspace, setWorkspace] = useState(createScenarioWorkspace);
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const requestedTab = new URLSearchParams(window.location.search).get('tab');
    return ['overview', 'expenses', 'balances', 'members'].includes(requestedTab ?? '')
      ? requestedTab as TabType
      : 'overview';
  });
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);
  const [isWorkspaceSettingsOpen, setIsWorkspaceSettingsOpen] = useState(false);
  const [workspaceSettingsMode, setWorkspaceSettingsMode] = useState<WorkspaceSettingsMode>('settings');
  const [isExchangeRatesOpen, setIsExchangeRatesOpen] = useState(false);
  const [isAccountSecurityOpen, setIsAccountSecurityOpen] = useState(false);
  const [isGuidedTourOpen, setIsGuidedTourOpen] = useState(() => (
    new URLSearchParams(window.location.search).get('tour') === '1'
  ));
  const [previewEmail] = useState('mira@example.com');
  const [previewPendingEmail, setPreviewPendingEmail] = useState<string | null>(null);
  const [selectedBreakdownMemberId, setSelectedBreakdownMemberId] = useState<string | null>(null);
  const [membersInitialCategory, setMembersInitialCategory] = useState<'approved' | 'requests' | 'removed'>('approved');
  const [previewAccountRequests, setPreviewAccountRequests] = useState<AccountAccess[]>(() => [{
    user_id: 'preview-account-sami',
    email: 'sami@example.com',
    role: 'user',
    status: 'pending',
    created_at: nowIso(),
    updated_at: nowIso(),
  }]);

  const trip = workspace.trip!;
  const currentMember = workspace.currentMember!;
  const closeoutBlockers = useMemo(() => {
    if ((trip.status ?? 'active') === 'closed') return [];

    const approvedMembers = workspace.members.filter(member => member.status === 'approved');
    const openBalances = calculateOpenMemberBalances(
      workspace.expenses,
      workspace.splits,
      workspace.settlements,
      approvedMembers,
    );

    return openBalances.some(balance => Math.abs(balance.net_balance) > 0.01)
      ? ['Open balances remain. Complete the recommended transfers before starting closeout.']
      : [];
  }, [
    trip.status,
    workspace.expenses,
    workspace.members,
    workspace.settlements,
    workspace.splits,
  ]);
  const previewWorkspaces: WorkspaceSummary[] = [
    {
      member_id: currentMember.id,
      trip_id: trip.id,
      trip_name: trip.name,
      base_currency: trip.base_currency,
      display_name: currentMember.display_name,
      role: currentMember.role,
      status: currentMember.status,
      trip_status: trip.status,
      display_currency: currentMember.display_currency ?? null,
      created_at: currentMember.created_at,
      approved_at: currentMember.approved_at,
    },
    {
      member_id: 'preview-member-china',
      trip_id: 'preview-group-china',
      trip_name: 'China Group',
      base_currency: 'CNY',
      display_name: 'Mira',
      role: 'member',
      status: 'approved',
      trip_status: 'active',
      display_currency: null,
      created_at: currentMember.created_at,
      approved_at: currentMember.approved_at,
    },
    {
      member_id: 'preview-member-family',
      trip_id: 'preview-group-family',
      trip_name: 'Family House',
      base_currency: 'AED',
      display_name: 'Mira',
      role: 'admin',
      status: 'approved',
      trip_status: 'active',
      display_currency: null,
      created_at: currentMember.created_at,
      approved_at: currentMember.approved_at,
    },
    {
      member_id: 'preview-member-almaty',
      trip_id: 'preview-group-almaty',
      trip_name: 'Weekend in Almaty',
      base_currency: 'KZT',
      display_name: 'Mira',
      role: 'member',
      status: 'approved',
      trip_status: 'active',
      display_currency: null,
      created_at: currentMember.created_at,
      approved_at: currentMember.approved_at,
    },
    {
      member_id: 'preview-member-conference',
      trip_id: 'preview-group-conference',
      trip_name: 'Conference Group',
      base_currency: 'USD',
      display_name: 'Mira',
      role: 'member',
      status: 'approved',
      trip_status: 'closed',
      display_currency: null,
      created_at: currentMember.created_at,
      approved_at: currentMember.approved_at,
    },
  ];
  const selectedBreakdownMember = useMemo(
    () => workspace.members.find(member => member.id === selectedBreakdownMemberId) ?? null,
    [selectedBreakdownMemberId, workspace.members]
  );
  const openWorkspaceSettings = useCallback((mode: WorkspaceSettingsMode) => {
    setWorkspaceSettingsMode(mode);
    setIsWorkspaceSettingsOpen(true);
  }, []);

  const changeTab = (tab: TabType) => {
    setActiveTab(tab);
    setSelectedExpenseId(null);
    setIsAddingExpense(false);
    setSelectedBreakdownMemberId(null);
  };

  const prepareGuidedTourStep = useCallback((step: GuidedTourStep) => {
    setSelectedExpenseId(null);
    setSelectedBreakdownMemberId(null);
    setIsAddingExpense(false);
    setIsAccountSecurityOpen(false);
    setIsWorkspaceSettingsOpen(false);
    setIsExchangeRatesOpen(false);
    setIsSideMenuOpen(
      step.id === 'groups' && !window.matchMedia('(min-width: 1024px)').matches,
    );

    if (step.id === 'settlements') {
      setActiveTab('balances');
    } else if (step.id === 'members') {
      setActiveTab('members');
    } else {
      setActiveTab('expenses');
    }
  }, []);

  const closeGuidedTour = useCallback(() => {
    setIsGuidedTourOpen(false);
    setIsSideMenuOpen(false);
    setIsWorkspaceSettingsOpen(false);
    setActiveTab('overview');
  }, []);

  const handleCreateExpense: ExpenseTabProps['onCreateExpense'] = async (
    title,
    amount,
    currency,
    exchangeRate,
    convertedAmount,
    paidByMemberId,
    expenseDate,
    notes,
    splitInputs,
    feeInput
  ) => {
    const expenseId = `preview-expense-${Date.now()}`;
    const createdAt = nowIso();
    const expense: Expense = {
      id: expenseId,
      trip_id: trip.id,
      title,
      amount,
      subtotal_amount: feeInput?.subtotal_amount ?? amount,
      fee_percent: feeInput?.fee_percent ?? 0,
      fee_amount: feeInput ? Math.max(0, amount - feeInput.subtotal_amount) : 0,
      fee_label: feeInput?.fee_label ?? null,
      currency,
      exchange_rate_to_base: exchangeRate,
      converted_amount: convertedAmount,
      paid_by_member_id: paidByMemberId,
      expense_date: expenseDate,
      notes,
      created_by_member_id: currentMember.id,
      created_at: createdAt,
      updated_at: createdAt,
    };
    const expenseSplits: ExpenseSplit[] = splitInputs.map((split, index) => ({
      id: `${expenseId}-split-${index}`,
      expense_id: expenseId,
      member_id: split.member_id,
      amount_owed: split.amount_owed,
      subtotal_amount_owed: split.subtotal_amount_owed,
      fee_amount_owed: split.fee_amount_owed,
    }));

    setWorkspace(previous => ({
      ...previous,
      expenses: [expense, ...previous.expenses],
      splits: [...expenseSplits, ...previous.splits],
    }));
  };

  const handleUpdateExpense: ExpenseTabProps['onUpdateExpense'] = async (
    expenseId,
    title,
    amount,
    currency,
    exchangeRate,
    convertedAmount,
    paidByMemberId,
    expenseDate,
    notes,
    splitInputs,
    feeInput
  ) => {
    const updatedAt = nowIso();
    const nextSplits: ExpenseSplit[] = splitInputs.map((split, index) => ({
      id: `${expenseId}-split-${index}`,
      expense_id: expenseId,
      member_id: split.member_id,
      amount_owed: split.amount_owed,
      subtotal_amount_owed: split.subtotal_amount_owed,
      fee_amount_owed: split.fee_amount_owed,
    }));

    setWorkspace(previous => ({
      ...previous,
      expenses: previous.expenses.map(expense => expense.id === expenseId ? {
        ...expense,
        title,
        amount,
        subtotal_amount: feeInput?.subtotal_amount ?? amount,
        fee_percent: feeInput?.fee_percent ?? 0,
        fee_amount: feeInput ? Math.max(0, amount - feeInput.subtotal_amount) : 0,
        fee_label: feeInput?.fee_label ?? null,
        currency,
        exchange_rate_to_base: exchangeRate,
        converted_amount: convertedAmount,
        paid_by_member_id: paidByMemberId,
        expense_date: expenseDate,
        notes,
        updated_at: updatedAt,
      } : expense),
      splits: [
        ...previous.splits.filter(split => split.expense_id !== expenseId),
        ...nextSplits,
      ],
    }));
  };

  const handleDeleteExpense: ExpenseTabProps['onDeleteExpense'] = async expenseId => {
    setWorkspace(previous => ({
      ...previous,
      expenses: previous.expenses.filter(expense => expense.id !== expenseId),
      splits: previous.splits.filter(split => split.expense_id !== expenseId),
    }));
    setSelectedExpenseId(null);
  };

  const handleMarkSettlementPaid: BalanceTabProps['onMarkSettlementPaid'] = async (
    fromMemberId,
    toMemberId,
    amount
  ) => {
    const createdAt = nowIso();
    const settlement: Settlement = {
      id: `preview-settlement-${Date.now()}`,
      trip_id: trip.id,
      from_member_id: fromMemberId,
      to_member_id: toMemberId,
      amount,
      currency: trip.base_currency,
      status: 'paid',
      created_by_member_id: currentMember.id,
      paid_confirmed_by_member_id: currentMember.id,
      created_at: createdAt,
      paid_at: createdAt,
    };
    setWorkspace(previous => ({
      ...previous,
      settlements: [settlement, ...previous.settlements],
    }));
  };

  const handleVoidSettlement: BalanceTabProps['onVoidSettlement'] = async settlementId => {
    setWorkspace(previous => ({
      ...previous,
      settlements: previous.settlements.map(settlement => settlement.id === settlementId
        ? { ...settlement, status: 'voided' as const, voided_at: nowIso(), voided_by_member_id: currentMember.id }
        : settlement),
    }));
  };

  const updateMember = (memberId: string, update: (member: Member) => Member) => {
    setWorkspace(previous => ({
      ...previous,
      members: previous.members.map(member => member.id === memberId ? update(member) : member),
    }));
  };

  const approveMember: MembersTabProps['onApproveMember'] = async memberId => {
    updateMember(memberId, member => ({ ...member, status: 'approved', approved_at: nowIso() }));
  };
  const rejectMember: MembersTabProps['onRejectMember'] = async memberId => {
    updateMember(memberId, member => ({ ...member, status: 'rejected' }));
  };
  const removeMember: MembersTabProps['onRemoveMember'] = async memberId => {
    updateMember(memberId, member => ({ ...member, status: 'removed', removed_at: nowIso() }));
  };
  const promoteMember: MembersTabProps['onPromoteMember'] = async memberId => {
    updateMember(memberId, member => ({ ...member, role: 'admin' }));
  };
  const demoteMember: MembersTabProps['onDemoteAdmin'] = async memberId => {
    updateMember(memberId, member => ({ ...member, role: 'member' }));
  };

  const handleStartPreviewCloseout = async () => {
    if (!workspace.trip || !workspace.currentMember) return;

    const approvedMembers = workspace.members.filter(member => member.status === 'approved');
    const openBalances = calculateOpenMemberBalances(
      workspace.expenses,
      workspace.splits,
      workspace.settlements,
      approvedMembers,
    );
    if (openBalances.some(balance => Math.abs(balance.net_balance) > 0.01)) {
      throw new Error('Settle every open balance before starting closeout.');
    }

    setWorkspace(previous => {
      if (!previous.trip || !previous.currentMember) return previous;

      return {
        ...previous,
        trip: { ...previous.trip, status: 'closing', closed_at: undefined },
        closureVotes: [
          createPreviewClosureVote(previous.trip.id, previous.currentMember.id, 0),
        ],
      };
    });
  };

  const handleApprovePreviewCloseout = async () => {
    setWorkspace(previous => {
      if (!previous.trip || !previous.currentMember || previous.trip.status !== 'closing') {
        return previous;
      }

      const approvedMembers = previous.members.filter(member => member.status === 'approved');
      const alreadyApproved = previous.closureVotes.some(vote => (
        vote.member_id === previous.currentMember?.id
      ));
      const closureVotes = alreadyApproved
        ? previous.closureVotes
        : [
          ...previous.closureVotes,
          createPreviewClosureVote(
            previous.trip.id,
            previous.currentMember.id,
            previous.closureVotes.length,
          ),
        ];
      const approvedMemberIds = new Set(approvedMembers.map(member => member.id));
      const validVoteCount = new Set(
        closureVotes
          .filter(vote => approvedMemberIds.has(vote.member_id))
          .map(vote => vote.member_id),
      ).size;
      const isClosed = validVoteCount === approvedMembers.length;

      return {
        ...previous,
        trip: {
          ...previous.trip,
          status: isClosed ? 'closed' : 'closing',
          closed_at: isClosed ? nowIso() : undefined,
        },
        closureVotes,
      };
    });
  };

  const handleCancelPreviewCloseout = async () => {
    setWorkspace(previous => ({
      ...previous,
      trip: previous.trip
        ? { ...previous.trip, status: 'active', closed_at: undefined }
        : previous.trip,
      closureVotes: [],
    }));
  };

  const handleUpdatePreviewRate = async (
    fromCurrency: Currency,
    toCurrency: Currency,
    rate: number,
  ) => {
    setWorkspace(previous => {
      if (!previous.trip || !previous.currentMember) return previous;

      const existingRate = previous.exchangeRates.find(item => (
        item.trip_id === previous.trip?.id
        && item.from_currency === fromCurrency
        && item.to_currency === toCurrency
      ));
      const nextRate: ExchangeRate = {
        id: existingRate?.id ?? `preview-rate-${fromCurrency}-${toCurrency}`,
        trip_id: previous.trip.id,
        from_currency: fromCurrency,
        to_currency: toCurrency,
        rate,
        updated_by_member_id: previous.currentMember.id,
        updated_at: nowIso(),
      };

      return {
        ...previous,
        exchangeRates: [
          ...previous.exchangeRates.filter(item => item.id !== nextRate.id),
          nextRate,
        ],
      };
    });
  };

  return (
    <div className="h-[100dvh] bg-[var(--color-page-background)] flex flex-col md:p-6 items-center font-sans overflow-hidden">
      <div className="mobile-prototype parite-shell relative flex h-[100dvh] w-full max-w-md flex-col overflow-hidden border border-[var(--color-border)] bg-[var(--color-app-background)] shadow-2xl md:h-[calc(100dvh-3rem)] md:max-w-3xl md:rounded-[36px] lg:max-w-[1536px]">
        <AccountSecuritySheet
          isOpen={isAccountSecurityOpen}
          currentEmail={previewEmail}
          pendingEmail={previewPendingEmail}
          onClose={() => setIsAccountSecurityOpen(false)}
          onChangeEmail={async (_currentPassword, nextEmail) => {
            setPreviewPendingEmail(nextEmail);
            return { currentEmail: previewEmail, pendingEmail: nextEmail };
          }}
          onChangePassword={async () => undefined}
        />
        <div className="lg:hidden">
          <AppHeader
            trip={trip}
            currentMember={currentMember}
            onMenuOpen={() => setIsSideMenuOpen(true)}
          />
        </div>

        <SideMenu
          isOpen={isSideMenuOpen}
          trip={trip}
          currentMember={currentMember}
          accountEmail={previewEmail}
          onAccountSettings={() => setIsAccountSecurityOpen(true)}
          onOpenWorkspaceSettings={() => openWorkspaceSettings('settings')}
          onOpenCloseout={() => openWorkspaceSettings('closeout')}
          onReplayGuidedTour={() => setIsGuidedTourOpen(true)}
          workspaces={previewWorkspaces}
          currentMemberId={currentMember.id}
          onClose={() => setIsSideMenuOpen(false)}
          onSwitchWorkspace={async () => setIsSideMenuOpen(false)}
          onCreateTrip={() => setIsSideMenuOpen(false)}
          onJoinTrip={() => setIsSideMenuOpen(false)}
          onLogout={() => setIsSideMenuOpen(false)}
        />

        <WorkspaceSettingsSheet
          isOpen={isWorkspaceSettingsOpen}
          mode={workspaceSettingsMode}
          trip={trip}
          currentMember={currentMember}
          members={workspace.members}
          closureVotes={workspace.closureVotes}
          closeoutBlockers={closeoutBlockers}
          onClose={() => setIsWorkspaceSettingsOpen(false)}
          onAdminTools={() => {
            setMembersInitialCategory('approved');
            changeTab('members');
          }}
          onReviewBalances={() => changeTab('balances')}
          onExchangeRates={() => setIsExchangeRatesOpen(true)}
          onUpdateTripName={async name => setWorkspace(previous => ({
            ...previous,
            trip: previous.trip ? { ...previous.trip, name } : previous.trip,
          }))}
          onUpdateDisplayCurrency={async displayCurrency => setWorkspace(previous => ({
            ...previous,
            currentMember: previous.currentMember
              ? { ...previous.currentMember, display_currency: displayCurrency }
              : previous.currentMember,
            members: previous.members.map(member => member.id === currentMember.id
              ? { ...member, display_currency: displayCurrency }
              : member),
          }))}
          onLeaveTrip={async () => undefined}
          onStartTripClosure={handleStartPreviewCloseout}
          onApproveTripClosure={handleApprovePreviewCloseout}
          onCancelTripClosure={handleCancelPreviewCloseout}
          onExportExpensesCsv={() => undefined}
          onExportBalancesCsv={() => undefined}
          onExportSettlementsCsv={() => undefined}
          exportBusy={null}
        />

        <ExchangeRatesSheet
          isOpen={isExchangeRatesOpen}
          trip={trip}
          currentMember={currentMember}
          members={workspace.members}
          exchangeRates={workspace.exchangeRates}
          canEdit={currentMember.role === 'admin' && trip.status === 'active'}
          onClose={() => setIsExchangeRatesOpen(false)}
          onUpdateRate={handleUpdatePreviewRate}
        />

        <BottomNav
          variant="desktop"
          activeTab={activeTab}
          onChangeTab={changeTab}
          pendingRequestsCount={previewAccountRequests.length}
          showAdminBadge
        />

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <DesktopWorkspaceRail
            trip={trip}
            currentMember={currentMember}
            workspaces={previewWorkspaces}
            currentMemberId={currentMember.id}
            activeTab={activeTab}
            onChangeTab={changeTab}
            pendingRequestsCount={previewAccountRequests.length}
            showAdminBadge
            onSwitchWorkspace={async () => undefined}
            onCreateTrip={() => undefined}
            onJoinTrip={() => undefined}
            onOpenSettings={() => openWorkspaceSettings('settings')}
            onOpenCloseout={() => openWorkspaceSettings('closeout')}
            onAccountSettings={() => setIsAccountSecurityOpen(true)}
            onReplayGuidedTour={() => setIsGuidedTourOpen(true)}
          />

          <main
            key={activeTab}
            aria-label={`${activeTab} workspace`}
            className={`flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--color-app-background)] mb-[calc(68px+env(safe-area-inset-bottom))] md:mb-0 ${
              activeTab === 'expenses' ? 'overflow-hidden' : 'no-scrollbar overflow-y-auto'
            }`}
          >
          {activeTab === 'overview' && (
            <OverviewTab
              trip={trip}
              currentMember={currentMember}
              expenses={workspace.expenses}
              splits={workspace.splits}
              settlements={workspace.settlements}
              exchangeRates={workspace.exchangeRates}
              members={workspace.members}
              pendingRequestsCount={previewAccountRequests.length}
              isReadOnly={trip.status !== 'active'}
              onAddExpense={() => {
                changeTab('expenses');
                setIsAddingExpense(true);
              }}
              onReviewBalances={() => changeTab('balances')}
              onManageMembers={() => {
                setMembersInitialCategory(previewAccountRequests.length > 0 ? 'requests' : 'approved');
                changeTab('members');
              }}
              onOpenExpense={(expenseId) => {
                changeTab('expenses');
                setSelectedExpenseId(expenseId);
              }}
            />
          )}

            {activeTab === 'expenses' && (
              <div className="flex h-full min-h-0 overflow-hidden">
                <div className="min-w-0 flex-1 overflow-hidden">
                  <ExpensesTab
                    trip={trip}
                    currentMember={currentMember}
                    expenses={workspace.expenses}
                    splits={workspace.splits}
                    settlements={workspace.settlements}
                    exchangeRates={workspace.exchangeRates}
                    members={workspace.members}
                    onCreateExpense={handleCreateExpense}
                    onUpdateExpense={handleUpdateExpense}
                    onDeleteExpense={handleDeleteExpense}
                    selectedExpenseIdForDetail={selectedExpenseId}
                    onSetSelectedExpenseId={setSelectedExpenseId}
                    isAddingExpense={isAddingExpense}
                    onSetAddingExpense={setIsAddingExpense}
                    isReadOnly={trip.status !== 'active'}
                  />
                </div>
                <div className="no-scrollbar hidden shrink-0 overflow-y-auto border-l border-[var(--color-border)] bg-white/45 px-4 py-5 xl:block">
                  <DesktopContextRail
                    trip={trip}
                    currentMember={currentMember}
                    expenses={workspace.expenses}
                    splits={workspace.splits}
                    settlements={workspace.settlements}
                    members={workspace.members}
                    exchangeRates={workspace.exchangeRates}
                    pendingRequestsCount={previewAccountRequests.length}
                    onReviewBalances={() => changeTab('balances')}
                    onManageMembers={() => {
                      setMembersInitialCategory(previewAccountRequests.length > 0 ? 'requests' : 'approved');
                      changeTab('members');
                    }}
                  />
                </div>
              </div>
            )}

          {activeTab === 'balances' && (
            <BalancesTab
              trip={trip}
              currentMember={currentMember}
              expenses={workspace.expenses}
              splits={workspace.splits}
              exchangeRates={workspace.exchangeRates}
              members={workspace.members}
              settlements={workspace.settlements}
              onMarkSettlementPaid={handleMarkSettlementPaid}
              onVoidSettlement={handleVoidSettlement}
              onViewMemberBreakdown={setSelectedBreakdownMemberId}
            />
          )}

          {activeTab === 'members' && (
            <MembersTab
              trip={trip}
              currentMember={currentMember}
              members={workspace.members}
              accountRequests={previewAccountRequests}
              isPlatformAdmin
              initialCategory={membersInitialCategory}
              onApproveMember={approveMember}
              onRejectMember={rejectMember}
              onRemoveMember={removeMember}
              onPromoteMember={promoteMember}
              onDemoteAdmin={demoteMember}
              onViewMemberSpending={setSelectedBreakdownMemberId}
              onApproveAccount={async userId => setPreviewAccountRequests(previous => previous.filter(request => request.user_id !== userId))}
              onRejectAccount={async userId => setPreviewAccountRequests(previous => previous.filter(request => request.user_id !== userId))}
              onRegenerateInviteCode={async () => setWorkspace(previous => ({
                ...previous,
                trip: previous.trip ? { ...previous.trip, invite_code: 'NEWCODE' } : previous.trip,
              }))}
              onRefresh={async () => undefined}
            />
          )}
          </main>
        </div>

        <MemberBreakdownSheet
          isOpen={Boolean(selectedBreakdownMember)}
          onClose={() => setSelectedBreakdownMemberId(null)}
          member={selectedBreakdownMember}
          currentMember={currentMember}
          trip={trip}
          members={workspace.members}
          expenses={workspace.expenses}
          splits={workspace.splits}
          settlements={workspace.settlements}
          exchangeRates={workspace.exchangeRates}
        />

        <BottomNav
          activeTab={activeTab}
          onChangeTab={changeTab}
          pendingRequestsCount={previewAccountRequests.length}
          showAdminBadge
        />

        <GuidedTour
          isOpen={isGuidedTourOpen}
          onComplete={closeGuidedTour}
          onSkip={closeGuidedTour}
          onStepChange={prepareGuidedTourStep}
        />
      </div>
    </div>
  );
};
