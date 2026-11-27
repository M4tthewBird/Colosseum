# Colosseum — the game layer

An RPG layer on top of the tracker, inspired by Gladiatus (XP and ranks), Clash Royale (leagues and seasons) and Tribal Wars (building a fortress together, wars).

**The one rule:** everything is earned by real training. Nothing is bought, nothing grows while you rest, and **XP is never given for volume** (kg × reps), so padding a workout with junk sets earns nothing.

- All numbers below live in `src/lib/game/config.ts`. They are a first pass to tune with real use.
- The formulas are small pure functions in `src/lib/game/` with unit tests.
- The design system is unchanged: white glass, grey pills, red only for progress, PRs and highlights.

## Glossary

| Word | Meaning |
|---|---|
| **XP** | Experience. Never resets. Sets the **level** and the **rank**. |
| **Laurels** | Season points. Set the **league**. Partly reset every month. |
| **Denarii** | Coins. Earned by training, spent on gear. |
| **Hours** | Time in the gym from verified visits. They build the fortresses and your house (§5). |
| **Ludus** | A crew of 2–10 people (friends, any gyms). Builds a fortress, fights wars. |
| **Tribe** | Everyone whose home gym is the same gym. Builds the gym fortress, fights Bellum. |
| **Verified workout** | A workout inside a gym visit checked in and out with the gym's QR code and GPS. |

## What counts as a workout

A **qualifying workout** is a finished workout with at least **3 done working sets** (warm-ups don't count). Only qualifying workouts earn anything.

A **qualifying run** (section 11) is worth exactly one qualifying workout. Everything below that says "workout" means a workout or a run.

## 1. XP and ranks

Per qualifying workout:

| Source | XP |
|---|---|
| Workout | 100 |
| Verified at the gym (QR) | +25 (an incomplete visit: +12) |
| PR | +30 each, at most 3 per workout |
| Week streak | +10 per week of the current streak, at most +50 |
| Trained together (confirmed) | +20 |

- **Daily cap:** 300 XP per day. A second or third workout that day only fills what is left.
- **No XP for volume, sets or reps.**
- **Unusual PR jumps** (see Anti-cheat) give no PR reward.
- XP is computed from the whole history, so existing users start with the level they earned.

**Levels.** Reaching level L takes `50·(L−1)² + 100·(L−1)` XP in total: level 2 after one workout, level 10 after ~5 000 XP (about 3 months at 3 workouts a week), level 20 after ~20 000 XP.

**Ranks** follow the level:

| Rank | From level |
|---|---|
| Tiro | 1 |
| Gladiator | 5 |
| Veteranus | 12 |
| Primus Palus | 25 |
| Rudiarius | 40 |

**Where:** Profile shows the level, rank and an XP bar under the name. The workout summary shows "+145 XP" counting up with what it came from, the bar filling, and a level-up or new-rank banner.

### The cell (your own home)

Every gladiator has a **cell** on their profile. It is **cosmetic only**, for showing off: it grows with the rank (Cell → Barracks room → Private room → Quarters → Villa) and gets a new item at set levels (straw bed, oil lamp, training post, shield, helmet, trident, amphora, armour, laurel wreath, the rudis, a marble bust). Locked items show the level they open at. Others see your cell on your profile.

## 2. Leagues and seasons

A **season** is a calendar month. Laurels are earned per qualifying workout:

| Source | Laurels |
|---|---|
| Attendance (first qualifying workout of the day) | 10 |
| Verified at the gym | +5 (incomplete visit: +2) |
| Progress (fair scoring, see below) | up to +10 per workout |
| Strength (DOTS) | up to +5 per workout |
| Weekly target hit (the workout that hits it) | +15 |
| Duel won | +25 |
| Ludus war won | +30 each member |
| Bellum won (gym of the month in the city) | +40 each active member |

- **Daily cap:** 45 laurels from workouts. Duels, wars and Bellum come on top.
- **Leagues** by season score: **Bronze** 0 · **Silver** 150 · **Gold** 350 · **Imperator's Arena** 700.
- **Partial reset:** a new season starts with half of last season's score, at most 300 (so nobody starts in Gold).
- **Where:** City → Colosseum → League (the season's table for friends, the gym or everyone) and a small season card on Today.

## Fair scoring (beginner vs. strong)

So beginners can compete with strong people:

- **Progress, not absolute weight.** A PR earns `gain % × level factor` laurels (at least 1, at most 10 per workout), where gain % is how much the new best e1RM beats the old one. Level factor: beginner 1.0, intermediate 1.5, advanced 2.0 (advanced lifters grow slower).
- **Baseline.** The first 3 weeks of an exercise set its baseline: PRs in that time earn no progress laurels, so nobody gains by starting low on purpose.
- **Attendance and consistency** carry the most weight (everyone has the same chance).
- **Strength** has a small weight: `DOTS of the best squat + bench + deadlift e1RM ÷ 60`, at most 5 per workout. Matyáš decided DOTS is used in the game too. The DOTS score is computed on the device from the user's own bodyweight; the weight never leaves the private table.

## 3. Gym visits: QR check-in and check-out

A visit proves you were at the gym.

1. **Check in:** scan the gym's QR poster (in the app or with the phone camera). The app reads GPS. A visit starts.
2. **Check out:** scan the same code again when leaving. The minutes are counted.
3. **Forgot to check out:** after 3 hours the visit closes as **incomplete** (smaller reward).
4. **Verified** = both scans have a valid code and were within **150 m** of the gym, and the visit lasted **20 min – 4 h**. Shorter or longer visits are not counted for wars and Bellum.
5. **Offline:** the scan and the position are saved on the device and checked when they sync (up to 48 hours late).

- **The code** is `…/visit/<gym id>.<signature>`. The signature is an HMAC-SHA256 of the gym id with the gym's secret key, made and checked **only on the server**: a Postgres trigger verifies every visit as it is written (no Edge Function needed, works on the free plan).
- **Workouts** started during a visit are **verified** (from 15 min before check-in until check-out). A workout at home or outside is **unverified**: it counts for the log, PRs, XP and laurels, but not for wars and Bellum, and earns fewer denarii.
- **The poster:** the gym's manager (whoever added the gym, or an admin) opens Arena → My gym → **QR poster** at the gym, taps "Use my location" once, and prints the poster.
- **Later** (after agreeing with a gym): a tablet at the desk with a code that changes every 30 seconds.

## 4. Ludus and denarii

- **Tribe** = everyone with the same home gym. Nothing to join.
- **Ludus** = a crew of up to 5 people to start (barracks raise it to 10), across any gyms. It needs 2 members to fight. Create one with a name and a motto, invite with a code, link or QR. One ludus per person. Whoever creates it leads it; if the leader leaves, the longest member takes over; the last one out closes it.

**Denarii** per qualifying workout:

| Source | Denarii |
|---|---|
| Verified workout | 20 (incomplete visit 12, unverified 8) |
| PR | +5 each, at most 3 |
| Week streak | +1 per week, at most +5 |
| Trained together with a ludus member | +10 |
| Machines in your ludus or gym fortress | +5 % per level for workouts with that exercise |

- **Daily cap:** 60. Without a verified visit that day the server accepts at most 30.
- **Wallet** = denarii earned − gear bought. Denarii buy gear in the forge.
- Until 2026-11-27 denarii could be given to a ludus or gym treasury. Since building is paid in hours (§5), those gifts went back to the people who gave them.

## 5. Hours and building the fortress

**Hours are time in the gym** (Matyáš, 2026-11-27). They pay for everything that is built: the fortress of the ludus, the fortress of the tribe and your own house.

- Every **verified visit** (§3: both scans valid, 20 min – 4 h) adds its minutes, check-in to check-out, the moment it is verified, to three treasuries at once:
  - **your house** (§5a),
  - **your ludus**, for visits from the day you joined it,
  - **your tribe**, for visits at your home gym.
- An incomplete, rejected or uncounted visit adds nothing. A workout alone adds nothing: only the visit counts.
- Hours cannot be given, bought or moved. They stay with the treasury they went to: a member who leaves a ludus takes nothing back.
- Visits verified before hours existed count too: the update credits them once.
- The app shows whole hours ("37 h"); the database keeps minutes.

The ludus and the gym (tribe) each have a fortress. Any member can start a building when the treasury has enough hours. One construction at a time; it takes real time.

| Building | Levels | Effect | Cost per level (ludus) |
|---|---|---|---|
| Bench | 3 | +5 % denarii per level for workouts with a bench or chest press | 6 h × level |
| Squat rack | 3 | +5 % per level for squats and lunges | 6 h × level |
| Cable station | 3 | +5 % per level for cable and pulldown exercises | 6 h × level |
| Deadlift platform | 3 | +5 % per level for deadlifts and hip thrusts | 6 h × level |
| Palisade (walls) | 5 | Defence: +5 % war points per level when attacked (gym: +2 % in Bellum) | 5 h × level |
| Barracks (ludus only) | 5 | +1 member per level | 8 h × level |
| Temple | 3 | Prestige: shows the ludus records | 10 h × level |

- The gym fortress costs **3×** as much (it is a bigger community, so it also gathers more hours).
- A ludus of 5 who each train 3 hours a week gathers 15 h a week: a bench takes under a week, every machine at level 3 about ten weeks.
- **Build time:** level × 1 day (level 3 takes 3 days).
- **Timers** need no cron job: the database stores when a building is ready and every read treats it as done from then on.
- A **damaged** building (lost war) gives no bonus until repaired for 40 % of its level cost. Nothing is ever destroyed.
- **Spoils** of a won war are hours: 20 % of the loser's treasury, at most 12 h (ludus war) or 20 h (tribe attack). A tribe attack costs the attacking tribe 4 h (a revenge attack is free).

**The training ground (planned, Matyáš 2026-11-27).** The fortress is built like the city: its buildings stand on a grid that grows from its heart (the ludus's school, the tribe's arena), each new one next to one already built. The machines, the walls and drill props (palus, weapon rack, brazier, water trough) stand there, not in the city. Anyone in the ludus or tribe may build; a building stays where it was placed (nobody moves or removes it). Who decides about building is open (Matyáš, later).

### 5a. Your house

Your own house (your domus) is the first thing in the City you upgrade yourself, with **your own hours**.

| Level | House | Cost |
|---|---|---|
| 1 | Hut | free, everyone starts here |
| 2 | Small stone house | 10 h |
| 3 | Domus | 25 h |
| 4 | Villa | 50 h |
| 5 | Palace | 100 h |

Things to build by the house, 5 h each, from house level 2: a garden (hortus), a fountain, a pergola with a vine, a household shrine (lararium) and a private training corner (palaestra). Cosmetic only, like the cell.

### 5b. The aqueduct (planned)

The longer the aqueduct, the more each verified visit brings: **+2 % hours per arch, at most +20 %** (10 arches), for the treasury of the city it stands in. It waits for the decision on whose city it is (Matyáš, later).

## 6. Ludus wars

- The leader **declares war** on another ludus. Both need 2+ members, neither can be at war, and the same two can't fight twice in 7 days. The war runs **3 days** from the declaration.
- **Points** come only from **verified workouts** in the window: 10 per workout (2 a day at most), +5 per PR (3 at most), +5 per day trained.
- **Per active member:** each side's points are divided by its active members at the start (trained in the 14 days before, at least 2), so a small crew can beat a big one.
- **Defender** gets the palisade bonus.
- **The winner** takes 20 % of the loser's hours (at most 12 h) and every member gets +30 laurels. **The loser** gets one building damaged. A tie goes to the defender.
- Settled by whoever opens the war after it ends (no cron).

### Gloria, the record and ludus badges

- **Gloria** is the ludus's lasting fame. It never resets and never drops below 0.
  - **Win:** +30, plus +1 for every 10 gloria the loser had more than the winner (at most +30 more).
  - **Loss:** −10, or nothing after a close fight (at least 90 % of the winner's score).
- **Record:** wins, losses, attacks beaten (won as defender), giants slain (won against more gloria), the current and the longest run of wins.
- **Ludus ranking** by gloria (then wins): City → Ludus, the top 10 with your own ludus, "See all" for the top 50. Tap a ludus to see its record and badges.
- **War history:** the last 5 wars with the gloria won or lost, "All wars" for the rest.
- **Ludus badges** (earned by the crew, shown on the ludus and in the ranking):

| Badge | Counts | Tiers |
|---|---|---|
| Victories | wars won | 1, 5, 10, 25, 50 |
| Unbroken | longest run of wins | 3, 5, 10 |
| Iron wall | attacks beaten | 1, 5, 10, 25 |
| Giant slayer | wins against a ludus with more gloria | 1, 3, 10 |
| Gloria | the most gloria reached | 100, 250, 500, 1000, 2000 |

## 7. Duels and Bellum

- **Duel:** challenge a friend for 7 days from the moment they accept: **most workouts** or **most kg added** to one lift's e1RM. The winner gets +25 laurels; a tie gives nothing.
- **Bellum:** every month the gyms of a city fight. Score = verified visits (one per person per day) ÷ active members (at least 3 to rank), plus the gym's palisade bonus. Members of the winning gym who trained get +40 laurels after the month ends.
- **Where:** City → Colosseum → Duels and Bellum.

## 8. Attributes (character sheet)

On City → Your domus, 0–99 each:

- **Strength:** DOTS of the best squat + bench + deadlift e1RM ÷ 5 (needs bodyweight and sex)
- **Endurance:** working sets in the last 90 days ÷ 12
- **Discipline:** weeks in the last 12 that hit the weekly target, as a share of 99

## 9. The city, fighting styles and gear

**The city** (the City tab) is the way into the game: the Colosseum (league, duels, Bellum and the map), your ludus, the temple (your gym's tribe and its fortress), the forge, your domus (your gladiator) and the market and the baths (both later).

**Names in the app.** The app uses the same names as this document: ludus (plural ludi), tribe, domus and the rest.

**Building the city (planned, Matyáš 2026-11-26).** The city is a grid that grows from its arena; there is no board to fill. Every building is a painted piece on its own diamond plot of 1×1, 2×2 or 3×3 tiles (`assets/game/painted/city/`, anchors in `manifest.json`). In edit mode the player sees the grid: the free tiles that touch the city. A new piece must share at least one edge with a piece already built, so the city only grows outwards and stays in one block. The ground exists only under built plots; the app draws earth sides along the city's outer front edges. Pieces are drawn back to front: one goes behind another when its tiles all lie at smaller i, or all at smaller j. Pieces cannot be rotated (each is painted from one side).

**Playing is a choice.** Sign-up asks "Play the game" or "Just track workouts"; players from before were asked once in What's new; Settings changes it any time. Off hides the City tab and the game's cards (season, check-in, war alert, the workout reward, other players' levels); the game keeps counting on the server, so turning it on later loses nothing. The choice is the account's: kept per user on the device and in the Supabase Auth user metadata (`game: 'on' | 'off'`), see `src/features/game/gameMode.ts`.

### Fighting style

Chosen in Forge → Style. The style sets how the gladiator looks and gives **+15 XP** for a workout trained its way (inside the daily XP cap). The first choice is free; after that it changes **once a season**. The style in force when a workout started counts, so a change never takes back XP.

| Style | Rewards | A workout earns the bonus when |
|---|---|---|
| Murmillo | Strength | a working set of 6 reps or fewer (with weight) |
| Thraex | Hypertrophy | at least 2/3 of the working sets are 8–15 reps |
| Retiarius | Endurance | it has cardio or a superset |
| Secutor | Discipline | last week hit the weekly target |
| Hoplomachus | Versatility | 4 or more muscle groups |
| Bestiarius | Bodyweight | at least half the working sets have no added weight |

The bonus is flat, so more sets never earn more (the "no XP for volume" rule holds).

### Gear

Five slots: helmet, weapon, shield, guards, armour. Everyone starts with the Galea, Rudis, Parmula, Fasciae and a Tunic. Every piece has a **power**; the sum is the gladiator's **gear power** (120 at the start, 490 at most).

- A piece opens by **denarii** (bought from the wallet), a **level**, a number of **verified workouts**, or a **league** reached in any season. Never by money.
- The catalog with powers and prices is `GEAR_ITEMS` in `src/lib/game/gear.ts` (same as `gear_info()` in SQL).
- **In tribe wars** each active member adds `15 % × power ÷ 490`; a side's bonus is the average of its active members, taken when the war is declared.

## 10. The map and tribe attacks

The **map** (City → Colosseum → Map, or Bellum → Map) shows the tribes (home gyms) of your city at their positions, with a territory that grows with the gym fortress level. Filters: all, at war, weaker, stronger (within 10 % counts as even).

- **Strength** of a tribe = 20 per verified workout of its members in the last 14 days + the gear power of those members.
- **Territory:** every gym starts holding its own. A tribe that wins an attack takes every territory the defender holds. The **city ranking** is by territories, then fortress level.
- **Declare an attack:** any tribe member from level 5 (Gladiator), on a tribe of the same city. Both need 3 members with a verified workout in the last 14 days; neither can be at war; the same two not twice in 7 days. It costs **4 hours** from the tribe's treasury (a revenge attack is free).
- **Timing:** a **24-hour warning** (members pledge to train: "I pledge to train within 24 h"), then **3 days** of battle.
- **Points:** like ludus wars (10 per verified workout, 2 a day, +5 per PR up to 3, +5 per day trained), per active member (at least 3), times `1 + gear bonus`, plus the defender's walls (+3 % per palisade level).
- **The winner** takes 20 % of the loser's hours (at most 20 h) and the loser's territories (if the attacker won). **The loser** gets a building damaged, the walls first. Nothing is destroyed. A tie goes to the defender.
- **Revenge:** within 24 hours of a lost defence the tribe can attack the winner back for free with **+20 %** points, even inside the 7 days.
- Settled by whoever opens the war after it ends (no cron).

## 11. Running

Running is a second way to train, balanced so a runner and a lifter compete on equal terms. **The one rule holds: no points for kilometres.** A run earns what a lifting session earns, so a marathon is not worth five gym sessions.

### Logging a run

Workouts → **Log a run** (manual entry for now; GPS recording comes with the native apps). Offline first, like every write.

| Field | Required | Notes |
|---|---|---|
| Day and start time | yes | today or the 6 days before; an empty start time means "just finished" |
| Distance | yes | km, two decimals |
| Duration | yes | h:mm:ss |
| Where | yes | Outdoor / Treadmill (segmented) |
| Average heart rate | no | bpm, 60–220. **Private**, like bodyweight |
| Elevation gain | no | m |
| Note | no | |

- **Pace is not entered**, it follows from distance and time and shows live under the fields ("5:12 /km"). Entering both could contradict.
- Others see the distance, time and pace. The heart rate is only ever seen by the owner.

### What counts

A **qualifying run**: at least **3 km or 20 minutes**, an average pace between the world-record pace for that distance and **12:00 /km** (slower is a walk), at most 100 km and 12 hours.

### Rewards (the same as a workout)

| | Run |
|---|---|
| XP | 100 + PR (+30 each, 1 per run) + week streak + trained together |
| Laurels | attendance 10, progress up to +10, strength up to +5, weekly target |
| Denarii | as an unverified workout, or verified when run during a gym visit (treadmill) |
| Daily caps | **shared** with lifting: a run and a lifting session on one day fill the same 300 XP / 45 laurels |
| Weekly target | a run counts as a training day |
| Fighting style | earns the Retiarius bonus |

- **Standard distances:** 5 km, 10 km, half marathon (21.1 km), marathon (42.2 km). A run counts for distance *d* when it is *d* to *d* × 1.05 long; its time is scaled to *d* (`time × d ÷ distance`).
- **PR:** a new best time on a standard distance.
- **Progress laurels:** `gain % × level factor`, where gain % is how much faster the new best is than the old one. Same level factor, same 3-week baseline per distance as lifts.
- **Strength laurels:** the runner's equivalent of DOTS is **VDOT** (Jack Daniels, from the best run of the last 90 days). `(VDOT − 30) ÷ 4`, at most 5, so VDOT 50 reaches the cap like DOTS 300. No bodyweight needed.

### Wars

**Runs count in ludus wars, tribe attacks and Bellum** like verified workouts (Matyáš decided 2026-11-14): 10 points, at most 2 a day together with workouts, +5 per PR, +5 per day trained. They also count for active members, "workouts" duels, tribe strength and the gear opened by verified workouts. The gym-visit bonuses (XP, laurels, denarii) stay for QR visits only.

### Arena

Arena gets a **Running** metric group: best 5 km, best 10 km, VDOT, and km in the period. The km board only shows; it earns nothing.

## Anti-cheat

- **Daily caps** for XP, laurels and denarii, enforced by the database (check constraints).
- **Denarii without a verified visit** are capped lower by a trigger.
- **QR + GPS** visits, signed codes checked on the server.
- **Unusual PR jumps:** a new best more than 25 % above the old one (once there are 2+ sessions of that exercise) or over 1000 kg earns no PR reward. The PR still shows in the log.
- **Runs:** faster than the world-record pace for the distance is refused (database check). A new best more than 10 % faster than the old one (once there are 2+ runs on that distance) earns no PR or progress reward. Runs that count in wars can be reported from the war screen.
- **Reports** from other users (the existing report flow) for ludus names and profiles.

## Data

Tables (`supabase/updates/2026-11-13-game.sql`, also in `schema.sql`):

| Table | What | Read | Write |
|---|---|---|---|
| `game_days` | per user and day: xp, laurels, denarii, workouts, prs (capped) | signed-in users | owner (through the queue) |
| `game_carry` | per user and season: laurels carried over (≤ 300) | signed-in users | owner |
| `laurel_awards` | laurels from duels, wars, Bellum | signed-in users | server functions only |
| `gym_secrets` | the HMAC key per gym | nobody (functions only) | functions |
| `gym_visits` | check-in/out scans, position, server-set `in_ok`, `out_ok` (status follows from the times) | owner only | owner (scans); the trigger sets the checks |
| `ludi`, `ludus_members` | crews and who is in them; gloria and the war record on `ludi` (set by `settle_war()` only) | signed-in users | functions (`create_ludus`, `join_ludus`, `leave_ludus`, `remove_member`) |
| `treasuries` | hours (`minutes`) per ludus/gym; the old `denarii` column is unused since 2026-11-27 | members | visit credits, building |
| `visit_credits`, `homes`, `home_items` | which visits paid in their minutes, your house and its things | owner | trigger on `gym_visits`, `upgrade_home()`, `build_home_item()` |
| `buildings` | level, target level, ready at, damaged | signed-in users | `start_building()`, `repair_building()` |
| `ludus_wars` | the two sides, window, member counts, result, gloria won or lost per side | signed-in users | `declare_war()`, `settle_war()` |
| `duels` | challenger, opponent, kind, exercise, window, result | the two players | `create_duel()`, `answer_duel()`, `settle_duel()` |
| `bellum_results` | a city's month: gym, score, place | signed-in users | `settle_bellum()` |
| `gladiators` | style (and its history), the worn gear, gear power | signed-in users | `choose_style()`, `equip_gear()` |
| `gear_purchases` | pieces bought with denarii (the wallet subtracts them) | owner only | `buy_gear()` |
| `tribe_wars` | attacker and defender gym, warning and battle window, revenge, active members, gear and wall bonus, result | signed-in users | `declare_tribe_war()`, `settle_tribe_war()` |
| `tribe_pledges` | who pledged to train for a war | signed-in users | `pledge_defence()` |
| `territories` | who holds a gym's territory (no row = the gym itself) | signed-in users | `settle_tribe_war()` |
| `workout_sessions` (runs) | `kind = 'run'` with `distance_m`, `duration_s`, `run_place`, `elevation_m`, no sets; checks for impossible paces | like workouts | owner (through the queue) |
| `session_ratings.avg_hr` | a run's average heart rate, private like rpe and feel | owner only | owner (through the queue) |

Running: `supabase/updates/2026-11-14-running.sql`. `session_counts(s)` is the server's `qualifies()`; `verified_sessions()` includes runs that count; `get_leaderboard()` learns `run_5k`, `run_10k` (seconds, lower is better), `vdot` and `run_km`.

The city and the map: `supabase/updates/2026-11-14-city.sql`. The map comes from `city_map(city)`, an enemy tribe's best three and its weekend share from `tribe_info(gym)`, live scores from `tribe_war_scores(war)` and my part from `tribe_war_me(war)`.

The temple's hall of records comes from `ludus_records()` (best squat, bench and deadlift e1RM of the members). The ludus ranking comes from `ludus_ranking()`.

- Gym positions (`gyms.lat`, `gyms.lng`) are set by the gym's manager. Visit positions are visible to their owner only.
- Bodyweight never leaves `bodyweight_logs`. DOTS for laurels and Strength is computed on the user's own device; the server's DOTS (leaderboards) reads the weight only to compute the score and never returns it.
