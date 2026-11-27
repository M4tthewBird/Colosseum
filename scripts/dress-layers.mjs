/**
 * Dressing up the painted gladiator (Matyáš, 2026-11-27): cut every piece of gear out of its
 * "layer" picture (the base gladiator with that one piece, Gemini kit batches layers1–3) by
 * comparing it with the base, and cut the base out of its cream background. All come out in the
 * same frame, so the app stacks base + armour + guards + helmet + weapon + shield.
 *
 *   node scripts/dress-layers.mjs   (npm run art:import runs it too)
 *
 * Output: assets/game/painted/dress/base.webp and dress/<gear id>.webp, 540 × 723, transparent.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'assets/game/painted/dressup');
const out = path.join(root, 'assets/game/painted/dress');
const W = 540;

const cream = [0xf2, 0xeb, 0xdb];

async function rgb(file, w, h) {
  return sharp(file).resize(w, h, { fit: 'fill' }).removeAlpha().raw().toBuffer();
}

/** Grow (r > 0) or shrink (r < 0) a mask by |r| px (square neighbourhood). */
function morph(mask, w, h, r) {
  const outM = new Uint8Array(mask.length);
  const grow = r > 0;
  const k = Math.abs(r);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = grow ? 0 : 1;
      for (let dy = -k; dy <= k && (grow ? !v : v); dy++)
        for (let dx = -k; dx <= k; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          const m = xx >= 0 && yy >= 0 && xx < w && yy < h ? mask[yy * w + xx] : 0;
          if (grow && m) {
            v = 1;
            break;
          }
          if (!grow && !m) {
            v = 0;
            break;
          }
        }
      outM[y * w + x] = v;
    }
  return outM;
}

/** Keep connected parts of at least `min` px. */
function keepBig(mask, w, h, min) {
  const label = new Int32Array(mask.length).fill(-1);
  const keep = new Uint8Array(mask.length);
  const stack = [];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || label[i] !== -1) continue;
    const part = [];
    stack.push(i);
    label[i] = i;
    while (stack.length) {
      const p = stack.pop();
      part.push(p);
      const x = p % w;
      const y = (p - x) / w;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const q = yy * w + xx;
        if (mask[q] && label[q] === -1) {
          label[q] = i;
          stack.push(q);
        }
      }
    }
    if (part.length >= min) for (const p of part) keep[p] = 1;
  }
  return keep;
}

async function save(data, mask, w, h, file) {
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    rgba[i * 4] = data[i * 3];
    rgba[i * 4 + 1] = data[i * 3 + 1];
    rgba[i * 4 + 2] = data[i * 3 + 2];
    rgba[i * 4 + 3] = mask[i];
  }
  // a soft edge
  await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
    .webp({ quality: 88, alphaQuality: 90 })
    .toFile(file);
}

export async function dressLayers() {
  const baseFile = path.join(dir, 'dress-base.jpg');
  if (!fs.existsSync(baseFile)) return 0;
  const meta = await sharp(baseFile).metadata();
  const H = Math.round((W * meta.height) / meta.width);
  const N = W * H;
  fs.mkdirSync(out, { recursive: true });
  const base = await rgb(baseFile, W, H);
  const dist = (a, i, b, j) =>
    Math.abs(a[i * 3] - b[j * 3]) +
    Math.abs(a[i * 3 + 1] - b[j * 3 + 1]) +
    Math.abs(a[i * 3 + 2] - b[j * 3 + 2]);
  const creamDist = (a, i) =>
    Math.abs(a[i * 3] - cream[0]) +
    Math.abs(a[i * 3 + 1] - cream[1]) +
    Math.abs(a[i * 3 + 2] - cream[2]);

  // the base: everything not cream that touches... simply not background-like
  const bg = new Uint8Array(N);
  const stack = [];
  for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
  while (stack.length) {
    const p = stack.pop();
    if (bg[p] || creamDist(base, p) > 34) continue;
    bg[p] = 1;
    const x = p % W;
    const y = (p - x) / W;
    if (x > 0) stack.push(p - 1);
    if (x < W - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - W);
    if (y < H - 1) stack.push(p + W);
  }
  let baseMask = new Uint8Array(N);
  for (let i = 0; i < N; i++) baseMask[i] = bg[i] ? 0 : 1;
  baseMask = keepBig(baseMask, W, H, 400);
  await save(
    base,
    baseMask.map((v) => v * 255),
    W,
    H,
    path.join(out, 'base.webp'),
  );

  let n = 0;
  for (const f of fs.readdirSync(dir)) {
    const m = f.match(/^layer-(.+)\.(jpe?g|png)$/i);
    if (!m) continue;
    const id = m[1];
    const layer = await rgb(path.join(dir, f), W, H);
    // helmets and shields were edits of the base itself (pixel-true), so a small difference is
    // the piece; the rest came from sheets Gemini redrew, so only a big one is
    const exact = id.startsWith('helmet') || id.startsWith('shield');
    // armour and guards lie on the body: gold and cloth differ little from skin, so a lower bar
    const onBody = id.startsWith('armour') || id.startsWith('guard');
    const thin = id === 'armour_straps' || id === 'guard_fasciae' || id === 'weapon_net';
    const th = exact ? 30 : onBody ? 36 : 58;
    // where each kind of piece is worn (the frame of the base): drops redraw noise elsewhere
    const where = (x, y) => {
      if (id.startsWith('helmet')) return y < 0.3 * H;
      if (id.startsWith('shield')) return x > 0.48 * W;
      if (id.startsWith('weapon') && id !== 'weapon_two_gladii') return x < 0.52 * W || y < 0.1 * H;
      return true;
    };
    let mask = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      const x = i % W;
      const y = (i - x) / W;
      mask[i] = where(x, y) && dist(layer, i, base, i) > th && creamDist(layer, i) > 30 ? 1 : 0;
    }
    // drop thin redraw lines and specks, then give the piece its edge back
    mask = morph(mask, W, H, exact || thin || !onBody ? -1 : -2);
    mask = keepBig(mask, W, H, Math.round(N * 0.001));
    mask = morph(mask, W, H, exact || thin || !onBody ? 2 : 3);
    // fill holes inside the piece (skin showing through gold is still the piece)
    const inv = keepBig(
      mask.map((v) => 1 - v),
      W,
      H,
      Math.round(N * 0.006),
    );
    for (let i = 0; i < N; i++) if (!inv[i]) mask[i] = 1;
    const alpha = mask.map((v) => v * 255);
    await save(layer, alpha, W, H, path.join(out, `${id}.webp`));
    n++;
  }
  return n;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const n = await dressLayers();
  console.log(`Oblékání: základ a ${n} kusů výzbroje v assets/game/painted/dress/`);
}
