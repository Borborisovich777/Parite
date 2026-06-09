import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

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
    throw new Error(String((error as { message: unknown }).message));
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
