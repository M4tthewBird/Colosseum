# Colosseum: painted game UI and animations

Spec for Claude Code. It describes the painted (hand-painted isometric) look of the game part of the app and exactly how every animation works, so it can be rebuilt in Expo / React Native.

Status: concept from the design canvas "Colosseum – malovaný styl". Build it only when `docs/ROADMAP.md` reaches the game phase. Ask Matyáš before adding any new dependency.

Reference files:

- `design/screens/painted/*.dc.html`: the screens from the canvas. They are HTML with inline styles and CSS keyframes. Open them in a browser to see the animations running; treat them as the visual and timing reference.
- `assets/game/painted/city.jpg`: the current painted city (1296 × 832 px).
- `assets/game/painted/city-cut.webp`: the same city with the cream background removed (alpha).
- `docs/GAME.md`: the game rules (leveling, tribes, wars). This file only covers the painted look and its motion.

## 1. The idea in one paragraph

The art is raster: paintings generated in Gemini from one style reference. Nothing inside a painting moves. All motion is a thin layer of simple effects drawn on top of the painting (light, smoke, fire, water, clouds, birds, pins, banners). Every effect is positioned in the painting's own pixel coordinates, so one scale and one offset place the whole layer correctly on any screen size.

## 2. Coordinate system (most important rule)

- Every painting has a "stage": a box exactly the size of the source image (for `city.jpg` 1296 × 832).
- The image and all effect layers are children of the stage and use **source-image pixels** for `left`, `top`, `width`, `height`.
- The stage is scaled and moved as one unit: `transform: [{ translateX }, { translateY }, { scale }]` with origin top-left.
- **Pins and labels are not inside the scaled stage.** They live in the parent and are placed at `x * scale + offsetX`, `y * scale + offsetY`, so they keep their real size (44 × 44 px touch target) at any zoom.
- Cropping a building for a header uses the same stage: compute a "cover" fit of the crop box into the header size.

```ts
// cover-fit a crop box [x0, y0, x1, y1] of the source image into a W × H viewport
function coverFit([x0, y0, x1, y1]: number[], W: number, H: number) {
  const w = x1 - x0, h = y1 - y0;
  const scale = Math.max(W / w, H / h);
  return {
    scale,
    left: -x0 * scale + (W - w * scale) / 2,
    top: -y0 * scale + (H - h * scale) / 2,
  };
}
```

When a new city painting arrives (`city-full.png`), only the numbers in the data file change. Keep all coordinates in one file, for example `src/game/city/cityLayout.ts`, never inline in components.

## 3. Asset pipeline

1. Gemini output: PNG on a flat cream background `#F2EBDB` (see the prompt document "Colosseum – prompty pro malovaný vizuál").
2. Background removal (a small Node or Python script in `scripts/`):
   - Flood fill from all image borders through pixels whose colour distance to the background is below 26 (sum of |ΔR| + |ΔG| + |ΔB|, background sampled from the corner).
   - Filled pixels become transparent; erode the mask by 1 px, then blur the alpha by 0.8 px for a soft edge.
   - Export WebP with alpha, quality about 90. The current city goes from 1.5 MB PNG to about 210 kB.
3. File names follow the prompt document (`building-*.png`, `gym-1..5`, `home-1..4`, `glad-*`, `item-*`, `icon-*`, `league-*`, `scene-*`). Store them in `assets/game/painted/<group>/`.
4. Ship two sizes per image: full for the city and headers, and a small one (about 256 px) for list thumbnails.

## 4. Painted theme tokens

Use these only inside the game screens. The rest of the app keeps the existing design system.

| Token | Value | Use |
| --- | --- | --- |
| `paper` | `#F2EBDB` | screen background, matches the painting background |
| `ink` | `#2B2118` | text |
| `inkMuted` | `#6B5C48` | secondary text (contrast passes on `paper`) |
| `accent` | `#B91C1C` | same red as the app: active tab, war, primary buttons |
| `gold` | `#A87B24` | denarii |
| `card` | `rgba(255,251,243,0.88)` + 1 px `rgba(59,47,34,0.12)` border, radius 22, shadow `0 6 24 rgba(59,47,34,0.10)` | cards and the bottom sheet |
| `fade` | gradient from transparent to `paper`, 90–110 px tall | bottom edge of every painting header |
| Title font | Cinzel 700/900 | building names, ranks |
| Body font | Inter / system | everything else |

## 5. Animation catalogue

All timings come from the canvas. "Delay" values are negative so the loop is already mid-cycle when the screen opens.

| Effect | Where (source px) | How it moves | Timing |
| --- | --- | --- | --- |
| Map pan | whole stage on the phone map | translateX from −90 to −380 px (stage scaled 0.66, viewport 390 px wide), back and forth | 44 s, ease-in-out, alternate, pauses while touched |
| Arena glow | ellipse 270 × 170 at (515, 262) and 290 × 200 at (505, 300) | warm radial gradient `#FFD682 → #FFAA46 → transparent`; opacity 0.35 → 0.9 and scale 0.96 → 1.04 | 2.6 s and 3.4 s, ease-in-out, alternate |
| Forge fire | ellipse 50 × 44 at (393, 444) | radial `#FFC85A → #FF781E → transparent`; opacity jumps 0.55 / 1 / 0.45 / 0.95 / 0.6 / 0.85 (steps, no easing) | 1.3 s loop |
| Sparks | 4 dots 3 px from (404 + 5·i, 455) | move up 60 px and fade in then out | 1.6 s, ease-out, delays 0 / 0.4 / 0.8 / 1.2 s |
| Forge smoke | 9 soft puffs from the chimney top, centre (406, 414) | see 5.1 | 6.0 s and 6.8 s |
| Water sparkle | 7 px dots at (612,668) (640,702) (690,676) (668,652) (600,700) | opacity 0 → 0.95 → 0 and scale 0.6 → 1 | 2.4 s, delays 0.5 s apart |
| Cloud shadows | 3 soft dark ellipses 460 × 220 at y 260 / 520 / 120 | travel from x −520 to +1600 and up 120 px, clipped to the map tile | 46 / 58 / 52 s, linear |
| Birds | 3 small "m" shaped strokes | fly from (−120, 150) to (1420, 10); wings flap by scaleY 1 → −0.5 → 1 | flight 28 s linear, flap 0.55 s |
| Pin bob | every pin | translateY 0 → −4 px → 0 | 2.6 s, ease-in-out, delay based on x |
| War ring | pin of a building at war (Colosseum) | red 2 px ring, scale 0.8 → 2.3, opacity 0.8 → 0 | 1.8 s, ease-out |
| Progress shimmer | filled part of progress bars (war score, forging, building) | a 120 px white gradient band slides across | 1.8 s, linear |
| River waves (expanded city) | short light lines on the water | slide 28 px sideways while fading in and out | 3.2 s, delays spread |
| Ship bob | each moored ship | translateY 0 → 2.5 px and rotate 0 → 0.6° | 3.6 s, ease-in-out |
| Lighthouse | lantern at the top | fire flicker as forge; light cone rotates −28° → 20° → −28° with opacity 0.15 → 0.85 | 7 s, ease-in-out |
| Fountain | jets from the statue | arcs drawn with a dashed stroke whose dash offset runs 28 → 0, plus sparkles on the basin | 0.9 s, linear |
| Flags | tower flags | skewY 0 → 8° and scaleX 1 → 0.86 | 1.4 s, ease-in-out |
| Chariot | Circus track | moves along the track centre line (closed path) | 9 s per lap, linear |

### 5.1 Smoke, exactly

The user asked specifically for this one, so match it closely.

- 9 puffs, all starting at the chimney top (406, 414). Sizes cycle 22 / 28 / 34 px.
- Each puff is a soft circle: radial gradient from grey `rgb(150–178, …)` at 75 % opacity to transparent, plus a 3–5 px blur on web.
- Even puffs use path A, odd puffs path B, so the column is not perfectly regular:
  - A (6.0 s): 0 % at (0, 0) scale 0.4 opacity 0 → 8 % opacity 0.8 → 40 % (18, −66) scale 1.4 opacity 0.6 → 70 % (44, −118) scale 2.3 opacity 0.35 → 100 % (72, −170) scale 3.3 opacity 0.
  - B (6.8 s): 0 % scale 0.35 opacity 0 → 10 % opacity 0.7 → 35 % (4, −58) scale 1.2 → 65 % (30, −112) scale 2.1 opacity 0.35 → 100 % (58, −176) scale 3.1 opacity 0.
- Easing `cubic-bezier(0.3, 0.1, 0.6, 1)`. Delay of puff i is −0.72 · i s.
- The drift goes up and to the right, the same direction as the painted smoke.

## 6. How to build it in React Native

- Use `react-native-reanimated` (ships with Expo) for all loops: `withRepeat(withTiming(...))` with `withSequence` for multi-step keyframes. Drive `transform` and `opacity` only; they run on the UI thread.
- Soft shapes (glow, smoke puffs, cloud shadows, fire): native has no CSS blur or `mix-blend-mode`. Use small pre-rendered PNGs (white or warm radial gradients with alpha, 64–256 px) and animate their opacity and scale. They look the same on web and native and are cheap.
- Lines (fountain jets, birds, light cone, chariot path): `react-native-svg` with Reanimated animated props (`strokeDashoffset`, `transform`).
- Moving along a path (chariot): precompute about 60 points of the path and interpolate x and y from one progress value.
- Map pan on the phone: one shared value for translateX; also allow the user to drag it with a pan gesture (`react-native-gesture-handler`), and stop the auto-pan for 10 s after any touch.
- Keep one `Stage` component that takes `{ source, width, height, scale, offset, effects[] }` and renders the image plus effect children. Pins are a sibling layer that receives the same scale and offset.

## 7. Screens and behaviour

| Screen (canvas file) | What it does |
| --- | --- |
| `Main` | Large city with labels for every building, all effects running. Presentation and tablet layout. |
| `Mesto` | Phone map. Header chips: tribe name and level, denarii. Painting fills the top 580 px and auto-pans. Tapping a pin selects it: the pin turns red, scales to 1.18 and shows a dark name label; the bottom sheet shows a thumbnail crop, name, level, one-line description, live status in red and an "Vstoupit" button linking to the building screen. Default selection: Colosseum. |
| `Colosseum` | Header = arena crop with glow and birds, red "VÁLKA BĚŽÍ" chip, war score card with shimmer, buttons Check-in and Přehled. |
| `Kovarna` | Header = forge crop with smoke, fire and sparks. Item being forged with a shimmering progress bar and time left; list of items to buy with denarii or locked behind trained sessions. |
| `Domus` | Header = house crop with birds. Rooms (baths, trophy hall, treasury) and the villa upgrade progress. |
| `Mesto-rozsirene` | Layout proposal for the expanded city with new buildings and their effects (fountain, river, ships, lighthouse, circus, flags). The new buildings are code-drawn placeholders until the painted `city-full.png` exists. |

Building data for the current `city.jpg` (pin = anchor for the pin, crop = box for the header and thumbnail):

```json
[
  {"id": "colosseum", "name": "Colosseum", "function": "Války, liga a Bellum", "pin": [645, 226], "crop": [500, 200, 790, 500], "screen": "Colosseum"},
  {"id": "kovarna", "name": "Kovárna", "function": "Výzbroj a zbraně", "pin": [330, 425], "crop": [255, 310, 480, 560], "screen": "Kovarna"},
  {"id": "chram", "name": "Chrám", "function": "Rekordy a trofeje kmene", "pin": [615, 52], "crop": [520, 30, 720, 215], "screen": null},
  {"id": "cviciste", "name": "Cvičiště", "function": "Denní úkoly", "pin": [455, 168], "crop": [350, 160, 560, 315], "screen": null},
  {"id": "duely", "name": "Aréna duelů", "function": "Výzvy 1 na 1", "pin": [825, 190], "crop": [735, 180, 915, 320], "screen": null},
  {"id": "ludus", "name": "Ludus Ferrum", "function": "Kasárna tvého ludu", "pin": [265, 245], "crop": [125, 235, 405, 450], "screen": null},
  {"id": "trziste", "name": "Tržiště", "function": "Obchod za denáry", "pin": [500, 486], "crop": [360, 470, 620, 650], "screen": null},
  {"id": "domus", "name": "Tvůj domus", "function": "Příbytek gladiátora", "pin": [880, 420], "crop": [700, 400, 1015, 640], "screen": "Domus"},
  {"id": "oblouk", "name": "Vítězný oblouk", "function": "Vyhrané války", "pin": [756, 500], "crop": [700, 490, 815, 630], "screen": null},
  {"id": "lazne", "name": "Lázně", "function": "Regenerace mezi tréninky", "pin": [650, 596], "crop": [505, 585, 790, 775], "screen": null},
  {"id": "campus", "name": "Campus Martius", "function": "Kardio a výdrž", "pin": [1020, 338], "crop": [920, 330, 1120, 470], "screen": null},
  {"id": "akvadukt", "name": "Akvadukt", "function": "Bonus celého kmene", "pin": [1000, 168], "crop": [820, 60, 1250, 420], "screen": null}
]
```

Map tile outline in `city.jpg` (for clipping cloud shadows): (22, 408), (640, 10), (1276, 410), (650, 795).

New buildings planned for the expanded city and their game role: fountain (daily check-in reward, water rises with the streak), river port and docks (expeditions: verified workout in another gym or city), lighthouse (lit when the tribe leads or is under attack), granary (tribe treasury limit), valetudinarium (injury or deload pause without losing the streak), forum (tribe news and duel challenges), palaestra (programs and exercise technique), circus (cardio and weekly races), honour columns (tribe records), watchtowers (wall level for war defence), vineyard (bonus for training together).

## 8. Game state shown by animation

Animations are not decoration only; they show state. Drive them from data:

- War running: red ring on the Colosseum pin, red chip, shimmer on the score bar. No war: no ring.
- Forge working: smoke and fire on. Forge idle: smoke thinner (3 puffs), no sparks.
- Building under construction: swap the building image for its `-stavba` variant and show a shimmer progress bar.
- Streak: fountain jets get taller with the streak length; a broken streak turns the jets off.
- Tribe under attack: lighthouse beam on, later the `city-war` painting.

## 9. Performance and accessibility

- Respect reduced motion: `AccessibilityInfo.isReduceMotionEnabled()` on native, `prefers-reduced-motion` on web. With it on, show the still painting, keep the pins static and keep only the progress values.
- Pause every loop when the screen is not focused (`useIsFocused`) and when the app goes to the background.
- At most about 30 animated layers on one screen. The phone map currently uses about 25.
- Pins are real buttons with an accessible name (the building name), 44 × 44 px hit area.
- Every painting has an alt text: city "Malovaná izometrická mapa města kolem Colossea", headers use the building name.

## 10. Open questions for Matyáš

- Which painting set comes first (phase 1 of the prompt document) and when the new `city-full.png` replaces `city.jpg`.
- Whether the map should also be draggable by hand, or auto-pan only.
- Whether forge smoke and other effects should run all the time or only when the building is active.
