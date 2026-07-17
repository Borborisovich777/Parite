import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import type { AccountAccess } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local.');
  }

  return supabase;
}

function throwAuthError(error: unknown): never {
  if (error && typeof error === 'object' && 'message' in error) {
    const authError = new Error(String((error as { message: unknown }).message)) as Error & {
      code?: string;
      reasons?: string[];
    };
    const code = 'code' in error ? (error as { code?: unknown }).code : undefined;
    const reasons = 'reasons' in error ? (error as { reasons?: unknown }).reasons : undefined;

    if (typeof code === 'string') authError.code = code;
    if (Array.isArray(reasons)) {
      authError.reasons = reasons.filter((reason): reason is string => typeof reason === 'string');
    }

    throw authError;
  }

  throw new Error('Authentication failed.');
}

export async function signUpWithEmail(email: string, password: string): Promise<User | null> {
  const client = requireSupabase();
  const { data, error } = await client.auth.signUp({ email, password });
  if (error) throwAuthError(error);
  return data.session?.user ?? null;
}

export async function signInWithEmail(email: string, password: string): Promise<User | null> {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throwAuthError(error);
  return data.user ?? null;
}

export async function signOut(): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.auth.signOut();
  if (error) throwAuthError(error);
}

function parseAccountAccess(value: unknown, operation: string): AccountAccess {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${operation} returned an invalid account record.`);
  }

  return value as AccountAccess;
}

export async function getMyAccountAccess(): Promise<AccountAccess> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('get_my_account_access');
  if (error) throwAuthError(error);
  return parseAccountAccess(data, 'get_my_account_access');
}

export async function listPendingAccountAccess(): Promise<AccountAccess[]> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('list_pending_account_access');
  if (error) throwAuthError(error);
  if (!Array.isArray(data)) throw new Error('Could not read account approval requests.');
  return data.map(value => parseAccountAccess(value, 'list_pending_account_access'));
}

export async function approveAccount(userId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('approve_account', { user_id_input: userId });
  if (error) throwAuthError(error);
}

export async function rejectAccount(userId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('reject_account', { user_id_input: userId });
  if (error) throwAuthError(error);
}

async function reauthenticateWithPassword(email: string, currentPassword: string): Promise<User> {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (error) throwAuthError(error);
  if (!data.user) throw new Error('Could not verify the signed-in account.');
  return data.user;
}

export async function changeAccountEmail(
  currentEmail: string,
  currentPassword: string,
  nextEmail: string,
): Promise<User> {
  const client = requireSupabase();
  await reauthenticateWithPassword(currentEmail, currentPassword);

  const { data, error } = await client.auth.updateUser({ email: nextEmail });
  if (error) throwAuthError(error);
  if (!data.user) throw new Error('Could not update the account email.');
  return data.user;
}

export async function changeAccountPassword(
  email: string,
  currentPassword: string,
  nextPassword: string,
): Promise<User> {
  const client = requireSupabase();
  await reauthenticateWithPassword(email, currentPassword);

  const { data, error } = await client.auth.updateUser({ password: nextPassword });
  if (error) throwAuthError(error);
  if (!data.user) throw new Error('Could not update the account password.');
  return data.user;
}
