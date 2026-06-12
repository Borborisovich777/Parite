export type Currency = 'AED' | 'CNY' | 'KZT' | 'USD';
export type TripStatus = 'active' | 'closing' | 'closed';

export interface Trip {
  id: string;
  name: string;
  base_currency: Currency;
  invite_code: string;
  status?: TripStatus;
  created_at: string;
  closed_at?: string;
}

export type MemberRole = 'admin' | 'member';
export type MemberStatus = 'pending' | 'approved' | 'rejected' | 'removed';

export interface Member {
  id: string;
  trip_id: string;
  user_id?: string;
  display_name: string;
  role: MemberRole;
  status: MemberStatus;
  display_currency?: Currency | null;
  access_token?: string;
  created_at: string;
  approved_at?: string;
  removed_at?: string;
}

export interface Expense {
  id: string;
  trip_id: string;
  title: string;
  amount: number; // final original amount, including service fee when present
  subtotal_amount?: number; // original amount before service fee
  fee_percent?: number;
  fee_amount?: number; // original-currency fee amount
  fee_label?: string | null;
  currency: Currency;
  exchange_rate_to_base: number;
  converted_amount: number; // final amount in base currency
  paid_by_member_id: string;
  expense_date: string; // YYYY-MM-DD
  notes?: string;
  created_by_member_id: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  deleted_by_member_id?: string;
  delete_reason?: string;
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  member_id: string;
  amount_owed: number; // final owed amount in base currency
  subtotal_amount_owed?: number; // pre-fee share in base currency
  fee_amount_owed?: number; // fee share in base currency
}

export interface ExpenseSplitInput {
  member_id: string;
  amount_owed: number;
  subtotal_amount_owed?: number;
  fee_amount_owed?: number;
}

export interface ExpenseFeeInput {
  subtotal_amount: number;
  fee_percent: number;
  fee_label?: string | null;
}

export interface ExchangeRate {
  id: string;
  trip_id: string;
  from_currency: Currency;
  to_currency: Currency;
  rate: number;
  updated_by_member_id: string;
  updated_at: string;
}

export interface Settlement {
  id: string;
  trip_id: string;
  from_member_id: string; // debtor
  to_member_id: string; // creditor
  amount: number; // in base currency
  currency: Currency; // usually matching trip base currency
  status: 'pending' | 'paid' | 'voided';
  created_by_member_id?: string;
  paid_confirmed_by_member_id?: string;
  created_at: string;
  paid_at?: string;
  voided_at?: string;
  voided_by_member_id?: string;
  void_reason?: string;
}

export interface MemberBalance {
  member_id: string;
  display_name: string;
  total_paid: number; // in base currency
  total_owed: number; // in base currency
  net_balance: number; // total_paid - total_owed
}

export interface SettlementRecommendation {
  from_member_id: string;
  from_display_name: string;
  to_member_id: string;
  to_display_name: string;
  amount: number; // in base currency
  currency: Currency;
}

export interface TripClosureVote {
  id: string;
  trip_id: string;
  member_id: string;
  approved_at: string;
}
