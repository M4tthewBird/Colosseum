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

---

# The game layer (`docs/GAME.md`)

Matyáš's plan (2026-11-13). Built and checked on web in demo mode; `supabase/updates/2026-11-13-game.sql` still needs a run on the live project. Everything is earned only by real training. Numbers in `src/lib/game/config.ts`.

## Phase 10 — XP and ranks

- [x] XP per qualifying workout, PR bonus, week-streak bonus, verified bonus; never for volume
- [x] Daily XP cap (also a database check)
- [x] Levels and ranks: Tiro → Gladiator → Veteranus → Primus Palus → Rudiarius
- [x] Profile: level, rank and XP bar under the name
- [x] Workout summary: "+120 XP" counting up with a breakdown, the bar filling, level-up banner
- [x] The cell: a cosmetic home on the profile that grows with the rank and level

## Phase 11 — Leagues and seasons

- [x] Monthly season, laurels, Bronze → Silver → Gold → Imperator's Arena
- [x] Partial reset at the end of a season (half, at most 300)
- [x] Fair scoring: progress % × level factor, 3-week baseline, attendance first, small DOTS part
- [x] Arena → League
- [x] Today: season card

## Phase 12 — QR check-in / check-out

- [x] Gym visits: scan in, scan out, minutes; GPS within 150 m
- [x] Signed codes (HMAC) checked by a database trigger
- [x] Forgotten check-out closes as incomplete after 3 h; under 20 min or over 4 h not counted for wars
- [x] Workouts during a verified visit are verified; home or outdoor workouts are unverified
- [x] Offline: scan and position saved and checked after sync
- [x] Gym manager: QR poster to print
- [ ] Later: a rotating code on a tablet (after agreeing with a gym)

## Phase 13 — Ludus and denarii

- [x] Tribe = home gym; Ludus = 3–10 people across gyms (create, join by code/link/QR, leave, remove)
- [x] Denarii per workout, more for verified, PRs, streak, training with a ludus member; daily cap
- [x] Wallet and gifts to the ludus or gym treasury

## Phase 14 — Fortress

- [x] Buildings for ludus and gym: machines, palisade, barracks, temple
- [x] Real-time construction (ready-at timestamps, no cron)
- [x] Bonuses applied to denarii; damaged buildings and repair

## Phase 15 — Ludus wars

- [x] Declare war, 3-day window, points from verified workouts, per active member, palisade bonus
- [x] Settlement: spoils, laurels, a damaged building, nothing deleted

## Phase 16 — Duels and Bellum

- [x] Weekly duels with friends (most workouts / most kg added to a lift)
- [x] Bellum: monthly war of the gyms in a city
- [x] Arena → Duels, Arena → Bellum

## Phase 17 — Attributes

- [x] Character sheet: Strength, Endurance, Discipline

## Phase 18 — The city, styles and gear

`supabase/updates/2026-11-14-city.sql` has run on the live project (2026-11-14).

- [x] Illustrations from the design: the gladiator per rank, the home, fortress stages, fighting styles, gear and the city
- [x] The city (Today → The city): every building opens a part of the game
- [x] Fighting styles with a +15 XP bonus, changed once a season (history kept)
- [x] The forge: 32 pieces in 5 slots, bought with denarii or opened by level, verified workouts or league
- [ ] The market and the baths (to decide with Matyáš)

## Phase 19 — The map and tribe attacks

- [x] The map of the city: tribes, territories, filters, running attacks
- [x] An enemy tribe up close: strength, walls, spoils, weak spot, their best three
- [x] Comparing gear with their best
- [x] Tribe attacks: 24 h warning, 3 days, gear and wall bonus, spoils, territory, damage
- [x] Pledges to defend, the result screen and revenge
- [ ] Push notification when your tribe is attacked (needs the push sender)

## Phase 20 — Running (next, `docs/GAME.md` → 11)

`supabase/updates/2026-11-14-running.sql` has run on the live project (2026-11-14).

- [x] Pure functions with tests: pace, qualifying run, standard-distance best times, VDOT, run anti-cheat (`src/lib/running.ts`)
- [x] Runs as `workout_sessions` of kind 'run', heart rate in the private `session_ratings`, checks for impossible paces
- [x] Workouts → Log a run: manual entry, live pace, offline queue
- [x] Runs in the history, the friends feed and their own detail screen with the reward (+XP, laurels)
- [x] XP, laurels, denarii, weekly target and Retiarius from runs, inside the shared daily caps
- [x] Runs count in ludus wars, tribe attacks, Bellum and workout duels
- [x] Arena: Running metrics (best 5 km, best 10 km, VDOT, km)
- [x] Profile → Lifts: running bests
- [x] Changelog line and a highlights card
- [ ] Later, with the native apps: GPS recording

## Phase 21 — The City tab and the choice to play

Matyáš's call (2026-11-26): the game leaves the Arena, which was too crowded, for its own tab.

- [x] City tab (own Colosseum icon) between Arena and Profile; its home is the city with the places
- [x] Colosseum: League, Duels, Bellum and the map; Ludus, Temple (the gym's fortress) and Your domus (the gladiator, from Profile) as their own screens
- [x] Arena: only the leaderboards and friends; old links to the game's sections go to the City
- [x] Sign-up asks: play the game or just track workouts ("You can change this any time in Profile → Settings")
- [x] Settings → Game on/off; off hides the City tab and the game's cards, the game keeps counting
- [x] What's new asks players from before the choice, right on its card
- [ ] The painted, modular city on the City tab (docs/PAINTED-UI.md, pictures from `gemini-obrazky/hra/`): a grid that grows from the arena, new pieces only next to built ones (docs/GAME.md §9 "Building the city")
- [ ] Gladiators and gear seen from the front (Gemini kit, rev 2); dressing up gear as layers if the test batch works

## Game docs

- [x] `docs/GAME.md` with the rules, numbers and tables
- [x] `PRODUCT.md`, `DATA.md` point to it
