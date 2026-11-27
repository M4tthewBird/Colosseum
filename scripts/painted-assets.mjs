/**
 * Every painted game picture to make in Gemini (docs/PAINTED-UI.md), with its prompt.
 * scripts/painted-art.mjs turns this list into the gemini-obrazky/hra/ kit and imports the results.
 *
 * Kinds:
 * - piece:   a piece of the modular city. It stands on its own flat diamond base of 1×1, 2×2 or
 *            3×3 tiles, so the app can place it on the city grid (anchor = front corner of the base).
 * - ground:  a seamless top-down ground texture for the grid.
 * - figure:  the gladiator, full body (ranks and fighting styles).
 * - item:    one object on its own (gear, small icons).
 * - emblem:  a round league emblem.
 * - map:     a painted map (Czechia, Brno) over an outline template (scripts/geo/maps.mjs), so
 *            gyms can be put on it by their coordinates.
 *
 * `batch` groups pictures that are made in one Gemini chat (same kind and attachments); `test`
 * pictures come first, to check that the pieces fit together before making the rest.
 * Ids match the game code where there is one (rank, style and gear ids, league ids).
 */

/** Width : height of a tile's diamond, measured on the reference city (gemini-obrazky/Assets). */
export const RATIO = 1.67;

export const STYLE =
  'Hand-painted isometric game art in the exact style of the attached city painting: a soft ' +
  'painterly digital illustration with fine dark-brown ink outlines and light cross-hatching, a ' +
  'warm muted palette (terracotta roof tiles, cream and beige limestone, warm brown timber, ' +
  'olive-green grass, dark green cypresses and pines, grey-beige cobblestones), soft daylight from ' +
  'the upper left and gentle shading. Ancient Rome. No text, no letters, no numbers, no logos, ' +
  'no watermark, no frame, no border.';

export const FORMAT = {
  piece: `FORMAT (a piece of a modular city: the app places it on a grid, so it must fit exactly):
- One single piece standing alone on its own flat diamond-shaped base, seen from the same isometric angle as the attached city: the base edges run at about 31 degrees from horizontal, so the base is 5 wide to 3 high, exactly like the attached base template.
- The base size is given per image: 1x1, 2x2 or 3x3 tiles. The attached base template shows each shape. Use the template only for the shape and the angle: do not copy its outline or labels.
- The base is flat with NO thickness: no soil or earth sides, no slab edge, no plinth under it. Its surface is given per image (paving, sand, grass or bare earth) and is plain and even: no lines, no grid, no tile marks, no crosses, no border line around it.
- The base is the widest part of the picture: nothing (roof, tree, flag, smoke) sticks out past its left or right corner or below its front corner. Tall parts may rise above it.
- The piece fills its base, leaving only a narrow margin of the base surface around it, with the same proportions as the buildings in the attached city.
- Shadows fall only onto the base, never onto the background.
- Background: perfectly flat plain cream #F2EBDB, the same colour everywhere: no gradient, no texture, no vignette, no shadow. At least 10 % empty background on every side.
- Square image. No people, no animals.`,
  ground: `FORMAT: a seamless, tileable square texture of ground seen straight from above (top-down, NOT isometric), painted in the same style and colours as the ground in the attached city. Even, flat light, no shadows, no objects, no paths, no border: the left edge continues into the right edge and the top edge into the bottom edge. Square image.`,
  figure: `FORMAT: one gladiator, full body from head to feet, seen straight from the front at eye level: he faces the viewer, not turned to either side, standing upright and symmetrical with his feet a little apart and his arms hanging slightly away from his body. If he carries a weapon, it is held down at his side in his right hand; if he has a shield, it is on his left forearm, its front facing the viewer. Painted in the style of the attached city (the same ink outlines, hatching and palette). The same man in every image: muscular, tanned, short dark curly hair, a short dark beard, a calm determined face; only his gear changes. A small soft shadow directly under his feet only. Background: perfectly flat plain cream #F2EBDB, no gradient, no ground, no scenery. The whole figure in frame with empty background around it: feet, crest and weapons not cut off. Portrait image, 3:4.`,
  item: `FORMAT: one object alone, seen straight from the front, flat-on, the way it faces you when worn (no tilt, no three-quarter view), centred, filling about 70 % of the image, painted in the style of the attached city (the same ink outlines, hatching, palette and light from the upper left). A helmet faces the viewer; a shield shows its front; a weapon stands upright, blade or point up; armour and clothes are shown from the front as if worn by an invisible body. Nobody wears or holds it. A small soft shadow under it only. Background: perfectly flat plain cream #F2EBDB, no gradient, no texture, no table, no scenery. Square image.`,
  layer: `FORMAT: EDIT THE BASE IMAGE. Always start from the base gladiator (the attached base image, or image 1 of this chat): he wears only a white loincloth and sandals. Never build on an image made earlier in this chat: the gear from the previous image must not be there. Add only the piece of gear named. Keep everything else exactly as it is: the same man, the same pose, the same position and size in the frame, the same framing, the same light and the same cream background #F2EBDB. Do not move, redraw or restyle anything else, and do not add any other gear. Portrait image, 3:4, the same size as the base.`,
  map: `FORMAT: a painted map seen from directly above (top-down: not isometric, no perspective, no tilt), in the style of the attached city painting. The second attached image is the template: keep everything in it exactly where it is, with the same shape, position and size in the frame (do not move, rotate, scale or simplify anything), because the app puts real places on the map by their coordinates. Blue lines are rivers: paint them exactly there. A small dark dot is a town or a square: paint it exactly on the dot. No text, no labels, no names, no numbers, no markers, no pins, no compass rose, no legend, no frame. Give the image the same proportions as the template.`,
  emblem: `FORMAT: a round emblem (a medallion) seen straight from the front, centred, filling about 80 % of the image, painted in the style of the attached city (ink outlines, hatching, warm palette). All league emblems share one design and differ only in metal and ornament. Background: perfectly flat plain cream #F2EBDB, no gradient. Square image.`,
};

/** Extra attachment per kind (besides the style reference), shown in the kit's steps; a map
 * brings its own outline template (`attach`). */
export const ATTACH = { piece: 'sablona-parcely.png', layer: 'zaklad-gladiator.jpg' };

/** The Czech titles of the batches, in the order they are made. */
export const BATCHES = {
  test: 'Zkouška: jedna stavba od každé velikosti',
  L: 'Velké stavby 3×3',
  M1: 'Střední stavby 2×2: chrám, brána, kasárna',
  M2: 'Střední stavby 2×2: domus, tržiště, lázně, oblouk',
  S1: 'Malé kousky 1×1: posilovací stroje',
  S2: 'Malé kousky 1×1: doplňky, parcela, lešení',
  ground: 'Terén (textury)',
  // 2026-11-27: the gladiator first, then the training grounds, the house, the aqueduct, the maps
  dressup: 'Zkouška oblékání: gladiátor zepředu a 4 kusy výzbroje na něm',
  figures: 'Gladiátor: hodnosti a styly boje',
  items1: 'Výzbroj: přilby a štíty',
  items2: 'Výzbroj: zbraně a chrániče',
  items3: 'Výzbroj: zbroj a oděv, ikony',
  T1: 'Cvičiště ludusu: střed 3×3 a vybavení',
  T2: 'Cvičiště: činky a hrazda (3 úrovně)',
  test2: 'Zkouška: úseky hradeb a akvaduktu (navazují na sebe?)',
  W: 'Hradby: kamenná a opevněná',
  D: 'Tvůj dům: nový domus 2, palác a vylepšení',
  A: 'Akvadukt: nároží a vodojem',
  mapCZ: 'Mapa Česka',
  mapBrno: 'Mapa Brna',
  emblems: 'Ligové znaky',
  // 2026-11-27: every piece of gear on the base gladiator, so he can wear what the player owns
  layers1: 'Oblékání: přilby a štíty na gladiátorovi',
  layers2: 'Oblékání: zbraně a chrániče na gladiátorovi',
  layers3: 'Oblékání: zbroj a oděv na gladiátorovi',
};

const piece = (batch, id, size, base, cs, prompt) => ({
  kind: 'piece',
  batch,
  id,
  size,
  base,
  cs,
  prompt,
});
const plot = (size, batch) =>
  piece(
    batch,
    `plot-${size}`,
    size,
    'bare earth',
    `Prázdná parcela ${size}×${size}`,
    'An empty building plot: bare packed earth marked out with short wooden stakes and a rope along its edges, a small blank wooden sign on a post (no writing on it).',
  );
const scaffold = (size, batch, extra = '') =>
  piece(
    batch,
    `scaffold-${size}`,
    size,
    'bare earth',
    `Lešení ${size}×${size} (ve stavbě)`,
    `A construction site: wooden scaffolding around a half-built limestone structure, stacked cut stone blocks, timber beams and coiled ropes${extra}.`,
  );

export const ASSETS = [
  // ── Test: one of each size, so the pieces can be checked against each other first ──
  piece(
    'test',
    'arena-4',
    3,
    'grass',
    'Aréna kmene 4: Colosseum',
    'The Colosseum: a round amphitheatre with three tiers of arcades in cream limestone, the arena floor and seating inside glowing with warm golden light, red pennants on the top rim, a marble statue on a pedestal in front. Exactly like the Colosseum in the attached city.',
  ),
  piece(
    'test',
    'temple-3',
    2,
    'paving',
    'Chrám 3: velký chrám',
    'A large Roman temple: six front columns, a pediment, a terracotta tiled roof, wide stone stairs, a marble statue on a pedestal at the foot of the stairs, two cypresses. Like the temple in the attached city.',
  ),
  piece(
    'test',
    'forge',
    2,
    'bare earth',
    'Kovárna',
    'A forge: a dark stone furnace with a tall chimney and grey smoke rising, an orange fire glowing in its mouth, an open timber workshop shed with an anvil, hammers and tongs, barrels and a water trough. Like the forge in the attached city.',
  ),
  piece(
    'test',
    'rack-1',
    1,
    'sand',
    'Squat rack úroveň 1',
    'A simple wooden squat rack: two timber posts with wooden pegs holding a wooden bar loaded with round stone weights.',
  ),

  // ── 3×3 ──
  piece(
    'L',
    'arena-1',
    3,
    'sand',
    'Aréna kmene 1: cvičiště',
    'An open training ground: packed sand, a single thick wooden palus post for sword practice, a few tree stumps as seats, a log, a small rack of wooden practice swords, a low rope fence on short posts.',
  ),
  piece(
    'L',
    'arena-2',
    3,
    'grass',
    'Aréna kmene 2: dřevěný ludus',
    'A ring of sharpened wooden palisade stakes around a sand training yard, a simple wooden gate in the ring; inside a wooden squat rack, a log bench and a palus post. Like the wooden ring in the attached city.',
  ),
  piece(
    'L',
    'arena-3',
    3,
    'grass',
    'Aréna kmene 3: kamenná aréna',
    'A round stone arena: a low limestone wall with small arched openings, a few stone seating tiers inside, a sand floor with a wooden rack and a bench, red pennants on poles. Like the stone ring in the attached city.',
  ),
  plot(3, 'L'),
  scaffold(3, 'L', ', and a wooden treadwheel crane lifting a stone block'),

  // ── 2×2 ──
  piece(
    'M1',
    'temple-1',
    2,
    'paving',
    'Chrám 1: oltář',
    'A small open-air shrine: a stone altar with a burning fire bowl, two standing columns, a small statue on a pedestal and one cypress.',
  ),
  piece(
    'M1',
    'temple-2',
    2,
    'paving',
    'Chrám 2: malý chrám',
    'A small temple: four front columns, a pediment, a terracotta tiled roof and a short flight of stone steps.',
  ),
  piece(
    'M1',
    'gate-1',
    2,
    'grass',
    'Hradby 1: dřevěná brána',
    'A wooden gate of sharpened stakes with two short palisade wings and a small wooden watch platform above the gate.',
  ),
  piece(
    'M1',
    'gate-2',
    2,
    'grass',
    'Hradby 2: kamenná brána',
    'A stone gate: a limestone arch with heavy wooden doors and two short stone wall wings.',
  ),
  piece(
    'M1',
    'gate-3',
    2,
    'grass',
    'Hradby 3: brána s věžemi',
    'A fortified gate: a limestone arch with heavy wooden doors flanked by two square stone towers with battlements and red pennants, short walls on both sides.',
  ),
  piece(
    'M1',
    'barracks-1',
    2,
    'grass',
    'Kasárna 1: dřevěná',
    'Gladiator barracks: a long low wooden building with a thatched roof, a weapon rack and a water barrel outside.',
  ),
  piece(
    'M1',
    'barracks-2',
    2,
    'grass',
    'Kasárna 2: kamenná',
    'Gladiator barracks: an L-shaped stone building with a terracotta tiled roof around a small sand yard with a palus post.',
  ),
  piece(
    'M1',
    'barracks-3',
    2,
    'grass',
    'Kasárna 3: ludus',
    'A gladiator school (ludus): a two-storey building with terracotta roofs and a colonnade around a sand training courtyard. Like the courtyard building on the left of the attached city.',
  ),

  piece(
    'M2',
    'home-1',
    2,
    'grass',
    'Domus 1: chýše',
    'A small poor hut: wattle walls, a straw roof, a woodpile, a small vegetable patch and a low wicker fence.',
  ),
  piece(
    'M2',
    'home-3',
    2,
    'grass',
    'Domus 3: domus',
    'A Roman town house (domus): limestone walls, a terracotta tiled roof with a square atrium opening, two small columns at the entrance.',
  ),
  piece(
    'M2',
    'home-4',
    2,
    'grass',
    'Domus 4: villa',
    'A Roman villa: two wings with terracotta roofs joined by a columned portico, a small courtyard pond, two cypresses. Like the house with the courtyard at the bottom right of the attached city.',
  ),
  piece(
    'M2',
    'market',
    2,
    'sand',
    'Tržiště',
    'A market: several wooden stalls with red and brown cloth awnings, crates, sacks, amphorae and a low stone wall. Like the market in the attached city.',
  ),
  piece(
    'M2',
    'baths',
    2,
    'paving',
    'Lázně',
    'Roman baths: a limestone bath house with a small dome and a terracotta roof, a courtyard pool of clear blue water edged with columns, soft wisps of steam.',
  ),
  piece(
    'M2',
    'arch',
    2,
    'paving',
    'Vítězný oblouk',
    'A triumphal arch of cream limestone with carved reliefs and columns, standing on a paved square. Like the arch in the attached city.',
  ),
  plot(2, 'M2'),
  scaffold(2, 'M2'),

  // ── 1×1 ──
  piece(
    'S1',
    'rack-2',
    1,
    'sand',
    'Squat rack úroveň 2',
    'A sturdy squat rack: a timber frame reinforced with iron bands, an iron bar loaded with round stone plates.',
  ),
  piece(
    'S1',
    'rack-3',
    1,
    'sand',
    'Squat rack úroveň 3',
    'A grand squat rack of marble and bronze, a bronze bar with bronze plates, a small red pennant on top.',
  ),
  piece(
    'S1',
    'bench-1',
    1,
    'sand',
    'Lavice úroveň 1',
    'A simple wooden weight bench with a wooden bar resting on two forked posts, round stone weights on the bar.',
  ),
  piece(
    'S1',
    'bench-2',
    1,
    'sand',
    'Lavice úroveň 2',
    'A sturdier weight bench with iron fittings and a padded leather top, an iron barbell with round stone plates on a rack.',
  ),
  piece(
    'S1',
    'bench-3',
    1,
    'sand',
    'Lavice úroveň 3',
    'An ornate weight bench of marble and bronze with a red leather top, a bronze barbell with bronze plates.',
  ),
  piece(
    'S1',
    'cable-1',
    1,
    'sand',
    'Kladka úroveň 1',
    'A timber frame with a rope running over a wooden pulley to a handle, a basket of stones as the weight.',
  ),
  piece(
    'S1',
    'cable-2',
    1,
    'sand',
    'Kladka úroveň 2',
    'A taller timber frame with iron pulley wheels, a rope to a handle and a stack of cut stone blocks as the weight.',
  ),
  piece(
    'S1',
    'cable-3',
    1,
    'sand',
    'Kladka úroveň 3',
    'A marble frame with bronze fittings, double bronze pulleys, ropes to two handles and a stack of bronze weights.',
  ),
  piece(
    'S1',
    'platform-1',
    1,
    'sand',
    'Deadlift platforma úroveň 1',
    'A square platform of wooden planks with a wooden bar and round stone weights lying on it.',
  ),
  piece(
    'S1',
    'platform-2',
    1,
    'sand',
    'Deadlift platforma úroveň 2',
    'A platform of flat stone slabs with an iron barbell and round stone plates lying on it.',
  ),
  piece(
    'S1',
    'platform-3',
    1,
    'sand',
    'Deadlift platforma úroveň 3',
    'A marble platform with bronze inlay, a bronze barbell with bronze plates, two small bronze braziers with flames at its back corners.',
  ),

  piece(
    'S2',
    'tree-cypress',
    1,
    'grass',
    'Strom: cypřiše',
    'Two tall slim dark green cypress trees.',
  ),
  piece(
    'S2',
    'tree-pine',
    1,
    'grass',
    'Strom: borovice',
    'One umbrella pine tree (stone pine) with a wide flat crown.',
  ),
  piece(
    'S2',
    'statue',
    1,
    'paving',
    'Socha',
    'A white marble statue of a gladiator with a sword and shield on a tall stone pedestal.',
  ),
  piece(
    'S2',
    'cart',
    1,
    'bare earth',
    'Vozík',
    'A wooden hand cart loaded with cut stone blocks and a few timber beams.',
  ),
  piece(
    'S2',
    'banner',
    1,
    'grass',
    'Prapor',
    'A tall wooden pole with a long red banner with a golden laurel border, and a small stone at its foot.',
  ),
  piece(
    'S2',
    'amphorae',
    1,
    'paving',
    'Amfory a bedny',
    'A group of clay amphorae, wooden crates and a sack.',
  ),
  plot(1, 'S2'),
  scaffold(1, 'S2'),

  // ── Training grounds (Matyáš, 2026-11-27): the ludus and the tribe build their fortress as a
  // grid like the city: the machines, walls and drill props stand there, not in the city ──
  piece(
    'T1',
    'ludus-1',
    3,
    'sand',
    'Ludus 1: malá škola gladiátorů',
    'A small gladiator school: a long low timber barracks hut with a thatched roof along the back of a square sand training yard, a palus post and a straw practice dummy in the yard, a low wooden fence around it.',
  ),
  piece(
    'T1',
    'ludus-2',
    3,
    'sand',
    'Ludus 2: kamenný ludus',
    'A stone gladiator school: an L-shaped two-storey limestone building with a terracotta tiled roof and a wooden balcony along the back and one side of a sand training yard, two palus posts and a rack of wooden swords in the yard.',
  ),
  piece(
    'T1',
    'ludus-3',
    3,
    'sand',
    'Ludus 3: Ludus Magnus',
    'A grand gladiator school (Ludus Magnus): two-storey colonnaded limestone buildings with terracotta roofs on three sides of an oval sand practice arena with a few low tiers of stone seats, red pennants on the roofs.',
  ),
  piece(
    'T1',
    'palus',
    1,
    'sand',
    'Palus: kůl na nácvik',
    'A palus: a thick wooden post as tall as a man, scarred by sword cuts, with a straw practice dummy tied to a second post beside it.',
  ),
  piece(
    'T1',
    'weapon-rack',
    1,
    'sand',
    'Stojan se zbraněmi',
    'A wooden rack with wooden practice swords, two spears and a round wooden shield leaning against it.',
  ),
  piece(
    'T1',
    'brazier',
    1,
    'paving',
    'Žárová mísa',
    'A bronze brazier on three legs with a bright orange fire burning in it, and a small stack of firewood beside it.',
  ),
  piece(
    'T1',
    'water-trough',
    1,
    'sand',
    'Koryto s vodou',
    'A long stone water trough full of clear water with a wooden ladle, and a clay jug beside it.',
  ),

  // more gym equipment for the training grounds, three levels like the other machines
  ...[
    [
      'halteres',
      'Činky (halteres)',
      [
        'A low wooden rack holding pairs of stone dumbbells (halteres) of three sizes.',
        'A sturdy wooden rack reinforced with iron holding pairs of iron dumbbells of four sizes.',
        'A marble rack with bronze fittings holding pairs of bronze dumbbells of five sizes.',
      ],
    ],
    [
      'pullup',
      'Hrazda',
      [
        'A pull-up frame: two rough timber posts with a round wooden bar across the top.',
        'A pull-up frame: two squared timber posts joined by an iron bar, with a climbing rope hanging beside it.',
        'A pull-up frame: two marble columns joined by a bronze bar, with a climbing rope and bronze rings hanging from a beam.',
      ],
    ],
  ].flatMap(([id, cs, prompts]) =>
    prompts.map((prompt, n) =>
      piece('T2', `${id}-${n + 1}`, 1, 'sand', `${cs} úroveň ${n + 1}`, prompt),
    ),
  ),

  // ── Walls of the training grounds and the aqueduct: sections that join up across tiles.
  // The test pair first: do two sections side by side meet without a gap? ──
  ...[
    [
      '1',
      'Hradby 1: palisáda',
      'a palisade of sharpened timber stakes about as tall as a man, bound with rope',
    ],
    [
      '2',
      'Hradby 2: kamenná zeď',
      'a limestone wall about twice as tall as a man, with a walkway on top',
    ],
    [
      '3',
      'Hradby 3: opevněná zeď',
      'a tall fortified limestone wall with battlements on top and narrow arrow slits',
    ],
  ].flatMap(([n, cs, wall]) => [
    piece(
      n === '1' ? 'test2' : 'W',
      `wall-${n}-a`,
      1,
      'grass',
      `${cs}, úsek /`,
      `A straight section of ${wall}. It crosses the base along its middle, rising to the right: it runs from the middle of the base's front-left edge to the middle of its back-right edge, parallel to the base's back-left edge. Both ends are cut off flat exactly at the base's edges, so the next section continues it seamlessly. Nothing else on the base.`,
    ),
    piece(
      n === '1' ? 'test2' : 'W',
      `wall-${n}-b`,
      1,
      'grass',
      `${cs}, úsek \\`,
      `A straight section of ${wall}. It crosses the base along its middle, rising to the left: it runs from the middle of the base's front-right edge to the middle of its back-left edge, parallel to the base's back-right edge. Both ends are cut off flat exactly at the base's edges, so the next section continues it seamlessly. Nothing else on the base.`,
    ),
    piece(
      n === '1' ? 'test2' : 'W',
      `wall-${n}-tower`,
      1,
      'grass',
      `${cs}, věž`,
      `A ${n === '1' ? 'square wooden watchtower on four posts with a small roofed platform' : 'square limestone tower with battlements'} standing in the middle of the base, a little taller than ${wall}. No wall sections attached to it: walls will join it from the sides.`,
    ),
  ]),
  piece(
    'test2',
    'aqueduct-a',
    1,
    'grass',
    'Akvadukt, úsek /',
    "A straight section of a Roman aqueduct: two tiers of round limestone arches carrying a covered water channel on top. It crosses the base along its middle, rising to the right: from the middle of the base's front-left edge to the middle of its back-right edge, parallel to the base's back-left edge. One full arch on each tier. Both ends are cut off flat exactly at the base's edges, so the next section continues it seamlessly.",
  ),
  piece(
    'test2',
    'aqueduct-b',
    1,
    'grass',
    'Akvadukt, úsek \\',
    "A straight section of a Roman aqueduct: two tiers of round limestone arches carrying a covered water channel on top. It crosses the base along its middle, rising to the left: from the middle of the base's front-right edge to the middle of its back-left edge, parallel to the base's back-right edge. One full arch on each tier. Both ends are cut off flat exactly at the base's edges, so the next section continues it seamlessly.",
  ),
  piece(
    'A',
    'aqueduct-pier',
    1,
    'grass',
    'Akvadukt, nároží',
    'A square limestone pier of a Roman aqueduct, as tall as two tiers of arches, with the covered water channel on top turning the corner. It stands in the middle of the base; aqueduct sections will join it from the sides.',
  ),
  piece(
    'A',
    'castellum',
    1,
    'paving',
    'Akvadukt: vodojem',
    'A castellum aquae: a small round limestone water tower with a domed roof where the aqueduct brings water into the city, a stone basin of clear water at its foot with water pouring into it from a bronze spout.',
  ),

  // ── Your own house (Matyáš, 2026-11-27): upgraded with your own hours in the gym, and a few
  // things to build around it. rev 2 of home-2: the timber house did not fit ──
  {
    ...piece(
      'D',
      'home-2',
      2,
      'grass',
      'Domus 2: malý kamenný dům',
      'A small Roman house: whitewashed limestone walls, a low terracotta tiled roof, a wooden door under a small porch, a vine on a wooden pergola beside it, a bench and a few clay pots.',
    ),
    rev: 2,
  },
  piece(
    'D',
    'home-5',
    2,
    'grass',
    'Domus 5: palác',
    'A grand palatial villa: a two-storey limestone house with terracotta roofs around a colonnaded garden courtyard (peristyle) with a fountain, a small private bath house with a dome at one side, statues and cypresses. The grandest house of the city.',
  ),
  piece(
    'D',
    'hortus',
    1,
    'grass',
    'Zahrada (hortus)',
    'A small Roman kitchen garden: neat beds of herbs and vegetables edged with stones, a little olive tree and a clay water jar.',
  ),
  piece(
    'D',
    'fountain',
    1,
    'paving',
    'Fontána',
    'A round marble fountain with a small bronze statue in the middle, clear water splashing into the basin.',
  ),
  piece(
    'D',
    'pergola',
    1,
    'paving',
    'Pergola s vínem',
    'A wooden pergola overgrown with a grape vine with green leaves and dark grapes, a stone bench under it.',
  ),
  piece(
    'D',
    'lararium',
    1,
    'paving',
    'Domácí oltář (lararium)',
    'A lararium: a small household shrine like a tiny temple front on a pedestal, with two small bronze figures inside, an oil lamp and offerings of fruit.',
  ),
  piece(
    'D',
    'palaestra',
    1,
    'sand',
    'Domácí cvičiště',
    'A private training corner: a small sand square with a stone bench, a pair of stone dumbbells and a wooden practice sword leaning on the bench.',
  ),

  // ── Ground ──
  {
    kind: 'ground',
    batch: 'ground',
    id: 'ground-grass',
    cs: 'Tráva',
    prompt:
      'Grass: short olive-green grass with subtle lighter and darker patches, like the lawns in the attached city.',
  },
  {
    kind: 'ground',
    batch: 'ground',
    id: 'ground-paving',
    cs: 'Dlažba',
    prompt:
      'Paving: irregular grey-beige cobblestones with thin dark joints, like the paths in the attached city.',
  },
  {
    kind: 'ground',
    batch: 'ground',
    id: 'ground-sand',
    cs: 'Písek',
    prompt:
      'Sand: packed light-ochre sand of a training ground with faint footprints and small pebbles.',
  },

  // ── Dressing up: can gear be drawn as layers on one gladiator? A base and 4 edits of it ──
  {
    kind: 'figure',
    batch: 'dressup',
    id: 'dress-base',
    cs: 'Oblékání: základní gladiátor',
    prompt:
      'The base for dressing up: the gladiator wearing only a plain white loincloth and simple leather sandals. No helmet, no armour, no weapon, no shield; his hands open and relaxed.',
  },
  ...[
    [
      'dress-helmet',
      'přilba',
      'Put a galea on his head: a Roman helmet of bronze and iron with hinged cheek guards, a neck guard and a short red brush crest, his face still visible.',
    ],
    [
      'dress-shield',
      'štít',
      'Put a parma on his left forearm, its front facing the viewer: a round wooden shield painted dark red, with a bronze rim and a central bronze boss.',
    ],
    [
      'dress-weapon',
      'zbraň',
      'Put a gladius in his right hand, held down at his side: a Roman short sword with a straight double-edged blade.',
    ],
    [
      'dress-armour',
      'zbroj',
      'Dress him in a lorica: an ornate golden muscle cuirass with leather strips at the shoulders and the waist.',
    ],
  ].map(([id, cs, prompt]) => ({
    kind: 'layer',
    batch: 'dressup',
    id,
    cs: `Oblékání: ${cs}`,
    prompt,
  })),

  // ── The gladiator: ranks (lib/game/levels.ts) and fighting styles (lib/game/styles.ts) ──
  // rev 2 (2026-11-26): seen from the front (Matyáš), the three-quarter ones are made again
  ...[
    [
      'tiro',
      'Tiro',
      'A recruit: a plain undyed wool tunic with a rope belt, leather sandals, no helmet (face fully visible), a wooden practice sword (rudis) in his right hand, no shield, no armour.',
    ],
    [
      'gladiator',
      'Gladiator',
      'A bronze galea helmet with cheek guards and a short red crest (face visible), a small round wooden shield with a bronze rim on his left arm, a short gladius, a loincloth with a leather belt, padded leg wraps.',
    ],
    [
      'veteranus',
      'Veteranus',
      'A helmet with a tall red crest and a grille visor, a large curved red rectangular shield (scutum), a segmented arm guard (manica) on the sword arm, a gladius, a bronze greave on the left leg, a wide leather belt.',
    ],
    [
      'primus',
      'Primus Palus',
      'The champion of the ludus: an ornate golden muscle cuirass, a red cloak over the shoulders, a polished golden galea with a tall red crest (face visible), a gleaming gladius, a red scutum with gold ornament, bronze greaves.',
    ],
    [
      'rudiarius',
      'Rudiarius',
      'A freed legend: a golden laurel wreath on his bare head (no helmet, face visible), a white tunic with gold trim under a golden cuirass, a deep red cloak with a gold clasp, raising the honorary wooden sword of freedom (rudis) in his right hand, a calm proud stance.',
    ],
  ].map(([id, cs, prompt]) => ({
    kind: 'figure',
    batch: 'figures',
    rev: 2,
    id: `rank-${id}`,
    cs: `Hodnost: ${cs}`,
    prompt: `${cs}. ${prompt}`,
  })),
  ...[
    [
      'murmillo',
      'Murmillo',
      'The heavy fighter: a broad-brimmed helmet with a tall fin-shaped crest and a grille visor, a large curved rectangular scutum, a gladius, a segmented manica on the sword arm, a short greave on the left leg, a loincloth with a wide belt.',
    ],
    [
      'thraex',
      'Thraex',
      'A wide-brimmed helmet with a griffin-head crest and a grille visor, a short curved sword (sica), a small square shield (parmula), tall greaves on both legs over padded leg wraps, a manica on the sword arm, a loincloth with a belt.',
    ],
    [
      'retiarius',
      'Retiarius',
      'The net fighter: no helmet (face visible), a weighted net in one hand and a three-pronged trident in the other, a tall bronze shoulder guard (galerus) on the left shoulder, a manica on the left arm, a loincloth with a belt; light and agile.',
    ],
    [
      'secutor',
      'Secutor',
      'The chaser: a smooth rounded close-fitting helmet with a low fin crest and a visor grille (not a mask with two eye holes), a large curved rectangular scutum, a gladius, a manica on the sword arm, a greave on the left leg, a loincloth with a belt.',
    ],
    [
      'hoplomachus',
      'Hoplomachus',
      'A wide-brimmed helmet with a tall plume of feathers and a grille visor, a small round convex bronze shield, a spear, quilted leg wraps under tall bronze greaves, a manica on the right arm, a loincloth with a belt.',
    ],
    [
      'bestiarius',
      'Bestiarius',
      'The beast fighter: no helmet (face visible), a leopard skin over one shoulder, a long spear, crossed leather straps on his bare chest, leather wrist guards, a loincloth and simple sandals.',
    ],
  ].map(([id, cs, prompt]) => ({
    kind: 'figure',
    batch: 'figures',
    rev: 2,
    id: `style-${id}`,
    cs: `Styl: ${cs}`,
    prompt: `${cs}. ${prompt}`,
  })),

  // ── Gear (ids from lib/game/gear.ts) ──
  ...[
    [
      'items1',
      'helmet_galea',
      'Galea',
      'A Roman helmet of bronze and iron with hinged cheek guards, a neck guard and a short red brush crest.',
    ],
    [
      'items1',
      'helmet_murmillo',
      'Murmillo',
      'A bronze murmillo helmet: a broad brim, a tall fin-shaped crest and a visor with a grille of small round holes.',
    ],
    [
      'items1',
      'helmet_secutor',
      'Secutor',
      'A smooth, rounded, close-fitting bronze secutor helmet with a low fin crest and a visor grille (not a mask with two eye holes).',
    ],
    [
      'items1',
      'helmet_thraex',
      'Thraex',
      'A bronze thraex helmet: a wide brim, a crest topped with a griffin head, a grilled visor and a feather on each side.',
    ],
    [
      'items1',
      'helmet_hoplomachus',
      'Hoplomachus',
      'A bronze hoplomachus helmet: a wide brim, a tall plume of white and red feathers and a grilled visor.',
    ],
    [
      'items1',
      'helmet_provocator',
      'Provocator',
      'An iron provocator helmet: rounded, with a visor grille and a wide neck guard, no brim, a small feather at each side.',
    ],
    [
      'items1',
      'helmet_galea_gold',
      'Zlatá galea',
      'An ornate golden galea with engraved laurel decoration, hinged cheek guards and a tall red crest.',
    ],
    [
      'items1',
      'helmet_laurel',
      'Vavřínový věnec',
      'A crown of golden laurel leaves tied with a red ribbon.',
    ],
    [
      'items1',
      'shield_parmula',
      'Parmula',
      'A small, slightly curved square shield of wood and leather with a bronze boss and a bronze rim.',
    ],
    [
      'items1',
      'shield_parma',
      'Parma',
      'A round wooden shield painted dark red, with a bronze rim and a central bronze boss.',
    ],
    [
      'items1',
      'shield_bronze',
      'Bronzový štít',
      'A small round convex shield of polished bronze with engraved rings.',
    ],
    [
      'items1',
      'shield_scutum',
      'Scutum',
      'A large curved rectangular shield, red with golden wings and lightning bolts and a central bronze boss.',
    ],
    [
      'items2',
      'weapon_rudis',
      'Rudis',
      'A wooden practice sword of plain worn wood with a leather-wrapped grip.',
    ],
    [
      'items2',
      'weapon_pugio',
      'Pugio',
      'A Roman dagger with a leaf-shaped iron blade and a bronze-decorated hilt, its sheath beside it.',
    ],
    [
      'items2',
      'weapon_sica',
      'Sica',
      'A short curved Thracian sword: an iron blade bent at an angle and a wooden grip.',
    ],
    [
      'items2',
      'weapon_net',
      'Rete (síť)',
      'A gladiator net gathered in loose folds, with small lead weights along its edge.',
    ],
    [
      'items2',
      'weapon_trident',
      'Fuscina (trojzubec)',
      'A long three-pronged trident with an iron head on a wooden shaft, lying diagonally.',
    ],
    [
      'items2',
      'weapon_hasta',
      'Hasta (kopí)',
      'A spear with a leaf-shaped iron head on a long wooden shaft, lying diagonally.',
    ],
    [
      'items2',
      'weapon_gladius',
      'Gladius',
      'A Roman short sword: a straight double-edged blade, a ribbed wooden grip and a round pommel.',
    ],
    ['items2', 'weapon_two_gladii', 'Dva gladii', 'Two Roman short swords crossed.'],
    [
      'items2',
      'guard_fasciae',
      'Fasciae',
      'A pair of quilted padded linen leg wraps tied with leather cords.',
    ],
    [
      'items2',
      'guard_ocreae',
      'Ocreae',
      'A pair of bronze greaves (shin guards) with engraved decoration.',
    ],
    [
      'items2',
      'guard_galerus',
      'Galerus',
      'A tall curved bronze shoulder guard with leather straps.',
    ],
    [
      'items2',
      'guard_manica',
      'Manica',
      'A segmented arm guard of overlapping metal bands on leather.',
    ],
    ['items3', 'armour_tunic', 'Tunika', 'A simple off-white wool tunic with a rope belt.'],
    [
      'items3',
      'armour_exomis',
      'Exomis',
      'A one-shouldered tunic of natural linen with a leather belt.',
    ],
    [
      'items3',
      'armour_subligaculum',
      'Subligaculum',
      'A white loincloth with a wide leather belt (balteus) set with bronze plates.',
    ],
    [
      'items3',
      'armour_straps',
      'Kožené řemeny',
      'Crossed leather chest straps with bronze buckles and studs.',
    ],
    [
      'items3',
      'armour_leopard',
      'Leopardí kožešina',
      'A leopard pelt draped as if over a shoulder, with a bronze clasp.',
    ],
    [
      'items3',
      'armour_cardiophylax',
      'Cardiophylax',
      'A round bronze chest plate on leather straps.',
    ],
    [
      'items3',
      'armour_cloak',
      'Rudý plášť',
      'A deep red woollen cloak with a round bronze brooch.',
    ],
    [
      'items3',
      'armour_lorica',
      'Lorica',
      'An ornate golden muscle cuirass with leather strips at the shoulders and the waist.',
    ],
  ].map(([batch, id, cs, prompt]) => ({ kind: 'item', batch, id, cs: `Výzbroj: ${cs}`, prompt })),
  {
    kind: 'item',
    batch: 'items3',
    id: 'icon-denarius',
    cs: 'Ikona: denár',
    small: true,
    prompt:
      'An icon of a denarius: one silver Roman coin with an emperor profile, tilted slightly. A simple bold shape that still reads at 24 px.',
  },
  {
    kind: 'item',
    batch: 'items3',
    id: 'icon-laurels',
    cs: 'Ikona: vavříny',
    small: true,
    prompt:
      'An icon of laurels: a small green laurel branch bent into a half wreath, tied with a red ribbon. A simple bold shape that still reads at 24 px.',
  },

  // ── Leagues (ids from lib/game/levels.ts) ──
  ...[
    [
      'bronze',
      'Bronzová liga',
      'Bronze League: a bronze medallion with a laurel wreath around its edge and two crossed swords in the middle.',
    ],
    [
      'silver',
      'Stříbrná liga',
      'Silver League: the same medallion in silver, a fuller laurel wreath, two crossed swords and a small helmet above them.',
    ],
    [
      'gold',
      'Zlatá liga',
      'Gold League: the same medallion in gold, a rich laurel wreath, crossed swords, a crested helmet above them and small red ribbons.',
    ],
    [
      'imperator',
      'Imperátorova aréna',
      "Imperator's Arena: the same medallion in gold with deep red enamel, a golden eagle with spread wings above crossed swords and a laurel wreath; the grandest of the four.",
    ],
  ].map(([id, cs, prompt]) => ({
    kind: 'emblem',
    batch: 'emblems',
    id: `league-${id}`,
    cs,
    prompt,
  })),

  // ── Maps (Matyáš, 2026-11-27): gyms go on them by their coordinates (scripts/geo/maps.mjs) ──
  {
    kind: 'map',
    batch: 'mapCZ',
    id: 'map-cz',
    cs: 'Mapa Česka',
    attach: 'sablona-cesko.png',
    prompt:
      'Czechia as a hand-painted map. The dark outline in the template is the border: paint the land inside it, draw the border as a thin dark-brown ink line, and leave plain flat cream #F2EBDB outside it with nothing on it (no neighbouring land, no sea). Each dot is a town: a small cluster of terracotta roofs exactly on it. The mountains along its borders (Krkonoše in the north, Šumava in the south-west, Krušné hory in the north-west, the Beskydy in the east) as small painted hills with dark green forests, the gentle Bohemian-Moravian Highlands in the middle, patches of olive fields and ochre farmland, clusters of small painted trees for forests, the rivers Vltava, Labe, Morava and Odra as thin blue-green lines. Landscape image, 16:9.',
  },
  {
    kind: 'map',
    batch: 'mapBrno',
    id: 'map-brno',
    // rev 2 (Matyáš, 2026-11-27): the first was too small a city with made-up streets
    rev: 2,
    cs: 'Mapa Brna (celé město, skutečné ulice)',
    attach: 'sablona-brno.png',
    prompt:
      'The city of Brno as a detailed hand-painted city map that fills the whole image edge to edge: no border, no outline, no cream around it. The dark lines of the template are the real streets: paint every one of them exactly where it is, the thick lines as wide main roads, the thinner ones as streets and the thinnest as narrow lanes, with city blocks of terracotta roofs, inner courtyards and small gardens between them. The blue lines are the rivers Svratka and Svitava. The dot is the old town: dense old houses and squares around it, the Špilberk castle on its wooded hill just west of it and the cathedral with two spires on Petrov hill just south-west of it. Parks as clusters of trees, the exhibition grounds by the Svratka in the south-west, garden suburbs with villas towards the edges, a little farmland and forest only in the corners. Square image.',
  },
];

// ── Dressing up (Matyáš, 2026-11-27): every piece of gear as an edit of the base gladiator
// (dress-base). The app cuts the piece out by comparing the edit with the base and draws it on him. ──
const WEAR = {
  helmet: 'Put it on his head; his face stays visible where the helmet allows.',
  shield: 'Put it on his left forearm, its front facing the viewer.',
  weapon: 'Put it in his right hand, held down at his side (a net hangs from his left hand).',
  guard: 'Put it where it is worn (on his arm, his legs or his shoulder), nothing else.',
  armour: 'Dress him in it as it is worn.',
};
for (const g of ASSETS.filter((a) => a.kind === 'item' && !a.id.startsWith('icon-'))) {
  const slot = g.id.split('_')[0];
  ASSETS.push({
    kind: 'layer',
    batch: g.batch === 'items1' ? 'layers1' : g.batch === 'items2' ? 'layers2' : 'layers3',
    id: `layer-${g.id}`,
    cs: g.cs.replace('Výzbroj:', 'Na gladiátorovi:'),
    prompt: `${g.prompt} ${WEAR[slot] ?? ''}`.trim(),
  });
}

// Light cloth and whitewashed walls: the cream inside them is paint, not background seen through a
// gap, so the import keeps it (2026-11-27: holes in the tunic, the loincloth, home 2, the trough).
for (const a of ASSETS)
  if (
    ['armour_tunic', 'armour_subligaculum', 'armour_exomis', 'home-2', 'water-trough'].includes(
      a.id,
    )
  )
    a.keepHoles = true;
