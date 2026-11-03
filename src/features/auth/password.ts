/**
 * A forgotten password, without email (supabase/updates/2026-11-03-password.sql):
 * - a recovery code, shown once, sets a new password from the sign-in screen;
 * - without one, a request goes to the admin, who sets a temporary password; the app then asks
 *   for a new one right after signing in.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { cleanUsername, isDemo, supabase } from '@/lib/supabase';
import { useData } from '@/stores/data';
import { signIn } from './auth';

const DEMO_CODE = 'K7QM-3XPA-W9TD-H2RN';

/** Whether the signed-in account has a recovery code (null: not known, e.g. offline). */
export function useHasRecoveryCode(): boolean | null {
  const userId = useData((s) => s.userId);
  const q = useQuery({
    queryKey: ['recovery-code', userId],
    enabled: !!userId,
    staleTime: 60 * 60_000,
    queryFn: async () => {
      if (isDemo) return false;
      const { data, error } = await supabase.rpc('has_recovery_code');
      // Before the password SQL has run: say nothing rather than ask for a code that cannot work.
      if (error) return null;
      return !!data;
    },
  });
  return q.data ?? null;
}

/** A new code; the old one stops working. Formatted XXXX-XXXX-XXXX-XXXX. */
export async function newRecoveryCode(): Promise<string> {
  if (isDemo) return DEMO_CODE;
  const { data, error } = await supabase.rpc('new_recovery_code');
  if (error) throw new Error(error.message);
  return data as string;
}

export function useRecoveryCodeSaved() {
  const qc = useQueryClient();
  const userId = useData((s) => s.userId);
  return () => qc.setQueryData(['recovery-code', userId], true);
}

/** Sets a new password with the recovery code, then signs in with it. */
export async function resetWithCode(username: string, code: string, password: string) {
  const name = cleanUsername(username);
  if (isDemo) return signIn(name, password);
  const { data, error } = await supabase.rpc('reset_password_with_code', {
    p_username: name,
    p_code: code,
    p_password: password,
  });
  if (error) {
    throw new Error(
      /fetch|network/i.test(error.message)
        ? 'No connection. Try again when you are online.'
        : error.message,
    );
  }
  if (data === 'short') throw new Error('The new password needs at least 8 characters.');
  if (data === 'limit') throw new Error('Too many tries. Wait an hour and try again.');
  if (data !== 'ok') throw new Error('That username and recovery code do not match.');
  await signIn(name, password);
}

/** No code: asks the admin, who gets back to the user on the contact they give. */
export async function requestPasswordHelp(username: string, contact: string): Promise<void> {
  if (isDemo) return;
  const { data, error } = await supabase.rpc('request_password_help', {
    p_username: cleanUsername(username),
    p_contact: contact,
  });
  if (error) {
    throw new Error(
      /fetch|network/i.test(error.message)
        ? 'No connection. Try again when you are online.'
        : error.message,
    );
  }
  if (data === 'short') throw new Error('Enter your username and how we can reach you.');
  if (data === 'limit')
    throw new Error('We already have your request. Hang on, we will get back to you.');
}

/** The admin set a temporary password: the user must choose their own now. */
export function useMustChangePassword(): boolean {
  const userId = useData((s) => s.userId);
  const q = useQuery({
    queryKey: ['must-change-password', userId],
    enabled: !!userId && !isDemo,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('password_resets')
        .select('user_id')
        .eq('user_id', userId!);
      if (error) return false;
      return (data ?? []).length > 0;
    },
  });
  return q.data === true;
}

/** Replaces the temporary password (just signed in with it, so no current one is asked). */
export async function setOwnPassword(next: string): Promise<void> {
  const userId = useData.getState().userId;
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) {
    throw new Error(
      /different from the old/i.test(error.message)
        ? 'Choose a password different from the temporary one.'
        : error.message,
    );
  }
  if (userId) await supabase.from('password_resets').delete().eq('user_id', userId);
}
