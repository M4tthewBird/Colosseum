# Colosseum — build roadmap

> Status: phases 0–8 are built and checked on web in demo mode (no Supabase keys). The Supabase paths (sign-up, sync, RPCs) still need a run against a real project, and the iPhone test is open.

- Work top to bottom and tick `[x]` as you go.
- Every phase ends with the app running on web (`npx expo start`, press `w`) and a visual check against `design/screens/`.

## Phase 0 — Project setup

- [x] Create the Expo app with TypeScript and Expo Router **in this folder**, keeping the existing `brand/`, `assets/`, `design/`, `docs/`, `supabase/` and `tokens.css`
- [x] Add the dependencies from `CLAUDE.md` (supabase-js, react-query, zustand, AsyncStorage, expo-blur, lucide-react-native, react-native-svg, Cinzel font, NetInfo)
- [x] `app.json`: name "Colosseum", icons from `brand/`, splash background `#F2F2F7`, web `output: "static"`, favicon `brand/app-icon-32.png`
- [x] PWA: copy `manifest.webmanifest`; add the iOS meta tags from `HANDOFF.md` through `app/+html.tsx`
- [x] `.env.example` with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`; add `.env` to `.gitignore`
- [x] ESLint, Prettier, TypeScript strict
- [x] `git init`, first commit
- [x] Tell the user (in Czech) how to create the Supabase project, run `supabase/schema.sql` and `supabase/seed.sql`, turn off email confirmation, and paste the keys into `.env`

## Phase 1 — Design system

- [x] `src/theme/tokens.ts` mirroring `tokens.css`
- [x] Components:
  - `GlassCard`, `FillButton`, `TextButton`, `IconButton`, `Segmented`, `Chip`, `ListRow`
  - `Avatar`, `ProgressRing`, `Sparkline`, `ScreenGlow`, `LogoMark` (from `brand/logo-mark.svg`)
- [x] Floating glass `TabBar` with the 4 tabs and safe-area handling
- [x] A hidden dev route `/dev/components` that shows every component

## Phase 2 — Auth and onboarding

- [x] Supabase client with persisted session
- [x] Onboarding screen; include the Password and Height rows, and no kg/lb switch
- [x] Sign-in screen
- [x] Username availability check
- [x] Home-gym picker sheet with search and "Add new gym"
- [x] Avatar upload (512 px JPEG) to the `avatars` bucket
- [x] Auth guard: signed out → onboarding; signed in → tabs

## Phase 3 — Programs

- [x] Exercise picker: search, muscle filter, create custom exercise
- [x] Program editor: name, weeks, training days, workout days, exercises with sets/reps/rest, reorder
- [x] Programs list: active program card with week strip; set active, duplicate, delete
- [x] "Up next" logic: the next program day by weekday, or the next day in order

## Phase 4 — Active workout (offline-first)

- [x] Local store and sync queue as described in `docs/DATA.md`, with an online/offline listener and retries
- [x] Start a workout from a program day, or empty
- [x] Workout screen:
  - Exercise card with illustration or placeholder
  - Sets table with the "Last time" values
  - Edit kg and reps; ✓ starts the rest timer
  - Add and remove sets
  - Next exercise
- [x] PR detection with a toast; elapsed timer; minimize with a "Resume" bar
- [x] Finish flow with a summary; the session is marked finished and synced
- [x] Restore after a restart; "Not synced yet" indicator
- [x] Unit tests for volume, e1RM, PR detection and the week boundaries

## Phase 5 — Today and Workouts tabs

- [x] Today:
  - Weekly ring and the 4 stats
  - Up next card
  - Friends' PRs (empty state for now)
- [x] Workouts: Up next, month calendar with trained/PR/today states, previous workouts list
- [x] Session detail screen with delete

## Phase 6 — Profile

- [x] Profile card and settings: edit profile, change gym, sign out, delete account
- [x] Body tab (owner only):
  - Bodyweight card with sparkline and a quick add
  - Measurements grid with changes
  - Log popup
- [x] Lifts tab:
  - Tiles: Big 3, PRs, Lifted all time
  - Exercise list with sparklines
  - Exercise detail screen
- [x] Other users' profiles show Lifts and recent workouts only — **never Body**

## Phase 7 — Friends and Arena

- [x] Friends: search by username, requests, accept/decline, list, remove
- [x] Ranks:
  - `get_leaderboard` RPC
  - Period menu
  - Metric chips with an "Edit" to pick any exercise
  - Podium + list, current user highlighted or pinned
- [x] Today → Friends' PRs is now live
- [x] My gym:
  - Check-in (2 h)
  - Training now
  - Gym challenge card
  - Feed of finished sessions with likes and comments
- [x] Empty states: no friends; no home gym

## Phase 8 — Web release (GitHub Pages)

- [x] `experiments.baseUrl` set to the repo name (from `BASE_PATH` in the workflow, see `app.config.js`)
- [x] `npx expo export -p web`
- [x] GitHub Actions workflow that builds and deploys `dist/` to Pages on every push to `main`
- [ ] Test "Add to Home Screen" on an iPhone: standalone mode, correct icon, safe areas, offline workout
- [x] Short guide in Czech for the user

## Phase 9 — Native apps (later, when the user asks)

- [ ] `eas.json` with build profiles; `eas build -p ios` and `eas build -p android` (cloud builds, no Mac needed)
- [ ] Use native blur via `expo-blur`; haptics on set done and on PR
- [ ] Store listing assets from `brand/`
- [ ] Remind the user: publishing needs a paid Apple developer account (yearly) and a Google Play developer account (one-time fee)
