# Colosseum — product spec

This file describes every screen: what it shows, what the user can do, and how to check it is done.

- **Layout reference:** each screen has an exact layout in `design/screens/<Name>.dc.html`.
- **Sample data:** names and numbers in the designs are placeholders; real data comes from Supabase.

## Navigation

A floating glass **tab bar** has 4 tabs:

| Tab | Icon | Route | Screen file |
|---|---|---|---|
| Today | house | `/(tabs)/` | `Main.dc.html` |
| Workouts | dumbbell | `/(tabs)/workouts` | `Workouts.dc.html` |
| Arena | trophy | `/(tabs)/arena` | `Arena.dc.html` (Ranks) + `Gym.dc.html` (My gym) |
| Profile | person | `/(tabs)/profile` | `Profile.dc.html` (Body) + `ProfileLifts.dc.html` (Lifts) |

Screens outside the tab bar:

- **Onboarding** (`Onboarding.dc.html`) — shown when there is no session or the profile is incomplete
- **Programs** (`Programs.dc.html`) — pushed from Workouts; the Workouts tab stays active
- **Program editor** (`ProgramEdit.dc.html`) — pushed or modal
- **Active workout** (`Workout.dc.html`) — full-screen modal with no tab bar; the chevron-down button minimizes it
  - A minimized active workout shows a small glass "Resume workout" bar above the tab bar on every tab

---

## 1. Onboarding / sign-in — `Onboarding.dc.html`

**Create account (first screen):**

- **Photo:** optional; tap the circle to pick an image, upload it to Supabase Storage `avatars/`
- **Name**
- **Username:** unique, lowercase, `a-z 0-9 _ .`, 3–20 characters; check availability live
- **Password:** needed for username + password sign-in
  - The design shows no password row, so add one to the grouped list in the same style
  - Minimum 8 characters
- **Sex:** Male / Female segmented control
- **Bodyweight (kg)**
- **Height (cm):** add this row; it is missing from the design
- **Home gym:** "Choose" opens a searchable sheet of gyms with "Add new gym" (name + city)
- **Experience:** Beginner / Intermediate / Advanced
- **Goals:** multi-select chips — Strength, Build muscle, Endurance, Lose fat, Stay healthy
- **Continue** creates the auth user and the profile, then goes to Today

**Sign in:** "Already have an account? Sign in" opens a simple screen with username, password and a Sign in button.

**Differences from the design:**

- Remove the kg/lb switch (the app is kg only)
- Add Password and Height rows

**Done when:**

- A new user can register, close the app, reopen it, and is still signed in
- Duplicate usernames are rejected with a clear message

## 2. Today — `Main.dc.html`

**Header:** logo mark + COLOSSEUM wordmark (Cinzel), the large title "Today", and the avatar button (goes to Profile).

**This week card:**

- Ring showing workouts done / weekly target
  - The target is the number of training days in the active program, or 3 if there is none
- 4 stats:
  - **Volume:** sum of kg × reps of completed sets this week, shown as `t` when ≥ 1000 kg
  - **Streak:** consecutive weeks that reached the target
  - **Arena rank:** rank among friends by this week's volume
  - **New PRs:** count this week

**Up next card:**

- Shows the next program day: name, number of exercises, estimated duration
  - Estimate = sets × (45 s + rest time)
- **Change** goes to Programs
- **Start workout** creates a session from that program day and opens the active workout
- With no active program: "No program yet", with **Start empty workout** and **Create program**

**Friends' PRs:**

- The latest PRs set by friends: avatar, name, lift, time ago, weight, "New PR"
- "Arena" link goes to the Arena tab
- Empty state: "Add friends to see their PRs" with an **Add friends** button

## 3. Workouts — `Workouts.dc.html` (scrolls)

**Header:**

- Subtitle is `<program name> · week X of Y`
- **Programs** button

**Up next card:** same logic as on Today, plus a round "+" button that starts an empty workout.

**Calendar card:**

- Month grid, weeks start on Monday
- Trained days get a grey fill; days with a PR get an accent fill with white text; today has an accent ring; future days are dimmed
- The ‹ › buttons change the month
- Counter "N workouts" for the shown month
- Tapping a trained day opens that session's detail

**Previous workouts:**

- List rows: weekday, date, name, duration · volume (· best PR), and a "PR" label if any
- Newest first, paginated
- Tap opens the **session detail**: exercises with their sets, read-only, plus Delete

## 4. Programs — `Programs.dc.html`

**Header:** back link "‹ Workouts", large title "Programs", and "+" (new program).

**Active program card:**

- Name, days per week · length, and **Edit**
- Progress: week X of Y and completed/planned workouts, with a progress bar
- Week strip Mon–Sun: completed days in grey, today in accent, upcoming days with a dashed outline, rest days empty
  - Labels are 2-letter abbreviations of the day name

**My programs:**

- Other programs; tap to edit
- Long-press or a menu offers: **Set as active**, **Duplicate**, **Delete**

**Create program** opens the editor.

## 5. Program editor — `ProgramEdit.dc.html`

**Nav:** Cancel (asks to confirm when there are unsaved changes), title, Save (accent text).

**Fields:**

- **Name** (required)
- **Length:** stepper, 1–52 weeks
- **Training days:** 7 toggles, M–S, with an "N per week" counter

**Workout days:** expandable cards (A, B, C…). Each has:

- Name and assigned weekdays
- Exercise rows: name, muscle, scheme `sets × reps` (a rep range is allowed, e.g. 6–8), and a drag handle to reorder
- Tap a row to edit sets, reps min/max and rest seconds (default 120)
- **Add exercise** opens an exercise picker: search, muscle filter, "Create custom exercise"
- **Add workout day**

**Done when:** a program with 3 days and 4 exercises each can be created, saved, set active, and appears on Today as Up next.

## 6. Active workout — `Workout.dc.html`

This is the core of the app and must work fully offline.

**Top bar:**

- Minimize (chevron down)
- Title: workout name, and below it "Exercise i of n · elapsed mm:ss"
- **Finish**

**Progress:** one segment per exercise; done or current segments are accent.

**Exercise card:**

- Illustration 16:9 (image or placeholder) with an info button (tips, later)
- Name, muscles, and the plan (`4 × 6–8 · rest 2:00`)
- "PR xx kg" pill

**Sets table:** Set / Last time / kg / Reps / ✓

- **Last time** = the same set number from the most recent session with this exercise
- kg and reps start with the planned or last values and can be edited (decimal keyboard for kg)
- **✓** marks the set done: the row gets an accent tint, the check fills red, and the rest timer starts
- Add set / remove set: a swipe or a small "+ Add set" below the table
- A PR happens when a set beats the best weight or best estimated 1RM for this exercise
  - Show a small "New PR" toast and mark the set

**Bottom floating bar:**

- Rest countdown, which vibrates or alerts at 0
- **Next: <exercise>** moves to the next exercise
- Swiping between exercises also works

**Finish:**

- Confirm, then show a summary: duration, volume, sets, PRs
- The session is saved, synced when online, and appears in Previous workouts, the Gym feed and the leaderboards

**Offline:**

- Everything is stored locally first
- If the app is closed mid-workout, reopening restores it

## 7. Arena · Ranks — `Arena.dc.html`

**Header:** subtitle "N friends", large title "Arena", and a period menu button (This week / This month / All time).

**Section switch:** Ranks / My gym (segmented).

**Metric chips:** the user picks what to rank by. The default set is Volume, Bench, Squat, Deadlift.

- Through "Edit" the user can pick any exercise as a metric (best estimated 1RM)
- Or choose **Workouts** (count) or **Volume**
- The choice is remembered on the device

**Scope:** friends (default). A small toggle "Friends / My gym" can come later — keep the query ready for both.

**Podium for places 1–3:**

- 1st is in the middle, taller, with an accent ring on the avatar
- "You" gets a soft accent ring when on the podium

**List for places 4+:** the current user's row is highlighted with an accent tint. If the user is outside the top list, show them pinned at the bottom.

**Rules:**

- No bodyweight-relative metrics
- Only lifts logged in finished sessions count

## 8. Arena · My gym — `Gym.dc.html`

**Header:**

- Subtitle `<gym name> · N members`
- Large title "Arena"
- **Check in** button (becomes "Checked in" with a check; valid for 2 hours)

**Training now:** count and avatar stack of members who checked in, or have an active session, in the last 2 hours.

**Gym challenge card:**

- Title, days left, and a progress bar for the gym total vs. the target
- "Gym x / y" and "You n"
- Challenges are created by gym members (an admin UI can come later; seed one for testing)

**Feed:** finished workouts of gym members and friends, newest first.

- Each item: avatar, name "finished <workout>", time ago, duration · volume · PR count
- **Like** (heart, toggles, shows a count)
- **Comment** (opens comments, shows a count)

**Empty state:** "Choose your home gym" leads to the gym picker.

## 9. Profile · Body — `Profile.dc.html`

**Header:** title "Profile" and a settings button.

- **Settings:** edit profile, change home gym, sign out, delete account

**Profile card:** avatar, name, `@username · <gym>`.

**Switch:** Body / Lifts.

**Bodyweight card:**

- Current kg, change over 30 days, and a sparkline
- Tap to add today's weight

**Measurements:**

- Chest, Shoulders, Biceps L, Biceps R, Forearms, Waist, Thighs, Calves (cm)
- Each shows its change since the previous entry
- **Log** opens a popup to enter any subset of them for today
- "Last logged <date>"

**Privacy:** this whole tab is private. It is visible only to the owner and never shown on other users' profiles.

## 10. Profile · Lifts — `ProfileLifts.dc.html`

**Summary tiles:**

- **Big 3 total** (best bench + squat + deadlift, estimated 1RM)
- **PRs** (count)
- **Lifted all time** (t)
- Replace the design's "5.2× Bodyweight" tile with **Lifted all time**. Bodyweight metrics are not allowed.

**Exercise list:**

- Every exercise the user has logged: name, best set, a sparkline of best estimated 1RM per session, and the gain over the last 12 weeks
- Tap opens the **exercise detail**: a chart, the history of sessions, and PRs

**Other users' profiles** (opened from Arena or Gym) show only: avatar, name, gym, the Lifts tab, and recent workouts. They never show Body.

## Friends

- Search users by username
- Send a friend request; the other user can accept or decline
- Friends list with remove
- Entry points: Today's empty state, the Arena header menu, and another user's profile

## Formulas

- **Volume** = Σ weight_kg × reps over completed sets
- **Estimated 1RM (Epley)** = w × (1 + reps / 30); for reps = 1 it is w
- **PR:** a completed set whose weight **or** estimated 1RM is higher than every earlier completed set of the same exercise
- **Week:** Monday 00:00 to Sunday 23:59, in the device's local time zone
