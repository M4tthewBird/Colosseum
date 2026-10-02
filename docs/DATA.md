# Colosseum — data, privacy and sync

- **Backend:** Supabase, free plan.
- **Schema:** the starting schema with RLS is `supabase/schema.sql`. Apply it in the Supabase SQL editor, or with the Supabase CLI as the first migration.

## Supabase free plan limits (checked Sep 2026)

| Limit | Value |
|---|---|
| Database | 500 MB |
| Auth | 50 000 monthly active users |
| Storage | 1 GB |
| Egress | 5 GB |
| Active projects | 2 |

A free project **pauses after 1 week without activity**. That is fine for testing. Mention it to the user before any public launch.

**Keep it small:**

- Compress avatars to 512 px JPEG before upload
- Store exercise images in the app bundle (`assets/exercises`), not in Storage

## Tables

| Table | Purpose | Who can read | Who can write |
|---|---|---|---|
| `profiles` | username, display name, sex, experience, goals, home gym, avatar | any signed-in user | owner |
| `profile_private` | height (cm) | **owner only** | owner |
| `gyms` | name, city | signed-in users | signed-in users (create); creator (edit) |
| `friendships` | request + status (`pending` / `accepted`) | the two users | requester creates; addressee accepts |
| `exercises` | name, muscles, image key, custom flag | signed-in users (built-in + own custom) | owner (custom only) |
| `programs`, `program_days`, `program_exercises` | user programs | owner | owner |
| `workout_sessions` | a workout: name, program day, start and finish times, totals | owner, friends, same home gym | owner |
| `set_entries` | one set: exercise, set number, kg, reps, done | same as its session | owner |
| `bodyweight_logs` | date, kg | **owner only** | owner |
| `body_measurements` | date + 8 measurements in cm | **owner only** | owner |
| `gym_checkins` | user, gym, time | members of that gym | owner |
| `gym_challenges` | gym, title, exercise or metric, target, start and end dates | members of that gym | members (create) |
| `session_likes`, `session_comments` | feed reactions | whoever can see the session | owner of the like or comment |

**Views and functions:**

- **`exercise_bests`:** per user and exercise — best weight, best estimated 1RM, when it was set.
  - Only finished sessions count
- **`get_leaderboard(scope, metric, period)`:** returns rank, user, value.
  - It is `security definer` and filters to the caller's friends (`scope = 'friends'`) or home gym (`scope = 'gym'`)
  - metric = `'volume'` | `'workouts'` | `<exercise uuid>` (best estimated 1RM)
  - period = `'week'` | `'month'` | `'all'`
  - metric `'dots:<exercise uuid>'` = best e1RM × `dots_coefficient(latest bodyweight, sex)`
  - It may read the latest `bodyweight_logs` row only for DOTS and must **never** return it; it never reads `body_measurements`

## Privacy rules

- Height, bodyweight and body measurements live in separate tables with owner-only RLS (`profile_private`, `bodyweight_logs`, `body_measurements`)
- `profiles` holds no body data
- Other users only see workouts, sets, bests, the gym, and public profile fields

## Offline-first sync (active workout and logs)

1. **Queue writes locally.**
   - Every mutation (create session, upsert set, finish session, log bodyweight or measurements) goes into a persisted queue: zustand + AsyncStorage
   - Each item has a client-generated `uuid` and an `updated_at`
2. **Apply locally first.** The UI reads the local state, so it works with no network.
3. **Flush the queue.**
   - When online (NetInfo on native, `navigator.onLine` plus `online` events on web), flush the queue in order with **upserts** on `id`, so sending twice is safe
4. **Show the state.** While items wait, show a subtle "Not synced yet" label on the session and in Workouts. If a flush fails, retry with backoff; never drop data.
5. **Conflicts:** last write wins by `updated_at`. Only the owner writes their own data, so real conflicts are rare.
6. **Restore after a restart.** The active workout state (current exercise, rest timer start, sets) is persisted too, so killing the app mid-workout loses nothing.

## Auth

- **Sign up:**
  - Call `supabase.auth.signUp` with `email = <username>@users.colosseum.app` and the password
  - Email confirmation is disabled in the Supabase dashboard
  - Then insert the `profiles` row
- **Sign in:** the same mapping.
- **Username rules:** lowercase `[a-z0-9_.]{3,20}`; unique via a constraint on `profiles.username`.
- **Session storage:** persist the session with AsyncStorage (on web, supabase-js uses localStorage automatically).

## Built-in exercises (seed)

Seed about 40 common lifts plus the S, A and B tier exercises from Jeff Nippard's tier lists (124 in total), with muscles, e.g. Bench press, Incline bench press, Incline dumbbell press, Overhead press, Lateral raise, Triceps pushdown, Squat, Front squat, Deadlift, Romanian deadlift, Leg press, Leg curl, Leg extension, Calf raise, Barbell row, Pull-up, Lat pulldown, Seated cable row, Biceps curl, Hammer curl, Face pull, Hip thrust, Lunge, Dips, Plank.

The `image_key` for Bench press is `bench-press`; the others are `null` until illustrations exist.
