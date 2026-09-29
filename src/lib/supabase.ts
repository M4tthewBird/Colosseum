import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { safeStorage } from './storage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * Without Supabase keys the app runs in demo mode: everything is local and the social screens
 * use the sample data from src/dev/seed.ts.
 */
export const isDemo = !url || !anonKey;

export const supabase: SupabaseClient = createClient(
  url || 'https://demo.invalid',
  anonKey || 'demo',
  {
    auth: {
      storage: safeStorage,
      persistSession: true,
      autoRefreshToken: !isDemo,
      detectSessionInUrl: false,
    },
  },
);

/** Supabase Auth needs an email, so usernames map to a hidden address. Never shown to the user. */
export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@users.colosseum.app`;
}

export const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;
