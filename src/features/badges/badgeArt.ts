/**
 * Badge artwork from the Claude Design canvas "Colosseum badges", as SVG strings in one
 * viewBox 0 0 100 100: a laurel frame per level (0 = not earned, 1–5), and in the disc either
 * the badge's symbol (24×24 grid) or, for the strength clubs, a lift pictogram (32×24) with the
 * kg below. The repeated parts (mirrored wreath halves, plates, helmets) are built from data
 * here instead of being spelled out. Symbols are centred on the disc by their measured bounds.
 */
import type { BadgeIcon } from '@/lib/badges';

const RED = '#B91C1C';
const GREY = '#AEAEB2';
const WHITE = '#FFFFFF';
const GREY_FILL = 'rgba(118,118,128,0.12)';

/** Centre of the disc in every frame. */
const CX = 50;
const CY = 51;

const LEAF = 'M0 -5.5C3.1 -1.98 2.5 3.96 0 5.5C-2.5 3.96 -3.1 -1.98 0 -5.5Z';

interface Frame {
  color: string;
  /** Stem of the right half; the left half is its mirror. */
  arc: string;
  /** Leaves along the stem: x, y, rotation. */
  leaves: [number, number, number][];
  berries?: [number, number][];
  /** Ribbon and stars, drawn once (already symmetric). */
  extra?: string;
  disc: string;
  opacity?: number;
}

const disc = (fill: string, stroke: string, width: number) =>
  `<circle cx="${CX}" cy="${CY}" r="24.5" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
const solidDisc = (r: number, ring: number, ringWidth: number) =>
  `<circle cx="${CX}" cy="${CY}" r="${r}" fill="${RED}"/>` +
  `<circle cx="${CX}" cy="${CY}" r="${ring}" fill="none" stroke="${WHITE}" stroke-width="${ringWidth}"/>`;

const FRAME_DATA: Frame[] = [
  {
    color: GREY,
    opacity: 0.55,
    arc: 'M59.31 88.36A38.5 38.5 0 0 0 72.63 19.85',
    leaves: [
      [63.2, 91.61, 104],
      [65.9, 81.62, 28.55],
      [76.87, 84.18, 83],
      [75.82, 73.88, 7.55],
      [86.98, 72.35, 62],
      [82.3, 63.11, -13.45],
      [92.17, 57.68, 41],
      [84.5, 50.73, -34.45],
      [91.77, 42.12, 20],
      [82.11, 38.38, -55.45],
      [85.81, 27.74, -1],
      [75.46, 27.71, -76.45],
      [71.25, 18.9, -52.5],
    ],
    disc: disc(GREY_FILL, GREY, 2),
  },
  {
    color: '#E09999',
    arc: 'M61.9 87.62A38.5 38.5 0 0 0 83.99 32.93',
    leaves: [
      [66, 90.59, 100],
      [68.69, 80, 23.2],
      [80.72, 80.66, 76],
      [78.87, 69.89, -0.8],
      [90.12, 65.6, 52],
      [84.06, 56.52, -24.8],
      [92.6, 48.02, 28],
      [83.36, 42.19, -48.8],
      [83.17, 31.46, -26.5],
    ],
    disc: disc(WHITE, RED, 2),
  },
  {
    color: '#CE6060',
    arc: 'M59.31 88.36A38.5 38.5 0 0 0 76.74 23.31',
    leaves: [
      [63.2, 91.61, 104],
      [65.58, 81.78, 29.15],
      [76.09, 84.8, 84.33],
      [75.03, 74.74, 9.48],
      [85.95, 74.05, 64.67],
      [81.56, 64.93, -10.18],
      [91.61, 60.61, 45],
      [84.41, 53.5, -29.85],
      [92.41, 46.04, 25.33],
      [83.24, 41.77, -49.52],
      [88.27, 32.06, 5.67],
      [78.2, 31.12, -69.18],
      [75.51, 22.17, -44.5],
    ],
    disc: disc(WHITE, RED, 3),
  },
  {
    color: RED,
    arc: 'M58 88.66A38.5 38.5 0 0 0 72.63 19.85',
    leaves: [
      [61.77, 92.05, 106],
      [64.16, 82.46, 31.77],
      [74.05, 86.28, 87.71],
      [73.31, 76.43, 13.49],
      [83.91, 76.95, 69.43],
      [80.12, 67.83, -4.8],
      [90.34, 65, 51.14],
      [83.88, 57.53, -23.09],
      [92.7, 51.64, 32.86],
      [84.21, 46.57, -41.37],
      [90.74, 38.21, 14.57],
      [81.1, 36.06, -59.66],
      [84.67, 26.07, -3.71],
      [74.84, 27.06, -77.94],
      [71.25, 18.9, -52.5],
    ],
    disc: disc('#F1D2D2', RED, 3),
  },
  {
    color: RED,
    arc: 'M58 88.66A38.5 38.5 0 0 0 70.97 18.71',
    leaves: [
      [61.77, 92.05, 106],
      [64.26, 82.41, 31.58],
      [74.32, 86.1, 87.29],
      [73.59, 76.18, 12.86],
      [84.29, 76.44, 68.57],
      [80.42, 67.28, -5.85],
      [90.64, 64.09, 49.86],
      [84.03, 56.66, -24.56],
      [92.7, 50.36, 31.14],
      [84.05, 45.44, -43.28],
      [90.23, 36.7, 12.43],
      [80.46, 34.81, -61.99],
      [83.52, 24.54, -6.29],
      [73.66, 25.89, -80.71],
      [69.54, 17.83, -55.5],
    ],
    berries: [
      [72.07, 89.18],
      [83.16, 80.08],
      [90.73, 67.9],
      [94, 53.94],
      [92.62, 39.67],
      [86.73, 26.59],
      [76.96, 16.1],
    ],
    extra:
      `<path d="M50 90L42.5 98.5L40 95.5L46.5 88Z" fill="${RED}"/>` +
      `<path d="M50 90L57.5 98.5L60 95.5L53.5 88Z" fill="${RED}"/>` +
      `<circle cx="50" cy="89" r="3" fill="${RED}"/>`,
    disc: solidDisc(24.5, 21.3, 1.2),
  },
  {
    color: RED,
    arc: 'M56.69 88.92A38.5 38.5 0 0 0 67.48 16.7',
    leaves: [
      [60.33, 92.43, 108],
      [62.82, 83.03, 34.18],
      [72.23, 87.46, 90.62],
      [71.8, 77.74, 16.81],
      [82.1, 79.15, 73.25],
      [78.79, 70.01, -0.57],
      [89.05, 68.28, 55.88],
      [83.15, 60.54, -17.94],
      [92.43, 55.83, 38.5],
      [84.49, 50.21, -35.32],
      [91.93, 42.94, 21.12],
      [82.68, 39.94, -52.69],
      [87.61, 30.79, 3.75],
      [77.89, 30.69, -70.07],
      [79.86, 20.48, -13.62],
      [70.55, 23.29, -87.44],
      [65.97, 15.97, -61.5],
    ],
    berries: [
      [70.04, 90.28],
      [80.86, 82.5],
      [88.86, 71.85],
      [93.31, 59.3],
      [93.81, 45.98],
      [90.32, 33.13],
      [83.14, 21.9],
      [72.94, 13.34],
    ],
    extra:
      `<path d="M48.5 88.5L38 99.5L36.6 95.4L32.4 96L42 85.5Z" fill="${RED}"/>` +
      `<path d="M51.5 88.5L62 99.5L63.4 95.4L67.6 96L58 85.5Z" fill="${RED}"/>` +
      `<circle cx="50" cy="88.5" r="3.6" fill="${RED}"/>` +
      `<path d="M50 1L51.38 4.31L54.95 4.59L52.23 6.92L53.06 10.41L50 8.54L46.94 10.41L47.77 6.92L45.05 4.59L48.62 4.31Z" fill="${RED}"/>` +
      `<path d="M39.2 5.8L40.21 8.22L42.81 8.43L40.83 10.13L41.43 12.67L39.2 11.31L36.97 12.67L37.57 10.13L35.59 8.43L38.19 8.22Z" fill="${RED}"/>` +
      `<path d="M60.8 5.8L61.81 8.22L64.41 8.43L62.43 10.13L63.03 12.67L60.8 11.31L58.57 12.67L59.17 10.13L57.19 8.43L59.79 8.22Z" fill="${RED}"/>`,
    disc: solidDisc(25.5, 21.5, 1.5),
  },
];

function frameSvg(f: Frame): string {
  const half =
    `<path d="${f.arc}" fill="none" stroke="${f.color}" stroke-width="1.6" stroke-linecap="round"/>` +
    f.leaves
      .map(
        ([x, y, r]) =>
          `<path d="${LEAF}" transform="translate(${x} ${y}) rotate(${r})" fill="${f.color}"/>`,
      )
      .join('') +
    (f.berries ?? [])
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.5" fill="${f.color}"/>`)
      .join('');
  const wreath = `<g>${half}</g><g transform="translate(100 0) scale(-1 1)">${half}</g>`;
  return (
    (f.opacity ? `<g opacity="${f.opacity}">${wreath}</g>` : wreath) + (f.extra ?? '') + f.disc
  );
}

/** Frame per level, index 0 = not earned. */
export const FRAMES = FRAME_DATA.map(frameSvg);

// --- Symbols: 24×24 grid, currentColor -------------------------------------------------------

const HELMET =
  '<path fill="currentColor" stroke="none" d="M12 .6l3 2.6-.6 4.4H9.6L9 3.2z"/>' +
  '<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M4.4 13.8C4.4 10.3 7.6 8.2 12 8.2s7.6 2.1 7.6 5.6V18L17 23.4l-.8-5.4-2.6-1.6-.6 6H11l-.6-6-2.6 1.6-.8 5.4L4.4 18zM6.6 13.2l4 .7v1.7l-3.2.3zM17.4 13.2l-4 .7v1.7l3.2.3z"/>';

/** Squad: helmets per level (x, y, scale). */
const SQUAD: [number, number, number][][] = [
  [[0, 0, 1]],
  [
    [-1.97, 3.6, 0.7],
    [9.17, 3.6, 0.7],
  ],
  [
    [6, 0.15, 0.5],
    [1.95, 11.85, 0.5],
    [10.05, 11.85, 0.5],
  ],
  [
    [1.95, 0.15, 0.5],
    [10.05, 0.15, 0.5],
    [1.95, 11.85, 0.5],
    [10.05, 11.85, 0.5],
  ],
  [
    [1.95, 0.15, 0.5],
    [10.05, 0.15, 0.5],
    [-2.1, 11.85, 0.5],
    [6, 11.85, 0.5],
    [14.1, 11.85, 0.5],
  ],
];

const bar = (x: number, y: number, w: number, h: number, rx: number) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="currentColor" stroke="none"/>`;

/** Plate club: a bar with 1–5 plates per side. */
function plates(n: number): string {
  let s =
    bar(-9.6, 11.2, 43.2, 1.6, 0.8) + bar(4.4, 8.6, 1.6, 6.8, 0.6) + bar(18, 8.6, 1.6, 6.8, 0.6);
  for (let i = 0; i < n; i++)
    s += bar(1.8 - 2.6 * i, 3.5, 2.2, 17, 1) + bar(20 + 2.6 * i, 3.5, 2.2, 17, 1);
  return `<g transform="translate(3 3) scale(.75)">${s}</g>`;
}

export const SYMBOLS: Record<string, string> = {
  workouts:
    '<rect x="5" y="6" width="3.2" height="12" rx="1.2"/><rect x="15.8" y="6" width="3.2" height="12" rx="1.2"/><rect x="2" y="8.5" width="3" height="7" rx="1"/><rect x="19" y="8.5" width="3" height="7" rx="1"/><path d="M8.2 12h7.6"/>',
  streak:
    '<path d="M12 2.5c1 4 6 6 6 11.5a6 6 0 0 1-12 0c0-3 1.5-5 3-6 0 2 .9 3.4 2.4 4C11 8.5 11 5.5 12 2.5z"/><path d="M12 20.3a2.4 2.4 0 0 1-2.4-2.4c0-1.5 1.3-2.4 2.4-4 1.1 1.6 2.4 2.5 2.4 4a2.4 2.4 0 0 1-2.4 2.4z"/>',
  volume:
    '<path d="M7.7 11.4 6.9 7.6A3 3 0 0 1 9.8 4h4.4a3 3 0 0 1 2.9 3.6l-.8 3.8"/><path d="M5 15.6a7 7 0 0 1 14 0c0 1.9-.6 3.6-1.7 4.9H6.7C5.6 19.2 5 17.5 5 15.6z" fill="currentColor"/>',
  prs: '<path d="M7 3.5h10V9a5 5 0 0 1-10 0z"/><path d="M7 5.5H5a2 2 0 0 0 0 4h2.3M17 5.5h2a2 2 0 0 1 0 4h-2.3"/><path d="M12 14v3"/><rect x="8.5" y="17" width="7" height="3.5" rx="1"/>',
  total: '<path d="M3.5 8l4 4.5L12 5.5l4.5 7 4-4.5-1.8 10.5H5.3z"/><path d="M5.5 21h13"/>',
  early:
    '<path d="M7 17a5 5 0 0 1 10 0z" fill="currentColor"/><path d="M5.6 13.3l-1.9-1.1M7.75 10.94 6.49 9.14M12 9.6V7.4M16.25 10.94l1.26-1.8M18.4 13.3l1.9-1.1"/><path d="M4.6 17h14.8"/><rect x="2.2" y="15.4" width="2.4" height="5.2" rx=".8" fill="currentColor" stroke="none"/><rect x="19.4" y="15.4" width="2.4" height="5.2" rx=".8" fill="currentColor" stroke="none"/>',
  night:
    '<path d="M19.5 14.6A8 8 0 1 1 9.4 4.5a6.2 6.2 0 0 0 10.1 10.1z"/><path d="M17.5 3v4M15.5 5h4"/>',
  weekend:
    '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/><rect x="13.5" y="12.8" width="4.2" height="5" rx="1" fill="currentColor"/><path d="M7.5 14h.01M10.5 14h.01M7.5 17h.01M10.5 17h.01" stroke-width="2.4"/>',
  marathon:
    '<circle cx="12" cy="13.5" r="7.5"/><path d="M10 2.5h4M12 2.5V6M18.6 6.9l1.6-1.6M12 13.5V9.5"/>',
  bigday: '<path d="M13.5 2.5L5 13.5h6.5l-1 8L19 10.5h-6.5z"/>',
  explorer:
    '<circle cx="12" cy="12" r="9.5"/><path d="M16.6 7.4l-3.2 6-6 3.2 3.2-6z"/><path d="M16.6 7.4l-3.2 6-2.8-2.8z" fill="currentColor"/>',
  drops:
    '<path d="M2 12h20"/><rect x="4" y="3" width="3.2" height="18" rx="1.3"/><rect x="9.6" y="5.5" width="3.2" height="13" rx="1.2"/><rect x="15.2" y="8" width="3.2" height="8" rx="1.1"/><path d="M19.6 17.2l1.4 1.6 1.4-1.6" stroke-width="1.8"/>',
  failure:
    '<path d="M12 2.8c-4.6 0-8 3.3-8 7.8 0 2.4 1 4.2 2.6 5.4V19a1.6 1.6 0 0 0 1.6 1.6h7.6a1.6 1.6 0 0 0 1.6-1.6v-3c1.6-1.2 2.6-3 2.6-5.4 0-4.5-3.4-7.8-8-7.8z"/><path fill="currentColor" stroke="none" d="M7.2 11.3c0-1.4 1-2.1 2.3-2.1 1.3 0 2.2.9 2 2.2-.2 1.1-1 2-2.2 2-1.2 0-2.1-.8-2.1-2.1zM16.8 11.3c0-1.4-1-2.1-2.3-2.1-1.3 0-2.2.9-2 2.2.2 1.1 1 2 2.2 2 1.2 0 2.1-.8 2.1-2.1z"/><path d="M12 14.2l-.9 1.6h1.8z" fill="currentColor" stroke-width="1"/><path d="M10 20.6v-2.4M12 20.6v-2.4M14 20.6v-2.4" stroke-width="1.6"/>',
  supersets:
    '<path d="M10 13.5a4.6 4.6 0 0 0 6.9.5l3-3a4.6 4.6 0 0 0-6.5-6.5l-1.6 1.6"/><path d="M14 10.5a4.6 4.6 0 0 0-6.9-.5l-3 3a4.6 4.6 0 0 0 6.5 6.5l1.6-1.6"/>',
  comeback:
    '<path d="M7 10V6.6a1.6 1.6 0 0 1 3.2 0V10M10.2 9.4V5.6a1.6 1.6 0 0 1 3.2 0v3.8M13.4 9.4V6.4a1.6 1.6 0 0 1 3.2 0v3.4M16.6 10V8a1.6 1.6 0 0 1 3.2 0v6.2c0 3.6-2.8 6.3-6.3 6.3h-1.6C8.4 20.5 6 18 6 14.8V13"/><path d="M6 13c0-1.6 1.2-2.8 2.8-2.8h3.6a1.9 1.9 0 0 1 0 3.8H10"/>',
};
for (let t = 1; t <= 5; t++) {
  SYMBOLS[`plates${t}`] = plates(t);
  SYMBOLS[`friends${t}`] = SQUAD[t - 1]
    .map(([x, y, k]) => `<g transform="translate(${x} ${y}) scale(${k})">${HELMET}</g>`)
    .join('');
}

// --- Lift pictograms: 32×24, one per tier (the plates grow) -----------------------------------

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Bench: lifter on the bench, the plate ring grows with the tier. */
function bench(t: number): string {
  const R = 3.4 + 0.5 * (t - 1);
  const r = r2(R * 0.28);
  const ring = (k: number) =>
    `M${r2(16 - k)} 6a${k} ${k} 0 1 0 ${r2(2 * k)} 0a${k} ${k} 0 1 0 ${r2(-2 * k)} 0z`;
  return (
    bar(3, 17, 26, 1.8, 0.5) +
    '<rect x="6" y="18.4" width="1.8" height="5.6" fill="currentColor" stroke="none"/><rect x="24.2" y="18.4" width="1.8" height="5.6" fill="currentColor" stroke="none"/>' +
    '<circle cx="8.2" cy="14" r="2.7" fill="currentColor" stroke="none"/>' +
    bar(11.4, 13.6, 14, 3.2, 1) +
    '<path fill="currentColor" stroke="none" d="M23.4 13.6h4.2a1.4 1.4 0 0 1 1.4 1.4V24h-2.8v-7.2h-2.8z"/>' +
    bar(14.7, 6, 2.6, 8.6, 0.6) +
    `<path fill="currentColor" stroke="none" fill-rule="evenodd" d="${ring(r2(R))}${ring(r)}"/>`
  );
}

/** Squat and deadlift: the plates on the bar get taller with the tier. */
function bigPlates(barY: number, t: number): string {
  const y = r2(barY - 0.6 * (t - 1));
  const h = r2(6 + 1.2 * (t - 1));
  return bar(1.6, y, 2.8, h, 0.8) + bar(27.6, y, 2.8, h, 0.8);
}

function squat(t: number): string {
  return (
    '<circle cx="16" cy="3.4" r="3" fill="currentColor" stroke="none"/>' +
    bar(0, 7.4, 32, 1.6, 0.8) +
    bigPlates(5.2, t) +
    '<path fill="currentColor" stroke="none" d="M11.6 9.6h8.8l-1.6 6.2h-5.6z"/>' +
    '<path d="M9.6 8.2l1.2 4.4 2.4-1M22.4 8.2l-1.2 4.4-2.4-1" stroke-width="2.2"/>' +
    '<path d="M13.6 15.4L9.2 17.4l1 5.4M18.4 15.4l4.4 2 -1 5.4M8.4 22.8h2.6M21 22.8h2.6" stroke-width="2.8"/>'
  );
}

function deadlift(t: number): string {
  return (
    '<circle cx="16" cy="3.2" r="2.8" fill="currentColor" stroke="none"/>' +
    '<path fill="currentColor" stroke="none" d="M12.4 7h7.2l-.8 8.4h-5.6z"/>' +
    '<path d="M12.9 8.2l-1.4 8.6M19.1 8.2l1.4 8.6" stroke-width="2.2"/>' +
    '<path d="M14.2 15l-2.4 4.4.8 4.4M17.8 15l2.4 4.4-.8 4.4" stroke-width="2.8"/>' +
    bar(0, 16.4, 32, 1.6, 0.8) +
    bigPlates(14.2, t)
  );
}

export const GLYPHS: Record<string, string> = {};
for (let t = 1; t <= 5; t++) {
  GLYPHS[`bench${t}`] = bench(t);
  GLYPHS[`squat${t}`] = squat(t);
  GLYPHS[`deadlift${t}`] = deadlift(t);
}

/**
 * Drawn bounds (x, y, width, height, strokes included) of each symbol and pictogram, measured
 * in a browser (getBBox plus half the stroke). Used to put the drawing's middle on the disc's
 * middle, since the drawings do not all sit in the middle of their grid.
 */
export const BOUNDS: Record<string, [number, number, number, number]> = {
  workouts: [1, 5, 22, 14],
  streak: [5, 1.5, 14, 19.8],
  volume: [4, 3, 16, 18.5],
  prs: [2, 2.5, 20, 19],
  total: [2.5, 4.5, 19, 17.5],
  early: [2.2, 6.4, 19.6, 14.2],
  night: [2.9, 2, 17.6, 19.1],
  weekend: [2.5, 2, 19, 19.5],
  marathon: [3.5, 1.5, 17.7, 20.5],
  bigday: [4, 1.5, 16, 21],
  explorer: [1.5, 1.5, 21, 21],
  drops: [1, 2, 22.3, 20],
  failure: [3, 1.8, 18, 19.8],
  supersets: [1.9, 2.2, 20.2, 19.6],
  comeback: [5, 3, 15.8, 18.5],
  plates1: [-4.2, 5.6, 32.4, 12.8],
  friends1: [4.4, 0.6, 15.2, 22.8],
  plates2: [-4.2, 5.6, 32.4, 12.8],
  friends2: [1.1, 4, 21.8, 16],
  plates3: [-4.2, 5.6, 32.4, 12.8],
  friends3: [4.1, 0.5, 15.8, 23],
  plates4: [-4.2, 5.6, 32.4, 12.8],
  friends4: [4.1, 0.4, 15.8, 23.1],
  plates5: [-4.2, 5.6, 32.4, 12.8],
  friends5: [0.1, 0.4, 23.8, 23.1],
  bench1: [3, 2.6, 26, 21.4],
  squat1: [0, 0.4, 32, 23.8],
  deadlift1: [0, 0.4, 32, 24.8],
  bench2: [3, 2.1, 26, 21.9],
  squat2: [0, 0.4, 32, 23.8],
  deadlift2: [0, 0.4, 32, 24.8],
  bench3: [3, 1.6, 26, 22.4],
  squat3: [0, 0.4, 32, 23.8],
  deadlift3: [0, 0.4, 32, 24.8],
  bench4: [3, 1.1, 26, 22.9],
  squat4: [0, 0.4, 32, 23.8],
  deadlift4: [0, 0.4, 32, 24.8],
  bench5: [3, 0.6, 26, 23.4],
  squat5: [0, 0.4, 32, 23.8],
  deadlift5: [0, 0.4, 32, 24.8],
};

/** App badge icon → artwork key. */
const ART: Record<BadgeIcon, string> = {
  dumbbell: 'workouts',
  flame: 'streak',
  weight: 'volume',
  trophy: 'prs',
  plate: 'plates',
  bench: 'bench',
  squat: 'squat',
  deadlift: 'deadlift',
  crown: 'total',
  sunrise: 'early',
  moon: 'night',
  calendar: 'weekend',
  clock: 'marathon',
  bolt: 'bigday',
  compass: 'explorer',
  layers: 'drops',
  skull: 'failure',
  link: 'supersets',
  rotate: 'comeback',
  users: 'friends',
};
const CLUBS = ['bench', 'squat', 'deadlift'];
const LEVELLED = ['plates', 'friends'];

/** Grey when not earned, red on the light discs (1–3), white on the solid ones (4–5). */
export const inkFor = (level: number) => (level <= 0 ? GREY : level >= 4 ? WHITE : RED);

const tierOf = (level: number) => Math.max(1, Math.min(5, level));

/** Height of a capital or digit of the bold system font, as a share of the font size. */
const CAP = 0.72;

/** Translate that puts a drawing's middle at (cx, cy) at the given scale. */
function centred(key: string, scale: number, cx: number, cy: number, grid: [number, number]) {
  const [x, y, w, h] = BOUNDS[key] ?? [0, 0, grid[0], grid[1]];
  return `translate(${r2(cx - (x + w / 2) * scale)} ${r2(cy - (y + h / 2) * scale)}) scale(${scale})`;
}

/**
 * The whole medallion as SVG (viewBox 0 0 100 100).
 * @param icon   the badge's icon from lib/badges
 * @param level  0 = not earned, 1–5 = how far up its ladder
 * @param num    kg, only shown by the strength clubs
 * @param size   rendered size; below 60 px the clubs drop the pictogram for a bigger number
 */
export function medallionSvg(icon: BadgeIcon, level: number, num = '', size = 64): string {
  const id = ART[icon];
  const ink = inkFor(level);
  const frame = FRAMES[Math.max(0, Math.min(5, level))];
  const g = (transform: string, width: number, body: string) =>
    `<g transform="${transform}" fill="none" stroke="${ink}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${body}</g>`;
  // No font family: the SVG takes the app's system font (SF Pro on iOS).
  const text = (y: number, fs: number) =>
    `<text x="${CX}" y="${r2(y)}" text-anchor="middle" font-weight="800" letter-spacing="-0.6" font-size="${fs}" fill="${ink}">${num}</text>`;
  let centre: string;
  if (CLUBS.includes(id)) {
    const three = num.length > 2;
    if (size >= 60) {
      // Pictogram and number as one block, centred on the disc.
      const key = id + tierOf(level);
      const scale = 0.95;
      const fs = three ? 12.5 : 14;
      const gh = (BOUNDS[key]?.[3] ?? 24) * scale;
      const gap = 4.2;
      const top = CY - (gh + gap + fs * CAP) / 2;
      centre =
        g(centred(key, scale, CX, top + gh / 2, [32, 24]), 1.8, GLYPHS[key]) +
        text(top + gh + gap + fs * CAP, fs);
    } else {
      const fs = three ? 19 : 23;
      centre = text(CY + (fs * CAP) / 2, fs);
    }
  } else {
    const key = LEVELLED.includes(id) ? id + tierOf(level) : id;
    centre = g(centred(key, 1.25, CX, CY, [24, 24]), 2, SYMBOLS[key]);
  }
  // currentColor is spelled out so nothing depends on colour inheritance.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${frame}${centre.replace(/currentColor/g, ink)}</svg>`;
}
