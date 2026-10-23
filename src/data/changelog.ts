/**
 * What's new, newest first. Add an entry for every release that users notice: a short title
 * and a few plain sentences about what they can do now (no internals). The `id` only has to be
 * unique; use the release date, with a suffix ("2026-10-23b") for a second release that day.
 * The device remembers the newest id it has shown and the sheet lists everything above it.
 */
import type { Release } from '@/lib/changelog';

export const CHANGELOG: Release[] = [
  {
    id: '2026-10-23',
    date: '2026-10-23',
    title: 'See what changed',
    items: [
      'After an update, Colosseum shows what changed since your last visit.',
      'The full history is in Profile → Settings → What’s new.',
      'The app tour now lights up what each step talks about and shows you how to add friends.',
      'Full names everywhere: the Forum, comments, your gym and friends’ PRs.',
      'Names are at most two words, like “Jan Novák”.',
      'Fix: sharing a workout right after finishing it no longer fails with “Are you online?”.',
      'Log each side: for split squats and other one-leg or one-arm exercises, tap a set number and log left and right reps. PRs go by the weaker side.',
      'Warm-up sets: “+ Warm-up” adds a ramp up to your working weight. Warm-ups never count to volume or PRs.',
      'Drop set and Failure buttons right under your sets.',
      'Before a workout, confirm where you train. At your home gym this checks you in, so friends there see you under Training now.',
      'No home gym yet? Colosseum asks once, so My gym in the Arena works for you.',
    ],
  },
  {
    id: '2026-10-11b',
    date: '2026-10-11',
    title: 'App tour and a new Arena',
    items: [
      'A short tour walks you through the app. Replay it any time from Settings.',
      'Arena: one Friends / My gym / Global switch. The leader wears the laurel and your row shows how far the next place is.',
      'Today: swipe through the Forum.',
      'iPhone: the app now fills the whole screen when added to the Home Screen.',
    ],
  },
  {
    id: '2026-10-11',
    date: '2026-10-11',
    title: 'Drop sets, workout feel and the Forum',
    items: [
      'Drop sets and sets to failure, from the set menu.',
      'Rate how a workout felt. Colosseum suggests the next weights and tells you when a deload week could help.',
      '28 gym machines, with the machine’s own weight noted for each exercise.',
      'Forum: share workouts with friends and your gym, like and comment.',
      'Global leaderboard, if you turn it on in Settings.',
    ],
  },
  {
    id: '2026-10-05',
    date: '2026-10-05',
    title: 'Supersets',
    items: [
      'Link exercises into a superset. Rest starts after the whole round.',
      'Customize a template before you use it, and swap exercises for top-rated ones that train the same muscle.',
    ],
  },
  {
    id: '2026-10-02',
    date: '2026-10-02',
    title: 'Programs, notes and a bigger catalog',
    items: [
      'Program templates with phases that build up and end with a deload week.',
      'Over 1,300 exercises with forgiving search (typos and abbreviations like “rdl” work).',
      'A note per exercise, shown again next time.',
      'Save one-off workouts and start them again from Workouts.',
      'Weight PRs and estimated 1RM PRs, and a richer summary after each workout.',
    ],
  },
];
