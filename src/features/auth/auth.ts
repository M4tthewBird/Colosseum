/**
 * Username + password auth. Supabase needs an email, so the username maps to
 * <username>@users.colosseum.app behind the scenes; the email is never shown.
 */
import { create } from 'zustand';

import {
  DEMO_EXERCISES,
  DEMO_GYMS,
  DEMO_MEASUREMENTS,
  demoBodyweights,
  demoProgram,
  demoSessions,
} from '@/dev/seed';
import { addDays, toLocalDate } from '@/lib/dates';
import { isServer, safeStorage } from '@/lib/storage';
import { AUTH_STORAGE_KEY, isDemo, supabase, usernameToEmail } from '@/lib/supabase';
import type { BodyMeasurement, Experience, Goal, Profile, Sex } from '@/lib/types';
import { uuid } from '@/lib/uuid';
import { useData } from '@/stores/data';
import { useQueue } from '@/stores/queue';
import { useWorkout } from '@/stores/workout';
import { uploadAvatar } from '../profile/avatar';
import { pullAll } from '../sync/pull';

type Status = 'loading' | 'signedOut' | 'signedIn';

interface AuthState {
  status: Status;
  userId: string | null;
  /** Username from the auth account, used when the profile row is missing. */
  accountUsername: string | null;
}

export const useAuth = create<AuthState>()(() => ({
  status: 'loading',
  userId: null,
  accountUsername: null,
}));

const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001';

function usernameFromEmail(email: string | undefined): string | null {
  return email ? email.split('@')[0] : null;
}

async function onSignedIn(userId: string, email?: string) {
  const data = useData.getState();
  if (data.userId && data.userId !== userId) {
    data.reset();
    useQueue.getState().clear();
    useWorkout.getState().end();
  }
  if (!useData.getState().userId) useData.setState({ userId });
  const signedIn = {
    status: 'signedIn' as const,
    userId,
    accountUsername: usernameFromEmail(email),
  };
  // With local data we can show the app right away; otherwise wait for the first pull so we
  // know whether the profile exists.
  if (useData.getState().profile) useAuth.setState(signedIn);
  try {
    await pullAll(userId);
  } catch (e) {
    console.warn('[auth] pull failed (offline?)', e);
  }
  useAuth.setState(signedIn);
}

let started = false;

/** Call once after the local stores are hydrated. */
export function startAuth(): void {
  if (started || isServer) return;
  started = true;
  if (isDemo) {
    const { profile, exercises } = useData.getState();
    // Built-in exercises added in later versions show up without signing in again.
    if (profile && DEMO_EXERCISES.some((e) => !exercises[e.id])) {
      useData.setState({
        exercises: { ...Object.fromEntries(DEMO_EXERCISES.map((e) => [e.id, e])), ...exercises },
      });
    }
    useAuth.setState({
      status: profile ? 'signedIn' : 'signedOut',
      userId: profile ? profile.id : null,
    });
    return;
  }
  void supabase.auth.getSession().then(({ data }) => {
    const s = data.session;
    if (s) void onSignedIn(s.user.id, s.user.email);
    else useAuth.setState({ status: 'signedOut', userId: null });
  });
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT')
      useAuth.setState({ status: 'signedOut', userId: null, accountUsername: null });
    if (event === 'SIGNED_IN' && session && session.user.id !== useAuth.getState().userId) {
      void onSignedIn(session.user.id, session.user.email);
    }
  });
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  if (isDemo)
    return !['tomas', 'adam', 'jakub', 'ondrej', 'filip', 'lukas', 'petr'].includes(username);
  const { data, error } = await supabase.rpc('username_available', { p_username: username });
  if (error) throw new Error(error.message);
  return !!data;
}

export interface SignUpInput {
  username: string;
  password: string;
  displayName: string;
  sex: Sex | null;
  experience: Experience | null;
  goals: Goal[];
  bodyweightKg: number | null;
  heightCm: number | null;
  gym: { id: string } | { name: string; city: string } | null;
  photoUri: string | null;
}

function friendlyAuthError(message: string): string {
  if (/already registered|already exists/i.test(message)) return 'This username is taken.';
  if (/invalid login credentials/i.test(message)) return 'Wrong username or password.';
  if (/password/i.test(message) && /least/i.test(message))
    return 'The password needs at least 8 characters.';
  if (/fetch|network/i.test(message)) return 'No connection. Try again when you are online.';
  return message;
}

/** Creates the account (unless already signed in without a profile) and the profile. */
export async function signUp(input: SignUpInput): Promise<void> {
  const username = input.username.trim().toLowerCase();
  if (isDemo) return demoSignUp(input);

  let userId = useAuth.getState().userId;
  if (!userId) {
    const { data, error } = await supabase.auth.signUp({
      email: usernameToEmail(username),
      password: input.password,
    });
    if (error) throw new Error(friendlyAuthError(error.message));
    if (!data.session || !data.user) {
      throw new Error(
        'Sign-up needs email confirmation turned off in Supabase (Auth → Providers → Email).',
      );
    }
    userId = data.user.id;
    useData.getState().reset();
    useData.setState({ userId });
  }

  let homeGymId: string | null = null;
  if (input.gym && 'id' in input.gym) homeGymId = input.gym.id;
  else if (input.gym) {
    const { data, error } = await supabase
      .from('gyms')
      .insert({
        name: input.gym.name.trim(),
        city: input.gym.city.trim() || null,
        created_by: userId,
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    homeGymId = data.id as string;
  }

  let avatarUrl: string | null = null;
  if (input.photoUri) {
    try {
      avatarUrl = await uploadAvatar(userId, input.photoUri);
    } catch (e) {
      console.warn('[auth] avatar upload failed', e);
    }
  }

  const profile: Profile = {
    id: userId,
    username,
    display_name: input.displayName.trim(),
    sex: input.sex,
    experience: input.experience,
    goals: input.goals,
    home_gym_id: homeGymId,
    avatar_url: avatarUrl,
  };
  const { error } = await supabase.from('profiles').upsert(profile);
  if (error) {
    if (/duplicate|unique/i.test(error.message)) throw new Error('This username is taken.');
    throw new Error(error.message);
  }
  useData.setState({ profile });
  useData.getState().savePrivate({ user_id: userId, height_cm: input.heightCm });
  if (input.bodyweightKg) useData.getState().logBodyweight(input.bodyweightKg);
  await onSignedIn(userId);
}

export async function signIn(username: string, password: string): Promise<void> {
  if (isDemo) return demoSignIn();
  const { error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });
  if (error) throw new Error(friendlyAuthError(error.message));
}

/**
 * Signs out and clears local data. `forgotten` is for an account that no longer exists: the
 * stored session is just dropped, because asking the server to end it would fail with 403.
 */
export async function signOut(how: 'server' | 'forgotten' = 'server'): Promise<void> {
  if (!isDemo) {
    if (how === 'server') await supabase.auth.signOut();
    else await safeStorage.removeItem(AUTH_STORAGE_KEY);
  }
  useData.getState().reset();
  useQueue.getState().clear();
  useWorkout.getState().end();
  useAuth.setState({ status: 'signedOut', userId: null, accountUsername: null });
}

export async function deleteAccount(): Promise<void> {
  if (!isDemo) {
    const { error } = await supabase.rpc('delete_my_account');
    if (error) throw new Error(error.message);
  }
  await signOut('forgotten');
}

// ───────────── Demo mode (no Supabase keys) ─────────────

function loadDemo(
  profile: Profile,
  heightCm: number | null,
  bodyweightKg: number | null,
  withHistory: boolean,
) {
  const now = new Date();
  const userId = profile.id;
  const program = demoProgram(userId, now);
  const sessions = withHistory ? demoSessions(userId, program, now) : [];
  const bws = withHistory ? demoBodyweights(now) : [];
  if (bodyweightKg) bws.push({ logged_on: toLocalDate(now), weight_kg: bodyweightKg });
  const measurements: BodyMeasurement[] = withHistory
    ? DEMO_MEASUREMENTS.map(({ daysAgo, ...m }) => ({
        id: uuid(),
        user_id: userId,
        logged_on: toLocalDate(addDays(now, -daysAgo)),
        ...m,
      }))
    : [];
  useData.getState().load({
    userId,
    profile,
    priv: { user_id: userId, height_cm: heightCm },
    exercises: Object.fromEntries(DEMO_EXERCISES.map((e) => [e.id, e])),
    programs: withHistory ? { [program.id]: program } : {},
    sessions: Object.fromEntries(sessions.map((s) => [s.id, s])),
    bodyweights: Object.fromEntries(
      bws.map((b) => {
        const id = uuid();
        return [id, { id, user_id: userId, ...b }];
      }),
    ),
    measurements: Object.fromEntries(measurements.map((m) => [m.id, m])),
  });
  useAuth.setState({ status: 'signedIn', userId });
}

async function demoSignUp(input: SignUpInput) {
  const gymId = input.gym && 'id' in input.gym ? input.gym.id : input.gym ? DEMO_GYMS[0].id : null;
  loadDemo(
    {
      id: DEMO_USER_ID,
      username: input.username.trim().toLowerCase(),
      display_name: input.displayName.trim(),
      sex: input.sex,
      experience: input.experience,
      goals: input.goals,
      home_gym_id: gymId,
      avatar_url: input.photoUri,
    },
    input.heightCm,
    input.bodyweightKg,
    true,
  );
}

async function demoSignIn() {
  loadDemo(
    {
      id: DEMO_USER_ID,
      username: 'matyas',
      display_name: 'Matyáš',
      sex: 'male',
      experience: 'intermediate',
      goals: ['strength', 'muscle'],
      home_gym_id: DEMO_GYMS[0].id,
      avatar_url: null,
    },
    182,
    null,
    true,
  );
}
