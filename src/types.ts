export type Currency = 'AED' | 'CNY' | 'KZT';

export interface Trip {
  id: string;
  name: string;
  base_currency: Currency;
  invite_code: string;
  created_at: string;
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
  access_token?: string;
  created_at: string;
  approved_at?: string;
  removed_at?: string;
}

export interface Expense {
  id: string;
  trip_id: string;
  title: string;
  amount: number; // original amount
  currency: Currency;
  exchange_rate_to_base: number;
  converted_amount: number; // in base currency
  paid_by_member_id: string;
  expense_date: string; // YYYY-MM-DD
  notes?: string;
  created_by_member_id: string;
  created_at: string;
  updated_at: string;
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  member_id: string;
  amount_owed: number; // in base currency
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
  status: 'pending' | 'paid';
  created_by_member_id?: string;
  created_at: string;
  paid_at?: string;
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
