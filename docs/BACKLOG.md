# Backlog

Feedback from Matyáš (2026-10-23). Work top to bottom, one item at a time; ask for details before starting each one. Tick the box when it ships and add a line to `src/data/changelog.ts`.

- [x] **Changelog**: show what changed since the last visit (sheet after an update + Settings → What's new)
- [x] **Onboarding**: going to a tab probably doesn't work (works after all; all 7 steps checked)
- [x] **Onboarding**: a Friends step after Arena (how to add friends + an Add friends button); each step also highlights the element it talks about on the screen
- [x] **Sign-up**: Name allows at most two words (sign-up and Settings; older longer names stay until changed)
- [x] **Forum**: shows the short name instead of the full name (full name everywhere now)
- [x] **Sharing bug**: "Could not share. Are you online?" while online. The post linked a workout still in the offline queue, so RLS refused it; now the workout syncs first (or the post goes without the link) and only real network errors say "Are you online?" (needs a check on the live app)
- [ ] **Images**: 151 exercise illustrations to make in Gemini. The kit is ready in `gemini-obrazky/` (NAVOD.md, prompts, double-click import); Matyáš generates them
- [x] **Unilateral exercises**: set menu → "Log each side" (per exercise, manual); one row with Left and Right reps; volume counts both, reps/PRs use the weaker side; summary says which side is behind. Needs `supabase/updates/2026-10-23-each-side.sql` on the live project
- [x] **Drop sets and failure**: Drop set / Failure buttons under the set table (last done set); "•••" under set numbers
- [x] **Warm-up sets**: "+ Warm-up" adds 50/70/85 % (fewer when light), shown as W, 1:00 rest, counted to nothing. Needs `supabase/updates/2026-10-23-warmups.sql`
- [x] **Gym check-in**: asked once for a home gym when the account has none; before a workout "Training at <home gym>?" (Yes = check-in, Another gym, Not at a gym), saved as workout_sessions.gym_id. Needs `supabase/updates/2026-10-23-session-gym.sql`
- [x] **Favorite exercises**: star on the workout image, picker rows and the exercise detail; "★ Favorites" chip (picker opens on it); favorites first in every category, exact search match stays first. Needs `supabase/updates/2026-10-23-favorites.sql`
- [ ] **Suggest the next exercise** from similar past workouts
- [ ] **Profile picture required**: a photo or at least an emoji from a set
- [ ] **Add friends by QR code**
- [ ] **Badges / achievements**
- [ ] **Deload status**: one week, visible to others (e.g. in the Forum)
- [ ] **Garmin integration** (to explore)
- [ ] **Czech version** of the app: last, after everything else. Decided: exercise names stay English (Czech search synonyms), own small typed dictionary instead of a library. Still to ask: how the language is chosen, tykání or vykání.
