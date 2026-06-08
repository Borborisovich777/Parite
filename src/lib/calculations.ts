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

/**
 * Calculates settlements / recommendations to resolve net balances.
 * Uses the greedy algorithm matching debtors and creditors.
 * Adjusts initial net balances by subtracting paid settlements:
 * - payer's (from) balance increases by settlement amount (becomes closer to zero or positive)
 * - receiver's (to) balance decreases by settlement amount (becomes closer to zero or negative)
 */
export function calculateSettlementRecommendations(
  balances: MemberBalance[],
  settlements: Settlement[],
  baseCurrency: Currency
): SettlementRecommendation[] {
  // 1. Compute adjusted net balance for each member, taking paid settlements into account.
  // Net balance is: total_paid - total_owed
  // If someone has net_balance = -50, they owe 50.
  // If they made a paid settlement of 30, they now only owe 20 (adjusted balance shifts from -50 to -20).
  // If someone has net_balance = +50, they are owed 50.
  // If they received a paid settlement of 30, they are now only owed 20 (adjusted balance shifts from +50 to +20).
  const adjustedBalances = balances.map(b => {
    let balance = b.net_balance;
    const paidSettlements = settlements.filter(s => s.status === 'paid');
    
    // Add paid settlements where this member paid another member (increasing their balance towards zero/positive)
    const paidSent = paidSettlements
      .filter(s => s.from_member_id === b.member_id)
      .reduce((sum, s) => sum + s.amount, 0);
      
    // Subtract paid settlements where this member received payment (decreasing their balance towards zero/negative)
    const paidReceived = paidSettlements
      .filter(s => s.to_member_id === b.member_id)
      .reduce((sum, s) => sum + s.amount, 0);

    balance = balance + paidSent - paidReceived;
    return {
      id: b.member_id,
      name: b.display_name,
      balance: Math.round(balance * 100) / 100
    };
  });

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
