import { Currency, Expense, ExpenseSplit, Settlement, Member, MemberBalance, SettlementRecommendation } from '../types';

/**
 * Calculates converted amount in base currency based on exchange rate.
 * converted_amount = original_amount * exchange_rate_to_base
 */
export function calculateConvertedAmount(amount: number, exchangeRate: number): number {
  return Math.round(amount * exchangeRate * 100) / 100;
}

/**
 * Splits converted amount equally among participants, handling rounding pennies.
 * Assigns the remaining cents to the last participant.
 */
export function calculateEqualSplits(
  convertedAmount: number,
  participantIds: string[]
): { member_id: string; amount_owed: number }[] {
  if (participantIds.length === 0) return [];
  
  const totalCents = Math.round(convertedAmount * 100);
  const baseCents = Math.floor(totalCents / participantIds.length);
  const remainderCents = totalCents - (baseCents * participantIds.length);
  
  return participantIds.map((id, index) => {
    // If it is the last participant, they get the remainder cents added
    const centsOwed = baseCents + (index === participantIds.length - 1 ? remainderCents : 0);
    return {
      member_id: id,
      amount_owed: centsOwed / 100
    };
  });
}

export interface SmartCustomSplitRow {
  member_id: string;
  amount_owed: number;
  amount_cents: number;
  mode: 'manual' | 'auto';
}

export interface SmartCustomSplitResult {
  splits: { member_id: string; amount_owed: number }[];
  rows: SmartCustomSplitRow[];
  lockedTotal: number;
  remainingAmount: number;
  autoParticipantCount: number;
  isValid: boolean;
  error?: string;
}

const MONEY_INPUT_PATTERN = /^(?:\d+|\d+\.\d{0,2}|\.\d{1,2})$/;

function parseManualAmountToCents(value: string): { kind: 'auto' } | { kind: 'manual'; cents: number } | { kind: 'invalid' } {
  const trimmed = value.trim();
  if (trimmed === '') return { kind: 'auto' };
  if (!MONEY_INPUT_PATTERN.test(trimmed)) return { kind: 'invalid' };

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return { kind: 'invalid' };

  return { kind: 'manual', cents: Math.round(parsed * 100) };
}

/**
 * Calculates custom splits in integer cents. Manual rows are locked and
 * the remaining cents are distributed across auto rows in participant order.
 */
export function calculateSmartCustomSplits({
  totalAmount,
  participantIds,
  manualAmounts,
}: {
  totalAmount: number;
  participantIds: string[];
  manualAmounts: Record<string, string>;
}): SmartCustomSplitResult {
  const totalCents = Number.isFinite(totalAmount) ? Math.round(totalAmount * 100) : 0;

  if (totalCents <= 0) {
    return {
      splits: [],
      rows: [],
      lockedTotal: 0,
      remainingAmount: 0,
      autoParticipantCount: 0,
      isValid: false,
      error: 'Enter a valid converted amount before customizing the split.',
    };
  }

  if (participantIds.length === 0) {
    return {
      splits: [],
      rows: [],
      lockedTotal: 0,
      remainingAmount: totalCents / 100,
      autoParticipantCount: 0,
      isValid: false,
      error: 'At least one participant must be selected.',
    };
  }

  const manualCentsById: Record<string, number> = {};
  let lockedTotalCents = 0;

  for (const participantId of participantIds) {
    const parsed = parseManualAmountToCents(manualAmounts[participantId] ?? '');
    if (parsed.kind === 'invalid') {
      return {
        splits: [],
        rows: participantIds.map(id => ({
          member_id: id,
          amount_owed: 0,
          amount_cents: 0,
          mode: (manualAmounts[id] ?? '').trim() === '' ? 'auto' : 'manual',
        })),
        lockedTotal: lockedTotalCents / 100,
        remainingAmount: (totalCents - lockedTotalCents) / 100,
        autoParticipantCount: participantIds.filter(id => (manualAmounts[id] ?? '').trim() === '').length,
        isValid: false,
        error: 'Custom split amounts must be zero or positive numbers with up to two decimals.',
      };
    }

    if (parsed.kind === 'manual') {
      manualCentsById[participantId] = parsed.cents;
      lockedTotalCents += parsed.cents;
    }
  }

  const autoParticipantIds = participantIds.filter(id => manualCentsById[id] === undefined);
  const autoParticipantCount = autoParticipantIds.length;
  const remainingCents = totalCents - lockedTotalCents;

  if (remainingCents < 0) {
    const rows = participantIds.map(id => ({
      member_id: id,
      amount_cents: manualCentsById[id] ?? 0,
      amount_owed: (manualCentsById[id] ?? 0) / 100,
      mode: manualCentsById[id] === undefined ? 'auto' as const : 'manual' as const,
    }));

    return {
      splits: rows.map(({ member_id, amount_owed }) => ({ member_id, amount_owed })),
      rows,
      lockedTotal: lockedTotalCents / 100,
      remainingAmount: remainingCents / 100,
      autoParticipantCount,
      isValid: false,
      error: 'Manual split amounts are higher than the converted expense total.',
    };
  }

  const autoCentsById: Record<string, number> = {};
  if (autoParticipantCount > 0) {
    const baseCents = Math.floor(remainingCents / autoParticipantCount);
    const remainderCents = remainingCents - (baseCents * autoParticipantCount);

    autoParticipantIds.forEach((id, index) => {
      autoCentsById[id] = baseCents + (index === autoParticipantCount - 1 ? remainderCents : 0);
    });
  } else if (remainingCents !== 0) {
    const rows = participantIds.map(id => ({
      member_id: id,
      amount_cents: manualCentsById[id],
      amount_owed: manualCentsById[id] / 100,
      mode: 'manual' as const,
    }));

    return {
      splits: rows.map(({ member_id, amount_owed }) => ({ member_id, amount_owed })),
      rows,
      lockedTotal: lockedTotalCents / 100,
      remainingAmount: remainingCents / 100,
      autoParticipantCount: 0,
      isValid: false,
      error: 'Manual split amounts must add up exactly to the converted expense total.',
    };
  }

  const rows = participantIds.map(id => {
    const isManual = manualCentsById[id] !== undefined;
    const amountCents = isManual ? manualCentsById[id] : autoCentsById[id] ?? 0;
    return {
      member_id: id,
      amount_cents: amountCents,
      amount_owed: amountCents / 100,
      mode: isManual ? 'manual' as const : 'auto' as const,
    };
  });

  const finalCents = rows.reduce((sum, row) => sum + row.amount_cents, 0);
  if (finalCents !== totalCents) {
    return {
      splits: rows.map(({ member_id, amount_owed }) => ({ member_id, amount_owed })),
      rows,
      lockedTotal: lockedTotalCents / 100,
      remainingAmount: remainingCents / 100,
      autoParticipantCount,
      isValid: false,
      error: 'Custom split rounding did not match the converted expense total.',
    };
  }

  return {
    splits: rows.map(({ member_id, amount_owed }) => ({ member_id, amount_owed })),
    rows,
    lockedTotal: lockedTotalCents / 100,
    remainingAmount: remainingCents / 100,
    autoParticipantCount,
    isValid: true,
  };
}

/**
 * Validates if the sum of custom splits elements equals the converted amount.
 * Allows a tolerance of 0.01.
 */
export function validateCustomSplits(
  convertedAmount: number,
  splits: { member_id: string; amount_owed: number }[]
): boolean {
  const splitsSum = splits.reduce((sum, s) => sum + s.amount_owed, 0);
  return Math.abs(splitsSum - convertedAmount) <= 0.011;
}

/**
 * Calculates the total paid, total owed, and net balance for each approved member.
 * Formula:
 * - total_paid = sum(converted_amount of expenses paid by member)
 * - total_owed = sum(amount_owed from expense_splits for member)
 * - net_balance = total_paid - total_owed
 * 
 * Note: Only approved members count in active balances.
 * Expenses paid or split by removed members remain in historical calculations.
 */
export function calculateMemberBalances(
  expenses: Expense[],
  splits: ExpenseSplit[],
  approvedMembers: Member[]
): MemberBalance[] {
  const memberIdSet = new Set(approvedMembers.map(m => m.id));

  // Initialize balance dictionary for approved members
  const balanceMap: Record<string, { total_paid: number; total_owed: number; name: string }> = {};
  for (const member of approvedMembers) {
    balanceMap[member.id] = {
      total_paid: 0,
      total_owed: 0,
      name: member.display_name
    };
  }

  // 1. Calculate total paid for expenses.
  // Note: Expenses paid by removed/non-approved members are tracked historically, but
  // we only include active approved members in the returned active balance sheets.
  for (const expense of expenses) {
    if (memberIdSet.has(expense.paid_by_member_id)) {
      balanceMap[expense.paid_by_member_id].total_paid += expense.converted_amount;
    }
  }

  // 2. Calculate total owed from expense splits
  for (const split of splits) {
    if (memberIdSet.has(split.member_id)) {
      balanceMap[split.member_id].total_owed += split.amount_owed;
    }
  }

  // 3. Construct MemberBalance items
  return approvedMembers.map(member => {
    const data = balanceMap[member.id];
    const net_balance = Math.round((data.total_paid - data.total_owed) * 100) / 100;
    return {
      member_id: member.id,
      display_name: data.name,
      total_paid: Math.round(data.total_paid * 100) / 100,
      total_owed: Math.round(data.total_owed * 100) / 100,
      net_balance
    };
  });
}

export function applyPaidSettlementsToBalances(
  balances: MemberBalance[],
  settlements: Settlement[]
): MemberBalance[] {
  const paidSettlements = settlements.filter(settlement => settlement.status === 'paid');

  return balances.map(balance => {
    const paidSent = paidSettlements
      .filter(settlement => settlement.from_member_id === balance.member_id)
      .reduce((sum, settlement) => sum + settlement.amount, 0);

    const paidReceived = paidSettlements
      .filter(settlement => settlement.to_member_id === balance.member_id)
      .reduce((sum, settlement) => sum + settlement.amount, 0);

    return {
      ...balance,
      net_balance: Math.round((balance.net_balance + paidSent - paidReceived) * 100) / 100,
    };
  });
}

export function calculateOpenMemberBalances(
  expenses: Expense[],
  splits: ExpenseSplit[],
  settlements: Settlement[],
  approvedMembers: Member[]
): MemberBalance[] {
  return applyPaidSettlementsToBalances(
    calculateMemberBalances(expenses, splits, approvedMembers),
    settlements
  );
}

/**
 * Calculates settlements / recommendations to resolve net balances.
 * Uses the greedy algorithm matching debtors and creditors.
 * Expects balances to already represent open balances after paid settlement adjustment.
 */
export function calculateSettlementRecommendations(
  balances: MemberBalance[],
  _settlements: Settlement[],
  baseCurrency: Currency
): SettlementRecommendation[] {
  void _settlements;

  const adjustedBalances = balances.map(balance => ({
    id: balance.member_id,
    name: balance.display_name,
    balance: Math.round(balance.net_balance * 100) / 100,
  }));

  // Split into debtors and creditors
  // We use a safe margin of 0.01 CNY to ignore floating-point rounding dust near zero
  const debtors = adjustedBalances
    .filter(m => m.balance < -0.01)
    .map(m => ({ ...m }));
    
  const creditors = adjustedBalances
    .filter(m => m.balance > 0.01)
    .map(m => ({ ...m }));

  // Sort debtors ascending (largest debt first, e.g. -150 before -50)
  debtors.sort((a, b) => a.balance - b.balance);
  // Sort creditors descending (largest credit first, e.g. 100 before 70)
  creditors.sort((a, b) => b.balance - a.balance);

  const recommendations: SettlementRecommendation[] = [];

  // Greedy match debtors and creditors
  let creditorIdx = 0;
  for (const debtor of debtors) {
    while (debtor.balance < -0.01) {
      if (creditorIdx >= creditors.length) break;
      const creditor = creditors[creditorIdx];
      
      if (creditor.balance <= 0.01) {
        creditorIdx++;
        continue;
      }

      const debtorOwes = Math.abs(debtor.balance);
      const creditorLends = creditor.balance;
      const paymentAmount = Math.min(debtorOwes, creditorLends);

      if (paymentAmount > 0.01) {
        recommendations.push({
          from_member_id: debtor.id,
          from_display_name: debtor.name,
          to_member_id: creditor.id,
          to_display_name: creditor.name,
          amount: Math.round(paymentAmount * 100) / 100,
          currency: baseCurrency
        });
      }

      debtor.balance += paymentAmount;
      creditor.balance -= paymentAmount;

      if (creditor.balance <= 0.01) {
        creditorIdx++;
      }
    }
  }

  return recommendations;
}
