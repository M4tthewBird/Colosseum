# Colosseum — instructions for Claude Code

Colosseum is a social gym tracker: log workouts from your own programs, track PRs and body stats, and compete with friends and your gym in the **Arena**. The name comes from gladiators who trained and competed together.

The design is **final**. Build it, don't redesign it.

## Talk to the user

- The user is **Matyáš**. Talk to him in **Czech**. Code, comments, commit messages and UI copy are in **English**.
- He works on **Windows**, so give PowerShell-friendly commands.
- Ask before adding a paid service or changing a decision listed below.

## Read these first (in this order)

1. `docs/PRODUCT.md` — every screen and feature, with its behavior and acceptance criteria
2. `docs/DESIGN.md` — design system, components, and how to read the screen reference files
3. `docs/DATA.md` — Supabase schema, privacy rules, offline sync, leaderboard logic
4. `docs/ROADMAP.md` — build order. **Work phase by phase and tick the checkboxes as you finish.**
5. `design/screens/*.dc.html` — the exact screen designs (HTML with inline styles). Treat them as pixel reference.
6. `supabase/schema.sql` — starting schema with RLS

`HANDOFF.md` is an older summary. Where it differs from `docs/`, `docs/` wins.

## Stack (decided)

- **Expo (React Native) + TypeScript**, with **Expo Router** (file-based routes)
  - One codebase for **web (PWA)** now, and **iOS + Android** later
  - iOS builds happen in the cloud with **EAS Build**, so no Mac is needed
- **react-native-web** for the web build
  - Export with `npx expo export -p web`
  - Deploy to **GitHub Pages** (set `experiments.baseUrl` to the repo name)
- **Supabase** (free plan): Postgres, Auth, Storage
  - Client: `@supabase/supabase-js`
  - Keep the anon key in `.env` as `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- **State**
  - Server data: `@tanstack/react-query`
  - Active workout and the offline queue: `zustand`, persisted with `AsyncStorage` (works on web too)
- **UI libraries**
  - `expo-blur` for the liquid-glass surfaces; on web, fall back to CSS `backdrop-filter`
  - `lucide-react-native` for icons (stroke 2)
  - `react-native-svg` for the logo, charts and progress ring
  - `@expo-google-fonts/cinzel` only for the COLOSSEUM wordmark
  - System font everywhere else, which is SF Pro on iOS
- **Quality:** ESLint and Prettier, TypeScript `strict`

## Product rules (decided — do not change without asking)

- **Units:** kg only. No lb anywhere.
- **Sign-in:** username + password only. Supabase Auth needs an email, so:
  - Map the username to `${username}@users.colosseum.app` behind the scenes
  - Turn off email confirmation in Supabase
  - Never show the email to the user
- **Offline:** logging a workout must work offline.
  - Every write goes to a local queue first and syncs when the device is back online
  - The UI shows a small "Not synced yet" state while items are waiting
  - Use client-generated UUIDs so syncing twice is safe
- **Privacy:** bodyweight and body measurements are private.
  - Only the owner can read them; RLS enforces this
  - The values never appear in Arena, Gym or on another user's profile (a DOTS score is the only derived number)
- **Bodyweight-adjusted lifts: DOTS only.** In the Arena, lift leaderboards can switch between kg and DOTS (best e1RM × DOTS coefficient from bodyweight and sex). No "× bodyweight" ratios or Wilks.
  - The server reads the latest bodyweight only to compute the score and never returns the weight itself
- **Home gym:** "Gym" in the profile means the user's home gym, the physical place they train at most.
- **Onboarding** asks for bodyweight and height. Body measurements (chest, biceps…) are added later from a popup on Profile → Body.
- **Arena:** the user chooses what the leaderboard shows (metric + time period).
- **Exercise images:** marble-statue illustration style, 16:9, light grey background (see `assets/exercises/bench-press.jpg`).
  - Exercises without an image show a neutral placeholder of the same size

## Design rules (short version — full version in docs/DESIGN.md)

- **Colors**
  - Background `#F2F2F7`, text `#1C1C1E`, secondary text `#6C6C70`
  - Accent red `#B91C1C`, used **only** for: the active tab, PRs, progress, completed sets and small highlights
- **Buttons:** no black buttons. Primary actions are grey-fill pills (`rgba(118,118,128,0.12)`) with dark text and a red icon.
  - Exception (decided by Matyáš): a form's go button (Continue on sign-up, Sign in) turns **red with white text** once the form is valid
- **Selection:** the selected segment or chip is a white pill with a soft shadow on a grey track.
- **Glass:** cards are white frosted glass: `rgba(255,255,255,0.72)`, blur 30, 0.5px white border, soft shadow.
- **Tab bar:** floating glass capsule with 4 tabs: Today, Workouts, Arena, Profile.
- **Safe areas:** respect them. Never draw a fake status bar.
- **Touch targets:** at least 44 px. Text contrast at least 4.5:1.
- **Logo:** use `brand/logo-mark.svg` (laurel wreath + dumbbell). App icons are in `brand/`.

## Project layout (target)

```
app/                    Expo Router routes
  (auth)/onboarding.tsx
  (tabs)/_layout.tsx    floating glass tab bar
  (tabs)/index.tsx      Today
  (tabs)/workouts/…     Workouts, Programs, ProgramEdit
  (tabs)/arena/…        Ranks, My gym
  (tabs)/profile/…      Body, Lifts
  workout/[id].tsx      full-screen active workout (modal)
src/components/         GlassCard, FillButton, Segmented, Chip, ListRow, SetRow, …
src/theme/              tokens.ts (mirrors tokens.css)
src/lib/                supabase.ts, sync queue, formulas (e1RM, volume)
src/features/…          queries and hooks per feature
supabase/               schema.sql, migrations
assets/                 exercises, fonts
brand/                  logo and icons (already here)
design/screens/         design reference (read only)
docs/                   specs (read only unless asked)
```

## Commands

- `npx expo start` — dev server (press `w` for web)
- `npx expo export -p web` — static web build into `dist/`
- `npx expo lint` — lint
- `eas build -p ios` / `eas build -p android` — native builds (later phase)

## Working style

- Work phase by phase from `docs/ROADMAP.md`. Keep each phase runnable.
- After each phase:
  - Run the app on web
  - Compare it against the matching `design/screens/*.dc.html`
  - Update the checkboxes in the roadmap
- Keep sample data only in `src/dev/seed.ts`, never hard-coded in screens.
- Write small pure functions for the formulas and unit-test them (volume, e1RM, streaks, PR detection).
