# Colosseum badges — design brief

Paste everything below the line into Claude Design and attach: `logo-mark.svg`, `soucasne-1.png`, `soucasne-2.png`, `badges.json`.

---

Design the achievement badges for **Colosseum**, a social gym tracker (iPhone-style PWA). The name comes from gladiators who trained and competed together. The attached screenshots `soucasne-1.png` and `soucasne-2.png` show the current, placeholder badges. `badges.json` lists all 20 badges, every tier with its title, and the visual level (1–5) each tier uses. `logo-mark.svg` is the app logo (laurel wreath + dumbbell).

## What I need

A single page (artboard) with:

1. **The medallion system: 6 states.** One shared frame that changes with the level, so a user sees at a glance that a badge got better:
   - **Locked** (not earned yet): grey, clearly "not yet", but the badge is still recognisable.
   - **Level 1 → 5**: each level visibly richer than the last. Think bronze → legendary progression, but **expressed in red only** (see colours). Ideas to escalate with: wreath density/size, disc fill (outline → tint → solid), a second ring, a ribbon/banner, stars, laurel tips closing into a full crown, subtle shine. Level 5 must feel like the top.
2. **20 badge symbols**, one per badge in `badges.json`, drawn in one consistent style. They sit in the centre of the medallion. The `currentIcon` field is just what we use now (Lucide icons); design better, more specific symbols where it helps (e.g. a sunrise over a barbell for Early bird, a helmet for Comeback, a gladiator shield for Squad).
   - **Bench, Squat and Deadlift clubs show the number** (60, 100, 140…) in the centre instead of a symbol. Design how the number sits in the medallion, and show a small hint of the lift (tiny bench/squat/deadlift glyph or label) if it fits.
3. **The full grid**: every badge × every tier it has (77 tiers) plus its locked state, laid out like the screenshots, with the tier title under each medallion.
4. **In context**: the badges in these three places, at these sizes:
   - Profile → Badges: a 3-column grid on a white glass card, medallion **64 px**, title below (12 px, semibold), thin red progress bar under locked ones.
   - Badge detail sheet: big medallion **120 px**, description, then a list of every tier with a **40 px** medallion, title and date; tiers not reached yet shown faded.
   - Workout summary card "New badge": medallion **76 px**, title below.

## Rules (fixed, do not change)

- **Colours**: background `#F2F2F7`, text `#1C1C1E`, secondary text `#6C6C70`, accent red `#B91C1C`. Badges use **only this red** (with its tints/shades and white) for earned levels, and greys (`#AEAEB2`, `rgba(118,118,128,0.12)`) for locked. **No gold, silver or bronze, no other hues.** The progression must come from form and fill, not colour.
- **The laurel wreath from the logo** is the base of the medallion. Keep its character (leaf shape, two branches); you may add or remove leaves per level.
- **Readable at 40 px**: the symbol must stay clear at the smallest size. Avoid hairlines and tiny detail; strokes around 2 px at 24 px icon size.
- **Flat vector**, no photos, no 3D renders, no drop shadows inside the badge. A subtle inner highlight is fine.
- **Works on white and on `#F2F2F7`** (cards are white frosted glass).
- Text on badges: English only, and only the numbers for strength clubs. No other text inside the medallion.
- Icons/shapes must be expressible as **plain SVG** (paths, circles, ellipses, rects; gradients OK, no filters or masks if avoidable), because they get rebuilt in `react-native-svg`.

## How it gets built (so the design stays buildable)

- The medallion is drawn in code from 3 layers: **frame** (wreath + disc + level ornaments) → **symbol or number** in the centre → **extras** (stars, ribbon).
- So please keep the **frame per level independent of the badge**, and the **symbols independent of the level** (a symbol may just switch colour: red on light discs, white on solid red discs).
- At the end, give me the **SVG source** for: the 6 frame states (viewBox 0 0 100 100) and the 20 symbols (viewBox 0 0 24 24), each one labelled with its badge `id` from `badges.json`.
