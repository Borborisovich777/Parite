import { Trip, Member, Expense, ExpenseSplit, Settlement, Currency } from '../types';

interface DBState {
  trips: Trip[];
  members: Member[];
  expenses: Expense[];
  expense_splits: ExpenseSplit[];
  settlements: Settlement[];
}

const STORAGE_KEY = 'tripbalance_db';

// Helper to generate UUIDs
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function generateClassicInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Initial seed data to populate the app for instant evaluation and testing
const SEED_DATA: DBState = {
  trips: [
    {
      id: 'trip-grad-26',
      name: 'Graduation Trip 2026',
      base_currency: 'CNY',
      invite_code: 'GRAD26',
      created_at: '2026-06-01T08:00:00Z'
    }
  ],
  members: [
    {
      id: 'mem-aryn',
      trip_id: 'trip-grad-26',
      display_name: 'Aryn (Admin)',
      role: 'admin',
      status: 'approved',
      created_at: '2026-06-01T08:00:00Z',
      approved_at: '2026-06-01T08:00:00Z'
    },
    {
      id: 'mem-bin',
      trip_id: 'trip-grad-26',
      display_name: 'Bin',
      role: 'member',
      status: 'approved',
      created_at: '2026-06-02T10:00:00Z',
      approved_at: '2026-06-02T11:00:00Z'
    },
    {
      id: 'mem-cathy',
      trip_id: 'trip-grad-26',
      display_name: 'Cathy',
      role: 'member',
      status: 'approved',
      created_at: '2026-06-03T14:30:00Z',
      approved_at: '2026-06-03T15:00:00Z'
    },
    {
      id: 'mem-dana',
      trip_id: 'trip-grad-26',
      display_name: 'Dana',
      role: 'member',
      status: 'pending',
      created_at: '2026-06-08T12:00:00Z'
    },
    {
      id: 'mem-eva',
      trip_id: 'trip-grad-26',
      display_name: 'Eva',
      role: 'member',
      status: 'rejected',
      created_at: '2026-06-04T09:00:00Z'
    },
    {
      id: 'mem-frank',
      trip_id: 'trip-grad-26',
      display_name: 'Frank',
      role: 'member',
      status: 'removed',
      created_at: '2026-06-02T08:00:00Z',
      approved_at: '2026-06-02T09:00:00Z',
      removed_at: '2026-06-07T18:00:00Z'
    }
  ],
  expenses: [
    {
      id: 'exp-1',
      trip_id: 'trip-grad-26',
      title: 'Seafood Banquet dinner',
      amount: 1500.00,
      currency: 'CNY',
      exchange_rate_to_base: 1.0,
      converted_amount: 1500.00,
      paid_by_member_id: 'mem-aryn',
      expense_date: '2026-06-03',
      notes: 'Celebrated Cathys birthday by the beach. Amazing seafood.',
      created_by_member_id: 'mem-aryn',
      created_at: '2026-06-03T20:00:00Z',
      updated_at: '2026-06-03T20:00:00Z'
    },
    {
      id: 'exp-2',
      trip_id: 'trip-grad-26',
      title: 'Souvenir gifts & snacks',
      amount: 400.00,
      currency: 'AED',
      exchange_rate_to_base: 1.95,
      converted_amount: 780.00,
      paid_by_member_id: 'mem-bin',
      expense_date: '2026-06-05',
      notes: 'Buying dates and local tea from the Dubai mall.',
      created_by_member_id: 'mem-bin',
      created_at: '2026-06-05T12:00:00Z',
      updated_at: '2026-06-05T12:00:00Z'
    },
    {
      id: 'exp-3',
      trip_id: 'trip-grad-26',
      title: 'Local SIM Cards & taxi',
      amount: 12000.00,
      currency: 'KZT',
      exchange_rate_to_base: 0.016,
      converted_amount: 192.00,
      paid_by_member_id: 'mem-cathy',
      expense_date: '2026-06-04',
      notes: 'Kazakhstan data packages and transport split.',
      created_by_member_id: 'mem-cathy',
      created_at: '2026-06-04T15:00:00Z',
      updated_at: '2026-06-04T15:00:00Z'
    }
  ],
  expense_splits: [
    // Seafood splitted equally: 1500 CNY -> 500 each to Aryn, Bin, Cathy
    { id: 'split-1-aryn', expense_id: 'exp-1', member_id: 'mem-aryn', amount_owed: 500.00 },
    { id: 'split-1-bin', expense_id: 'exp-1', member_id: 'mem-bin', amount_owed: 500.00 },
    { id: 'split-1-cathy', expense_id: 'exp-1', member_id: 'mem-cathy', amount_owed: 500.00 },
    
    // Souvenirs splitted equally: 780 CNY -> 260 each to Aryn, Bin, Cathy
    { id: 'split-2-aryn', expense_id: 'exp-2', member_id: 'mem-aryn', amount_owed: 260.00 },
    { id: 'split-2-bin', expense_id: 'exp-2', member_id: 'mem-bin', amount_owed: 260.00 },
    { id: 'split-2-cathy', expense_id: 'exp-2', member_id: 'mem-cathy', amount_owed: 260.00 },
    
    // SIM Card custom split: Aryn owes 100, Bin 40, Cathy 52. Total = 192
    { id: 'split-3-aryn', expense_id: 'exp-3', member_id: 'mem-aryn', amount_owed: 100.00 },
    { id: 'split-3-bin', expense_id: 'exp-3', member_id: 'mem-bin', amount_owed: 40.00 },
    { id: 'split-3-cathy', expense_id: 'exp-3', member_id: 'mem-cathy', amount_owed: 52.00 }
  ],
  settlements: []
};

class TripBalanceDatabase {
  private state: DBState;

  constructor() {
    this.state = this.load();
  }

  private load(): DBState {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Error reading indexDB localStorage', e);
    }
    // Return & save seed if empty
    this.saveState(SEED_DATA);
    return JSON.parse(JSON.stringify(SEED_DATA));
  }

  private save(): void {
    this.saveState(this.state);
  }

  private saveState(state: DBState): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  public getRawState(): DBState {
    return this.state;
  }

  public resetToDefault(): void {
    this.state = JSON.parse(JSON.stringify(SEED_DATA));
    this.save();
  }

  // --- TRIP METHODS ---
  public createTrip(name: string, adminDisplayName: string, baseCurrency: Currency): { trip: Trip; admin: Member } {
    const tripId = generateUUID();
    const adminId = generateUUID();
    const inviteCode = generateClassicInviteCode();

    const trip: Trip = {
      id: tripId,
      name,
      base_currency: baseCurrency,
      invite_code: inviteCode,
      created_at: new Date().toISOString()
    };

    const admin: Member = {
      id: adminId,
      trip_id: tripId,
      display_name: adminDisplayName,
      role: 'admin',
      status: 'approved',
      created_at: new Date().toISOString(),
      approved_at: new Date().toISOString()
    };

    this.state.trips.push(trip);
    this.state.members.push(admin);
    this.save();

    return { trip, admin };
  }

  public getTrip(tripId: string): Trip | undefined {
    return this.state.trips.find(t => t.id === tripId);
  }

  public getTripByInviteCode(code: string): Trip | undefined {
    const normalizedCode = code.trim().toUpperCase();
    return this.state.trips.find(t => t.invite_code.trim().toUpperCase() === normalizedCode);
  }

  // --- MEMBER METHODS ---
  public requestJoin(tripId: string, displayName: string): Member {
    const memberId = generateUUID();
    const newMember: Member = {
      id: memberId,
      trip_id: tripId,
      display_name: displayName,
      role: 'member',
      status: 'pending',
      created_at: new Date().toISOString()
    };

    this.state.members.push(newMember);
    this.save();
    return newMember;
  }

  public approveMember(memberId: string): void {
    const member = this.state.members.find(m => m.id === memberId);
    if (member) {
      member.status = 'approved';
      member.approved_at = new Date().toISOString();
      this.save();
    }
  }

  public rejectMember(memberId: string): void {
    const member = this.state.members.find(m => m.id === memberId);
    if (member) {
      member.status = 'rejected';
      this.save();
    }
  }

  public removeMember(memberId: string): void {
    const member = this.state.members.find(m => m.id === memberId);
    if (member) {
      member.status = 'removed';
      member.removed_at = new Date().toISOString();
      this.save();
    }
  }

  public getMember(memberId: string): Member | undefined {
    return this.state.members.find(m => m.id === memberId);
  }

  public listMembers(tripId: string): Member[] {
    return this.state.members.filter(m => m.trip_id === tripId);
  }

  public listApprovedMembers(tripId: string): Member[] {
    return this.state.members.filter(m => m.trip_id === tripId && m.status === 'approved');
  }

  // --- EXPENSE METHODS ---
  public createExpense(
    tripId: string,
    title: string,
    amount: number,
    currency: Currency,
    exchangeRate: number,
    convertedAmount: number,
    paidByMemberId: string,
    expenseDate: string,
    notes: string,
    createdByMemberId: string,
    splits: { member_id: string; amount_owed: number }[]
  ): Expense {
    const expenseId = generateUUID();
    
    const expense: Expense = {
      id: expenseId,
      trip_id: tripId,
      title,
      amount,
      currency,
      exchange_rate_to_base: exchangeRate,
      converted_amount: convertedAmount,
      paid_by_member_id: paidByMemberId,
      expense_date: expenseDate,
      notes,
      created_by_member_id: createdByMemberId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.state.expenses.push(expense);

    // Create splits
    const expenseSplits: ExpenseSplit[] = splits.map(s => ({
      id: generateUUID(),
      expense_id: expenseId,
      member_id: s.member_id,
      amount_owed: s.amount_owed
    }));

    this.state.expense_splits.push(...expenseSplits);
    this.save();

    return expense;
  }

  public updateExpense(
    expenseId: string,
    title: string,
    amount: number,
    currency: Currency,
    exchangeRate: number,
    convertedAmount: number,
    paidByMemberId: string,
    expenseDate: string,
    notes: string,
    splits: { member_id: string; amount_owed: number }[]
  ): void {
    const expense = this.state.expenses.find(e => e.id === expenseId);
    if (expense) {
      expense.title = title;
      expense.amount = amount;
      expense.currency = currency;
      expense.exchange_rate_to_base = exchangeRate;
      expense.converted_amount = convertedAmount;
      expense.paid_by_member_id = paidByMemberId;
      expense.expense_date = expenseDate;
      expense.notes = notes;
      expense.updated_at = new Date().toISOString();

      // Delete old splits
      this.state.expense_splits = this.state.expense_splits.filter(s => s.expense_id !== expenseId);

      // Create new splits
      const newSplits: ExpenseSplit[] = splits.map(s => ({
        id: generateUUID(),
        expense_id: expenseId,
        member_id: s.member_id,
        amount_owed: s.amount_owed
      }));

      this.state.expense_splits.push(...newSplits);
      this.save();
    }
  }

  public deleteExpense(expenseId: string): void {
    this.state.expenses = this.state.expenses.filter(e => e.id !== expenseId);
    this.state.expense_splits = this.state.expense_splits.filter(s => s.expense_id !== expenseId);
    this.save();
  }

  public listExpenses(tripId: string): Expense[] {
    return this.state.expenses.filter(e => e.trip_id === tripId);
  }

  public getExpenseSplits(expenseId: string): ExpenseSplit[] {
    return this.state.expense_splits.filter(s => s.expense_id === expenseId);
  }

  public getAllSplitsForTrip(tripId: string): ExpenseSplit[] {
    const expenseIds = new Set(this.listExpenses(tripId).map(e => e.id));
    return this.state.expense_splits.filter(s => expenseIds.has(s.expense_id));
  }

  // --- SETTLEMENT METHODS ---
  public createSettlement(
    tripId: string,
    fromMemberId: string,
    toMemberId: string,
    amount: number,
    currency: Currency
  ): Settlement {
    const settlementId = generateUUID();
    const settlement: Settlement = {
      id: settlementId,
      trip_id: tripId,
      from_member_id: fromMemberId,
      to_member_id: toMemberId,
      amount,
      currency,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    this.state.settlements.push(settlement);
    this.save();
    return settlement;
  }

  public markSettlementAsPaid(settlementId: string): void {
    const settlement = this.state.settlements.find(s => s.id === settlementId);
    if (settlement) {
      settlement.status = 'paid';
      settlement.paid_at = new Date().toISOString();
      this.save();
    }
  }

  public listSettlements(tripId: string): Settlement[] {
    return this.state.settlements.filter(s => s.trip_id === tripId);
  }
}

export const db = new TripBalanceDatabase();
export default db;
