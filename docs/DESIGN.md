# Colosseum — design system

Style: white, minimal, Apple "liquid glass". The design is final; match it.

## Reading the screen reference files

`design/screens/*.dc.html` are the exact screens, exported from the design canvas. Each file is 390 px wide, which is the iPhone logical width.

- **Layout** is in the inline `style="…"` attributes. Copy sizes, gaps, radii and font sizes from there.
- **Placeholders:**
  - `{{accent}}` = `#B91C1C`
  - `{{blobA}}` = the accent at 12–18 % opacity, used for the soft background glow
  - Other `{{…}}` values are sample data
- **Script block:** the `<script type="text/x-dc">` block at the bottom holds the sample data and the small interactions (toggles, selected chips). Use it to understand behavior, not as code to copy.
- **Wrapper elements:** `<x-dc>`, `<helmet>`, `<sc-for>` and `<sc-if>` belong to the design tool. They mean the component root, head styles, a loop and a condition.
- **Images:** `/_blob/4d586614d0b82fe0450bf1c19743498e` is the bench-press illustration. In the project it is `assets/exercises/bench-press.jpg`.
- **Logo:** `Logo.dc.html` shows the logo explorations. The chosen logo is **5G**, which is `brand/logo-mark.svg`.
  - The small mark next to the COLOSSEUM wordmark in `Main.dc.html` and `Onboarding.dc.html` is an older logo. Use `brand/logo-mark.svg` there instead.
- **Heights:** 844 px is one iPhone screen. Workouts (1090) and ProgramEdit (960) are taller because they scroll.

## Tokens

`tokens.css` (at the repo root) is the source; mirror it in `src/theme/tokens.ts`.

| Token | Value | Use |
|---|---|---|
| accent | `#B91C1C` | active tab, PRs, progress, completed sets, links like "Sign in" |
| bg | `#F2F2F7` | screen background |
| text | `#1C1C1E` | primary text |
| text2 | `#6C6C70` | secondary text, captions, inactive tab |
| text3 | `#AEAEB2` | chevrons, future calendar days (decorative only) |
| fill | `rgba(118,118,128,0.12)` | grey buttons, chips, inputs, avatar placeholders |
| fillStrong | `rgba(118,118,128,0.18)` | trained days in the calendar, completed week days |
| separator | `rgba(60,60,67,0.18)` | 0.5 px list dividers |
| success | `#16A34A` | "training now" dot |
| glass | `rgba(255,255,255,0.72)`, blur 30, saturate 180 %, border 0.5 px `rgba(255,255,255,0.9)`, shadow `0 1px 1px rgba(0,0,0,.03), 0 8px 24px rgba(0,0,0,.05)` | cards, tab bar, floating bars |
| glow | accent at 12–14 %, a 420×300 ellipse, blur 80, behind the top of a screen | one per screen, gives the glass something to refract |

**Type** (system font; SF Pro on iOS):

| Style | Size / weight | Letter spacing |
|---|---|---|
| Large title | 34 / 700 | −0.8 |
| Title | 22 / 700 | −0.4 |
| Section | 20 / 700 | −0.3 |
| Body | 15–17 / 400–600 | — |
| Caption | 12–13 / 400–500, `text2` | — |
| Tab label | 10 / 600 | — |
| Wordmark | Cinzel 700, 12 px | 3 px |

**Radii:**

| Element | Radius |
|---|---|
| Large cards | 24–26 |
| Lists and small cards | 22 |
| Pills | full |
| Inputs | 10 |
| App icon preview | 22.37 % |

**Spacing:**

- Screen side padding 20
- Vertical gap between blocks 14–18
- Tab bar: 24 px from the sides, 28 px from the bottom, plus the safe area; height 62

## Components

| Component | Spec |
|---|---|
| **GlassCard** | glass surface, radius 22–26, padding 14–18 |
| **FillButton** | height 50 (primary) or 36 (small), full radius, `fill` background, `text` color, 600 weight. Primary actions put a red icon before the label (e.g. a red ▶ in "Start workout"). **Never black.** |
| **TextButton** | plain `text2` or accent label, e.g. "Change", "Edit", "Sign in" |
| **IconButton** | 36 × 36 circle, `fill`, 18 px icon |
| **Segmented** | track = `fill`, height 36, padding 2. Selected segment = white pill with shadow `0 2px 6px rgba(0,0,0,.08)` and 600 weight. Others are transparent with 500 weight. |
| **Chip** | height 34, padding 0 14, full radius. Unselected = `fill`. Selected = white + shadow + 600 weight. Multi-select chips show a small red check. |
| **ListRow** | height 50–64; a separator between rows but not after the last one; grey chevron on the right when tappable |
| **Avatar** | circle with `fill` background and initials, or a photo; sizes 34 / 38 / 54 / 62 |
| **TabBar** | glass capsule. Active tab = `fill` lozenge with accent icon and label; inactive = `text2`. Icons: lucide `house`, `dumbbell`, `trophy`, `user` |
| **ProgressRing** | 80 px, stroke 7, track `fill`, progress in accent with a round cap, starting at 12 o'clock |
| **Sparkline** | 2–2.5 px accent line with round joins; the last point is a white dot with an accent stroke |
| **MonthCalendar** | 7 columns, 34 px circles, Monday first; states as in PRODUCT.md |
| **SetRow** | grid `30px 1fr 64px 52px 36px`; kg and reps are `fill` inputs 34 px high; the check is a 32 px circle (accent when done); a done row has an accent tint at 7 % |
| **Podium** | 3 columns; 1st in the middle, 96 px tall, 62 px avatar with a 2.5 px accent ring; 2nd is 72 px, 3rd is 56 px. The rank number sits on a glass block. |
| **FloatingBar** | glass capsule 66 px high at the bottom of the active workout: rest timer (accent numbers) on the left, "Next" FillButton on the right |

## Glass on each platform

- **Web:** use CSS `backdrop-filter: blur(30px) saturate(180%)` with the translucent white background.
- **iOS and Android:** use `expo-blur` `<BlurView intensity≈60 tint="light">` wrapped in a view with the white overlay and border.
- **Fallback:** if blur is unavailable, use `rgba(255,255,255,0.92)`.

## Accessibility

- Touch targets are at least 44 px
- Icon-only buttons have `accessibilityLabel`
- Color is never the only signal: a PR also shows the text "PR"
- Support the iOS text size setting where reasonable

## Brand assets

| File | Use |
|---|---|
| `brand/logo-mark.svg` | red logo mark; `currentColor` is set to `#B91C1C` |
| `brand/logo-mark-white.svg` | white logo mark |
| `brand/app-icon-*.png` | app icons: 1024 for the stores, 180 as `apple-touch-icon`, 192/512 and maskable versions for the PWA manifest, 32 as favicon |
| `manifest.webmanifest` | PWA manifest |
