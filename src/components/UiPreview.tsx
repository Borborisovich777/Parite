import React, { useMemo, useState } from 'react';
import { AppHeader } from './AppHeader';
import { AccountSecuritySheet } from './AccountSecuritySheet';
import { BalancesTab } from './BalancesTab';
import { BottomNav, TabType } from './BottomNav';
import { ExpensesTab } from './ExpensesTab';
import { MemberBreakdownSheet } from './MemberBreakdownSheet';
import { MembersTab } from './MembersTab';
import { SideMenu } from './SideMenu';
import { createUiPreviewWorkspace } from '../lib/uiPreviewData';
import type { Expense, ExpenseSplit, Member, Settlement } from '../types';

type ExpenseTabProps = React.ComponentProps<typeof ExpensesTab>;
type BalanceTabProps = React.ComponentProps<typeof BalancesTab>;
type MembersTabProps = React.ComponentProps<typeof MembersTab>;

const nowIso = () => new Date().toISOString();

export const UiPreview: React.FC = () => {
  const [workspace, setWorkspace] = useState(createUiPreviewWorkspace);
  const [activeTab, setActiveTab] = useState<TabType>('expenses');
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);
  const [isAccountSecurityOpen, setIsAccountSecurityOpen] = useState(false);
  const [previewEmail] = useState('mira@example.com');
  const [previewPendingEmail, setPreviewPendingEmail] = useState<string | null>(null);
  const [selectedBreakdownMemberId, setSelectedBreakdownMemberId] = useState<string | null>(null);

  const trip = workspace.trip!;
  const currentMember = workspace.currentMember!;
  const selectedBreakdownMember = useMemo(
    () => workspace.members.find(member => member.id === selectedBreakdownMemberId) ?? null,
    [selectedBreakdownMemberId, workspace.members]
  );

  const changeTab = (tab: TabType) => {
    setActiveTab(tab);
    setSelectedExpenseId(null);
    setIsAddingExpense(false);
    setSelectedBreakdownMemberId(null);
  };

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

  return (
    <div className="h-[100dvh] bg-[var(--color-page-background)] flex flex-col md:p-6 items-center font-sans overflow-hidden">
      <div className="mobile-prototype parite-shell w-full max-w-md md:max-w-3xl lg:max-w-5xl bg-[var(--color-app-background)] border border-[var(--color-border)] md:rounded-[36px] shadow-2xl overflow-hidden h-[100dvh] md:h-[calc(100dvh-3rem)] flex flex-col relative">
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
        <AppHeader
          trip={trip}
          currentMember={currentMember}
          onMenuOpen={() => setIsSideMenuOpen(true)}
        />

        <SideMenu
          isOpen={isSideMenuOpen}
          trip={trip}
          currentMember={currentMember}
          accountEmail={previewEmail}
          onAccountSettings={() => setIsAccountSecurityOpen(true)}
          workspaces={[{
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
          }]}
          currentMemberId={currentMember.id}
          pendingRequestsCount={0}
          onClose={() => setIsSideMenuOpen(false)}
          onSwitchWorkspace={async () => setIsSideMenuOpen(false)}
          onShowTripSelection={() => setIsSideMenuOpen(false)}
          onCreateTrip={() => setIsSideMenuOpen(false)}
          onJoinTrip={() => setIsSideMenuOpen(false)}
          onAdminTools={() => {
            changeTab('members');
            setIsSideMenuOpen(false);
          }}
          onPendingRequests={() => {
            changeTab('members');
            setIsSideMenuOpen(false);
          }}
          onExchangeRates={() => setIsSideMenuOpen(false)}
          onRegenerateInviteCode={async () => undefined}
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
          onStartTripClosure={async () => undefined}
          onApproveTripClosure={async () => undefined}
          onCancelTripClosure={async () => undefined}
          onExportExpensesCsv={() => undefined}
          onExportBalancesCsv={() => undefined}
          onExportSettlementsCsv={() => undefined}
          exportBusy={null}
          onLogout={() => setIsSideMenuOpen(false)}
        />

        <BottomNav
          variant="desktop"
          activeTab={activeTab}
          onChangeTab={changeTab}
          pendingRequestsCount={0}
          showAdminBadge
        />

        <main className="flex-1 min-h-0 overflow-y-auto bg-[var(--color-app-background)] mb-[calc(68px+env(safe-area-inset-bottom))] md:mb-0">
          {activeTab === 'expenses' && (
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
            />
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
              initialCategory="approved"
              onApproveMember={approveMember}
              onRejectMember={rejectMember}
              onRemoveMember={removeMember}
              onPromoteMember={promoteMember}
              onDemoteAdmin={demoteMember}
              onViewMemberSpending={setSelectedBreakdownMemberId}
            />
          )}

        </main>

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
          pendingRequestsCount={0}
          showAdminBadge
        />
      </div>
    </div>
  );
};
