/**
 * The painted maps (Czechia and Brno) and their outline templates for Gemini.
 *
 * A map is painted over a template that shows the real outline in a simple projection: x grows
 * with longitude × cos(the middle latitude), y with latitude, both linear. So a painted map that
 * keeps the outline where the template has it puts a gym at
 *   x = (lng − west) / (east − west) × width,  y = (north − lat) / (north − south) × height,
 * with the frame below saved in the manifest next to the picture.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => JSON.parse(fs.readFileSync(path.join(here, f), 'utf8'));

export const MAPS = {
  'map-cz': {
    data: 'cz.json',
    template: 'sablona-cesko.png',
    width: 2048,
    height: 1152,
    margin: 0.06,
  },
  'map-brno': {
    data: 'brno.json',
    template: 'sablona-brno.png',
    width: 1536,
    height: 1536,
    margin: 0.05,
  },
};

/** The map's frame in degrees: the outline centred, with a margin on its tighter side. */
export function frameOf(id) {
  const m = MAPS[id];
  const { outline } = read(m.data);
  const lngs = outline.map((p) => p[0]);
  const lats = outline.map((p) => p[1]);
  const [w, e, s, n] = [Math.min(...lngs), Math.max(...lngs), Math.min(...lats), Math.max(...lats)];
  const k = Math.cos((((s + n) / 2) * Math.PI) / 180);
  const aspect = m.width / m.height;
  // the outline's size in "flat degrees", grown by the margin on both sides
  let fw = ((e - w) * k) / (1 - 2 * m.margin);
  let fh = (n - s) / (1 - 2 * m.margin);
  if (fw / fh > aspect) fh = fw / aspect;
  else fw = fh * aspect;
  const cx = (w + e) / 2;
  const cy = (s + n) / 2;
  const r = (v) => +v.toFixed(5);
  return {
    west: r(cx - fw / 2 / k),
    east: r(cx + fw / 2 / k),
    south: r(cy - fh / 2),
    north: r(cy + fh / 2),
  };
}

/** Where a point lands on the map picture, in px. */
export function project(id, [lng, lat]) {
  const m = MAPS[id];
  const f = frameOf(id);
  return [
    ((lng - f.west) / (f.east - f.west)) * m.width,
    ((f.north - lat) / (f.north - f.south)) * m.height,
  ];
}

/**
 * The template: cream paper, the outline as a thick dark line, rivers in blue (only inside it),
 * towns as dots.
 * `overlay` draws only the lines in red on a transparent ground, to lay over the painted map.
 */
export function templateSvg(id, { overlay = false } = {}) {
  const m = MAPS[id];
  const geo = read(m.data);
  const pts = (line) =>
    line
      .map((p) => project(id, p))
      .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
      .join(' ');
  const ink = overlay ? '#E0261B' : '#3B2F22';
  const stroke = Math.round(m.width / 340);
  const rivers = (geo.rivers ?? [])
    .map(
      (r) =>
        `<polyline points="${pts(r)}" fill="none" stroke="${overlay ? ink : '#4A7FA0'}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join('');
  const towns = Object.values(geo.towns ?? {})
    .map((p) => {
      const [x, y] = project(id, p);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${stroke * 2.2}" fill="${ink}"/>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${m.width}" height="${m.height}">${
    overlay ? '' : '<rect width="100%" height="100%" fill="#F2EBDB"/>'
  }<defs><clipPath id="in"><polygon points="${pts(geo.outline)}"/></clipPath></defs><polygon points="${pts(geo.outline)}" fill="${overlay ? 'none' : '#E4D9C0'}" stroke="${ink}" stroke-width="${stroke * 1.6}" stroke-linejoin="round"/><g clip-path="url(#in)">${rivers}</g>${towns}</svg>`;
}
