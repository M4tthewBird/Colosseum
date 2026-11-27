/**
 * Painted game pictures, made in Gemini (docs/PAINTED-UI.md). The list and prompts are in
 * scripts/painted-assets.mjs.
 *
 *   npm run art          write the gemini-obrazky/hra/ kit (steps in Czech, batches, attachments)
 *   npm run art:import   take the pictures downloaded from Gemini (gemini-obrazky/hra/stazene/, also
 *                        in subfolders), remove the cream background, size them, write them to
 *                        assets/game/painted/<group>/ with assets/game/painted/manifest.json, draw
 *                        the previews and move the originals to gemini-obrazky/hra/hotove/
 *
 * City pieces are scaled so their diamond base is exactly `size × TILE` px wide; the manifest
 * gives each one's anchor (the base's front corner), which the app puts on the grid point under
 * the piece. The background goes as PAINTED-UI §3 says: a flood fill from the borders through
 * the cream, then small specks (a watermark) and enclosed cream holes (under an arch) go too, the
 * edge is eroded by 1 px and softened.
 *
 * Options for trying it out: --kit=<folder> --out=<folder>.
 */
import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

import { dressLayers } from './dress-layers.mjs';
import { frameOf, MAPS, templateSvg as mapSvg } from './geo/maps.mjs';
import { ASSETS, ATTACH, BATCHES, FORMAT, RATIO, STYLE } from './painted-assets.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? path.resolve(hit.slice(name.length + 3)) : fallback;
};
const kit = option('kit', path.join(root, 'gemini-obrazky/hra'));
const out = option('out', path.join(root, 'assets/game/painted'));
const inbox = path.join(kit, 'stazene');
const archive = path.join(kit, 'hotove');
/** The user's painted city: the style reference for every batch. */
const SOURCE_REFERENCE = path.join(root, 'gemini-obrazky/Assets/Mapa gym.jpg');
const REFERENCE = 'vzor-mesto.jpg';
const TEMPLATE = ATTACH.piece;

/** Width of one tile's diamond in the saved pictures (a 3×3 piece is 960 px wide). */
const TILE = 320;
/** Colour distance (|ΔR| + |ΔG| + |ΔB|) that still counts as background, and for cream holes. */
const TOLERANCE = 26;
const HOLE_TOLERANCE = 12;
const MAX_PER_BATCH = { piece: 11, ground: 3, figure: 11, item: 12, emblem: 4, map: 1 };

const GROUP = (a) =>
  a.kind === 'item'
    ? a.id.startsWith('icon-')
      ? 'icons'
      : 'gear'
    : a.batch === 'dressup' || a.kind === 'layer'
      ? 'dressup'
      : { piece: 'city', ground: 'ground', figure: 'gladiators', emblem: 'leagues', map: 'maps' }[
          a.kind
        ];

export function slug(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ───────────── What is done ─────────────

const manifestFile = path.join(out, 'manifest.json');
function readManifest() {
  const empty = { ratio: RATIO, tile: TILE, assets: {} };
  if (!fs.existsSync(manifestFile)) return empty;
  const m = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  // A picture deleted by hand counts as not done.
  for (const [id, a] of Object.entries(m.assets)) {
    if (!fs.existsSync(path.join(out, a.file))) delete m.assets[id];
  }
  return { ...empty, ...m };
}

/** Not made yet, or made for an older version of its prompt (`rev`, e.g. gladiators from the front). */
const missing = (manifest) =>
  ASSETS.filter((a) => {
    const done = manifest.assets[a.id];
    return !done || (done.rev ?? 1) < (a.rev ?? 1);
  });

/** Batches of what is missing, in the order of BATCHES, the test first. */
function batchesOf(todo) {
  const batches = [];
  for (const key of Object.keys(BATCHES)) {
    const list = todo.filter((a) => a.batch === key);
    if (!list.length) continue;
    const max = MAX_PER_BATCH[list[0].kind] ?? 12;
    for (let i = 0; i < list.length; i += max) batches.push({ key, list: list.slice(i, i + max) });
  }
  return batches;
}

// ───────────── The kit ─────────────

const sizeText = (a) => `Base ${a.size}x${a.size}, surface: ${a.base}.`;
const line = (a) => (a.kind === 'piece' ? `${sizeText(a)} ${a.prompt}` : a.prompt);

/** What to attach in Gemini for a batch: the style reference, the base template, a map's outline. */
const attachments = (list) =>
  [REFERENCE, ATTACH[list[0].kind], ...list.map((a) => a.attach)]
    .filter((f, i, all) => f && all.indexOf(f) === i)
    .map((f) => `\`${f}\``)
    .join(' a ');

const intro = (kind) =>
  kind === 'piece'
    ? 'The first attached image is the style reference: match its painting style, line work, colours, light and isometric angle exactly. The second attached image is the base template: the flat diamond base of a 1x1, 2x2 and 3x3 piece.'
    : kind === 'map'
      ? 'The first attached image is the style reference: match its painting style, line work, colours and light exactly (but paint the map from directly above). The second attached image is the outline template.'
      : kind === 'layer'
        ? 'The first attached image is the style reference. The second attached image is the base gladiator: every image is an edit of it.'
        : 'The attached image is the style reference: match its painting style, line work, colours and light exactly.';

/** The format, or one per kind when a batch mixes them (the dressing-up test: a base, then edits). */
const formats = (list) => {
  const kinds = [...new Set(list.map((a) => a.kind))];
  if (kinds.length === 1) return FORMAT[kinds[0]];
  return kinds
    .map((k) => {
      const n = list.flatMap((a, i) => (a.kind === k ? [i + 1] : []));
      return `FOR IMAGE${n.length > 1 ? 'S' : ''} ${n.join(', ')}:\n${FORMAT[k]}`;
    })
    .join('\n\n');
};

const batchText = (list) => {
  const kind = list[0].kind;
  return `You are painting game art for a fitness app themed on ancient Rome. I will ask for the pictures one at a time.

STYLE (identical for every image):
${STYLE}
${intro(kind)}

${formats(list)}

THE LIST (${list.length} images):
${list.map((a, i) => `${i + 1}. ${a.id}. ${line(a)}`).join('\n')}

RULES:
- One image per reply, in the order of the list. Below the image write only its number and id (for example "1. ${list[0].id}").
- When I write "next", make the next image. When I write "redo", make the same image again, fixing what I say.
- Keep the same style, angle, light and background in every image.

Make image 1 now.`;
};

const singleText = (a) =>
  `Game art for a fitness app themed on ancient Rome: ${a.id}. ${line(a)}\n\nSTYLE: ${STYLE}\n${intro(a.kind)}\n\n${FORMAT[a.kind]}`;

/** The base template: the 1×1, 2×2 and 3×3 diamonds at the city's angle, with their tiles. */
function templateSvg() {
  const W = 2048;
  const H = 1152;
  const unit = 230;
  const sizes = [1, 2, 3];
  const gap = 150;
  const total = sizes.reduce((s, n) => s + n * unit, 0) + gap * (sizes.length - 1);
  let x = (W - total) / 2;
  const bottom = 900;
  const shapes = sizes.map((n) => {
    const w = n * unit;
    const h = w / RATIO;
    const cx = x + w / 2;
    x += w + gap;
    const top = [cx, bottom - h];
    const right = [cx + w / 2, bottom - h / 2];
    const left = [cx - w / 2, bottom - h / 2];
    const pt = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
    return `<polygon points="${pt(top)} ${pt(right)} ${pt([cx, bottom])} ${pt(left)}" fill="#3B2F22" fill-opacity="0.07" stroke="#3B2F22" stroke-width="4" stroke-linejoin="round"/>
<text x="${cx}" y="${bottom + 90}" font-family="Arial, sans-serif" font-size="52" fill="#3B2F22" text-anchor="middle">${n}×${n}</text>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#F2EBDB"/>${shapes.join('\n')}</svg>`;
}

async function writeKit(manifest) {
  const todo = missing(manifest);
  const batches = batchesOf(todo);
  const file = (n) => `davka-${String(n + 1).padStart(2, '0')}.txt`;

  fs.mkdirSync(kit, { recursive: true });
  fs.rmSync(path.join(kit, 'davky'), { recursive: true, force: true });
  fs.mkdirSync(path.join(kit, 'davky'), { recursive: true });
  fs.mkdirSync(inbox, { recursive: true });
  fs.writeFileSync(path.join(inbox, '.gitkeep'), '');

  if (!fs.existsSync(path.join(kit, REFERENCE))) {
    if (!fs.existsSync(SOURCE_REFERENCE)) throw new Error(`Missing ${SOURCE_REFERENCE}`);
    // 2048 px is plenty for a style reference and uploads quickly.
    await sharp(SOURCE_REFERENCE)
      .resize({ width: 2048 })
      .jpeg({ quality: 88 })
      .toFile(path.join(kit, REFERENCE));
  }
  await sharp(Buffer.from(templateSvg())).png().toFile(path.join(kit, TEMPLATE));
  // the base gladiator for the dressing-up edits, as Gemini made it
  const base = path.join(out, 'dressup', 'dress-base.jpg');
  if (fs.existsSync(base)) fs.copyFileSync(base, path.join(kit, ATTACH.layer));
  for (const id of Object.keys(MAPS))
    await sharp(Buffer.from(mapSvg(id)))
      .png()
      .toFile(path.join(kit, MAPS[id].template));

  batches.forEach(({ list }, n) => {
    const singles = list
      .map((a, i) => `--- ${i + 1}. ${a.id} (${a.cs}) ---\n${singleText(a)}`)
      .join('\n\n');
    fs.writeFileSync(
      path.join(kit, 'davky', file(n)),
      `${batchText(list)}\n\n\n=====================================================================\n` +
        `ZÁLOHA: jednotlivé prompty (když Gemini ztratí přehled, otevři nový chat, přilož ${attachments(list).replace(/`/g, '')}\n` +
        `a pošli jen jeden z nich)\n` +
        `=====================================================================\n\n${singles}\n`,
    );
  });

  fs.writeFileSync(
    path.join(kit, 'importovat.cmd'),
    '@echo off\r\ncd /d "%~dp0..\\.."\r\ncall npm run art:import\r\necho.\r\npause\r\n',
  );

  const done = ASSETS.length - todo.length;
  const table = batches
    .map(
      ({ key, list }, n) =>
        `| [${file(n)}](davky/${file(n)}) | ${BATCHES[key]} | ${list.length} | ${attachments(list)} | ${list.map((a) => a.cs).join(', ')} |`,
    )
    .join('\n');
  const testLeft = todo.some((a) => a.batch === 'test');
  const dressLeft = todo.some((a) => a.batch === 'dressup');
  const dressSteps = `
## Zkouška oblékání

Dávka „Zkouška oblékání“ ověřuje, jestli jde výzbroj kreslit jako vrstvy na jednoho gladiátora (pak by se gladiátor oblékal podle toho, co má hráč na sobě). Obrázek 1 je gladiátor zepředu jen v bederní roušce, obrázky 2–5 jsou **úpravy obrázku 1**, každá s jedním kusem výzbroje.

- Gemini má každou úpravu dělat **z obrázku 1**, ne z předchozí. Když na gladiátorovi zůstane přilba z minula, napiš \`redo, start from image 1\` nebo obrázek 1 přilož znovu.
- Gladiátor se nesmí pohnout ani zvětšit. Po importu porovnám úpravy se základem a vyříznu z nich jen výzbroj.
`;

  const wallSteps = `
## Zkouška hradeb a akvaduktu

Úseky hradeb a akvaduktu se kladou za sebe přes dlaždice, takže musí navazovat: zeď běží **středem parcely** z poloviny jedné hrany do poloviny protější a končí rovně přesně na okraji. Úsek \`-a\` stoupá doprava (/), úsek \`-b\` doleva (\\). Po importu v \`nahled-mesto.png\` uvidíš, jestli dva úseky vedle sebe tvoří jednu zeď. Než uděláš dávky „Hradby“ a „Akvadukt“, napiš mi, jak to vypadá.
`;
  const layerSteps = `
## Oblékání: výzbroj na gladiátorovi

Každý kus výzbroje se maluje **na základního gladiátora** (\`zaklad-gladiator.jpg\`, přilož ho k dávce spolu se vzorem). Z rozdílu proti základu appka kus vyřízne a pak gladiátora obléká podle toho, co hráč má.

- Každý obrázek musí vycházet **ze základu**, ne z předchozího obrázku. Když na něm zůstane kus z minula (přilba, štít), napiš \`redo, start from the attached base image\`. Když se to opakuje, otevři nový chat a pokračuj záložním promptem.
- Gladiátor se nesmí pohnout, zvětšit ani změnit tvář.
`;
  const mapSteps = `
## Mapy

Ke každé mapě přilož vzor stylu **a její šablonu** (\`sablona-cesko.png\` nebo \`sablona-brno.png\`). Gemini musí nechat hranici přesně tam, kde je na šabloně, a stejný poměr stran (Česko 16:9, Brno čtverec). Jinak gymy na mapě nebudou na svém místě. Po importu otevři \`nahled-map-cz.png\` / \`nahled-map-brno.png\`: červená čára je skutečná hranice. Když se s namalovanou hranicí rozchází, napiš \`redo, keep the outline exactly where the template has it\`.
`;
  fs.writeFileSync(
    path.join(kit, 'NAVOD.md'),
    `# Malovaná hra v Gemini

Hotovo **${done} z ${ASSETS.length}**. Zbývá ${todo.length} obrázků v ${batches.length} dávkách.
Tenhle soubor i dávky se po každém importu přegenerují jen se zbývajícími obrázky.

Město se skládá z kousků: každá stavba stojí na vlastní parcele ve tvaru kosočtverce (1×1, 2×2 nebo 3×3 dlaždice) a appka ji položí na mřížku města tam, kam si ji hráč dá. Proto musí mít všechny stavby **stejný úhel, stejné světlo a plochou parcelu bez boků**.

## Co je v téhle složce

| Co | K čemu |
| --- | --- |
| \`${REFERENCE}\` | Vzor stylu (tvoje město). Přikládej ho ke každé dávce. |
| \`${TEMPLATE}\` | Tvar parcel 1×1, 2×2 a 3×3. Přikládej ho k dávkám se stavbami (v tabulce dole je u každé dávky, co přiložit). |
| \`sablona-cesko.png\`, \`sablona-brno.png\` | Skutečná hranice Česka a Brna (řeky modře, města tečkou). Přikládej ke své mapě. |
| \`nahled-map-*.png\` | Po importu mapy: skutečná hranice červeně přes namalovanou mapu. Musí sedět, jinak gymy nebudou na správném místě. |
| \`davky/\` | Prompty, jeden soubor = jedna dávka. Nahoře hlavní prompt, dole záložní prompty po jednom. |
| \`stazene/\` | Sem stahuj obrázky z Gemini. |
| \`importovat.cmd\` | Dvojklik: odstraní krémové pozadí, srovná velikost podle parcely, uloží obrázky do appky (\`assets/game/painted/\`) a nakreslí náhledy. |
| \`nahled-mesto.png\` | Po importu: všechny stavby poskládané na mřížce. Tady je vidět, jestli k sobě sedí. |
| \`nahled-ostatni.png\` | Po importu: gladiátoři, výzbroj, ligové znaky, ikony a terén. |
| \`hotove/\` | Sem import přesune originály. Klidně je smaž, nebo je nech pro případ, že by se import opakoval. |
${
  testLeft
    ? `
## Nejdřív zkouška

Začni dávkou \`davka-01.txt\`: Colosseum (3×3), velký chrám a kovárna (2×2) a squat rack (1×1).
Po importu otevři \`nahled-mesto.png\` a dej mi vědět, jak to vypadá. Když k sobě stavby nesedí (jiný úhel, hliněné boky parcely, něco přečnívá), upravím prompty dřív, než vygeneruješ zbytek.
`
    : ''
}${dressLeft ? dressSteps : ''}${todo.some((a) => a.batch === 'test2') ? wallSteps : ''}${todo.some((a) => a.kind === 'map') ? mapSteps : ''}${todo.some((a) => a.kind === 'layer') ? layerSteps : ''}
## Postup pro jednu dávku

1. Otevři **nový chat** v Gemini (model **Pro**, s generováním obrázků).
2. **Přilož, co je u dávky v tabulce dole** (vždy \`${REFERENCE}\`, u staveb i \`${TEMPLATE}\`).
3. Otevři \`davky/davka-01.txt\`, zkopíruj **všechno nad čarou „ZÁLOHA“** a odešli.
4. Gemini udělá obrázek 1. **Hned ho stáhni** (tlačítko stáhnout u obrázku) do složky \`stazene/\`.
5. Napiš \`next\` → obrázek 2 → stáhni. Takhle až do konce dávky.
   - Nepovedený obrázek: napiš \`redo\` a co opravit (např. \`redo, the base must be flat, no earth sides\`), stáhni až opravený.
   - Gemini se ztratí nebo změní styl: otevři nový chat, přilož totéž a pošli **záložní prompt** toho obrázku ze spodní části souboru.
6. Na konci dávky dvojklikni na **\`importovat.cmd\`**. Ve výpisu zkontroluj, že každý soubor dostal správný název, a podívej se na náhled.
7. Pokračuj další dávkou. Po importu se čísla dávek posunou, takže vždy začínej od \`davka-01.txt\`.

## Na co se dívat u staveb

- Stavba stojí na **ploché parcele ve tvaru kosočtverce**, bez hliněných boků a bez podstavce.
- **Nic nepřečnívá** přes levý, pravý ani přední roh parcely. Nahoru může cokoli (věž, kouř, prapor).
- Pozadí je **rovné krémové**, bez stínu a bez přechodu.
- Import vypíše varování, když úhel nebo souměrnost parcely nesedí. Takový obrázek zkus znovu (\`redo\`).

## Důležité

- **Nejjistější je pojmenovat soubor jeho id** z dávky (např. \`temple-3.png\`) nebo českým názvem (\`Velký chrám.png\`). Velikost písmen ani drobné překlepy nevadí.
  Nepojmenované soubory dostanou názvy podle pořadí stažení, takže pak musí sedět pořadí v dávce. Importuj proto po každé dávce.
- **Nepovedený obrázek** označ v názvu slovem \`wrong\` (např. \`forge - wrong.png\`), import ho přeskočí.
- V \`stazene/\` můžeš mít obrázky klidně v podsložkách po dávkách.
- **Gladiátor**: v jednom chatu drží Gemini stejného muže. Když musíš do nového chatu, přilož k vzoru i jeden povedený obrázek gladiátora.
- **Terén**: import zkontroluje, jestli textura navazuje na krajích. Když ne, vypíše varování.
- Kdyby Gemini do rohu dávalo vodoznak, import ho odstraní (malé samostatné skvrny maže).
- Import potřebuje Node.js a v projektu jednou \`npm install\` (už je hotové).

## Dávky

| Soubor | Co | Počet | Přiložit | Obrázky |
| --- | --- | --- | --- | --- |
${table}
`,
  );
  return { todo: todo.length, batches: batches.length };
}

// ───────────── Import ─────────────

/** Files in a folder and its subfolders, oldest download first. */
function filesIn(folder) {
  const found = [];
  for (const f of fs.readdirSync(folder, { withFileTypes: true })) {
    const full = path.join(folder, f.name);
    if (f.isDirectory()) found.push(...filesIn(full));
    else if (/\.(jpe?g|png|webp)$/i.test(f.name)) found.push(full);
  }
  return found
    .map((f) => ({ f, t: fs.statSync(f).mtimeMs }))
    .sort((x, y) => x.t - y.t)
    .map((x) => x.f);
}

const REJECTED = /\b(wrong|not good|spatne|špatně|spatně|bad)\b/i;
/** Gemini's own download names: these go by download order. */
const UNNAMED = /^(gemini|chatgpt|generated|image|download|img)[\W_]|^\d/i;

function typos(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
  return d[a.length][b.length];
}

/** The asset a file is named after: its id ("temple-3") or its Czech name ("Velký chrám"). */
const NAMES = new Map();
{
  const all = new Map();
  for (const a of ASSETS) {
    for (const k of [a.id, a.cs, a.cs.replace(/^[^:]*:\s*/, '')]) {
      const key = slug(k);
      all.set(key, (all.get(key) ?? new Set()).add(a.id));
    }
  }
  // "Murmillo" is both a helmet and a style: a name shared by two pictures matches neither.
  for (const [key, ids] of all) if (ids.size === 1) NAMES.set(key, [...ids][0]);
}
function idOf(file) {
  const k = slug(path.basename(file).replace(/\.[^.]+$/, ''));
  if (NAMES.has(k)) return NAMES.get(k);
  // "arena1", "plot3": the id without its dashes
  const compact = [...NAMES.keys()].filter((c) => c.replace(/-/g, '') === k.replace(/-/g, ''));
  if (compact.length === 1) return NAMES.get(compact[0]);
  const near = new Set(
    [...NAMES.keys()]
      .filter((c) => c.length > 4 && Math.abs(c.length - k.length) <= 2 && typos(c, k) <= 2)
      .map((c) => NAMES.get(c)),
  );
  return near.size === 1 ? [...near][0] : null;
}

/**
 * The picture without its cream background: RGBA at working size (at most 2048 px), and the
 * box around what is left.
 */
/** `holes: false` keeps cream inside the outline (light cloth, whitewashed walls). */
async function cutout(file, { holes: cutHoles = true } = {}) {
  const meta = await sharp(file).metadata();
  const k = Math.min(1, 2048 / Math.max(meta.width, meta.height));
  const W = Math.round(meta.width * k);
  const H = Math.round(meta.height * k);
  const rgb = await sharp(file).resize(W, H).removeAlpha().raw().toBuffer();
  const N = W * H;

  // The background: the median of the four corners (one may hold a watermark).
  const corner = (x0, y0) => {
    const c = [0, 0, 0];
    for (let y = y0; y < y0 + 12; y++)
      for (let x = x0; x < x0 + 12; x++)
        for (let ch = 0; ch < 3; ch++) c[ch] += rgb[(y * W + x) * 3 + ch] / 144;
    return c;
  };
  const corners = [corner(0, 0), corner(W - 12, 0), corner(0, H - 12), corner(W - 12, H - 12)];
  const bg = [0, 1, 2].map((ch) => {
    const v = corners.map((c) => c[ch]).sort((a, b) => a - b);
    return (v[1] + v[2]) / 2;
  });
  const dist = (i) =>
    Math.abs(rgb[i * 3] - bg[0]) +
    Math.abs(rgb[i * 3 + 1] - bg[1]) +
    Math.abs(rgb[i * 3 + 2] - bg[2]);

  // 0 = background, 1 = picture
  const keep = new Uint8Array(N).fill(1);
  const queue = new Int32Array(N);
  let head = 0;
  let tail = 0;
  const push = (i) => {
    if (keep[i] && dist(i) < TOLERANCE) {
      keep[i] = 0;
      queue[tail++] = i;
    }
  };
  for (let x = 0; x < W; x++) {
    push(x);
    push((H - 1) * W + x);
  }
  for (let y = 0; y < H; y++) {
    push(y * W);
    push(y * W + W - 1);
  }
  while (head < tail) {
    const i = queue[head++];
    const x = i % W;
    if (x > 0) push(i - 1);
    if (x < W - 1) push(i + 1);
    if (i >= W) push(i - W);
    if (i < N - W) push(i + W);
  }

  // Regions of the picture (4-connected) and of enclosed cream.
  const label = new Int32Array(N).fill(-1);
  const regions = [];
  const flood = (start, inside) => {
    const id = regions.length;
    let size = 0;
    head = 0;
    tail = 0;
    label[start] = id;
    queue[tail++] = start;
    while (head < tail) {
      const i = queue[head++];
      size++;
      const x = i % W;
      for (const j of [
        x > 0 ? i - 1 : -1,
        x < W - 1 ? i + 1 : -1,
        i >= W ? i - W : -1,
        i < N - W ? i + W : -1,
      ]) {
        if (j >= 0 && label[j] === -1 && inside(j)) {
          label[j] = id;
          queue[tail++] = j;
        }
      }
    }
    regions.push(size);
    return id;
  };
  // cream seen through an arch or a window: very close to the background and not tiny
  const holes = [];
  for (let i = 0; i < N && cutHoles; i++) {
    if (keep[i] && label[i] === -1 && dist(i) < HOLE_TOLERANCE) {
      const id = flood(i, (j) => keep[j] && dist(j) < HOLE_TOLERANCE);
      if (regions[id] > N * 0.0004) holes.push(id);
    }
  }
  const holeSet = new Set(holes);
  for (let i = 0; i < N; i++) if (keep[i] && holeSet.has(label[i])) keep[i] = 0;

  // Drop specks (a watermark, a stray bird) far smaller than the picture itself.
  label.fill(-1);
  regions.length = 0;
  for (let i = 0; i < N; i++) if (keep[i] && label[i] === -1) flood(i, (j) => keep[j] === 1);
  let largest = 0;
  for (const size of regions) if (size > largest) largest = size;
  for (let i = 0; i < N; i++) {
    if (keep[i] && regions[label[i]] < largest * 0.005) {
      keep[i] = 0;
    }
  }

  // Erode 1 px (the edge pixels are half cream), then soften.
  const alpha = Buffer.alloc(N);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let on = keep[i];
      if (on && (x === 0 || y === 0 || x === W - 1 || y === H - 1)) on = 0;
      if (on && !(keep[i - 1] && keep[i + 1] && keep[i - W] && keep[i + W])) on = 0;
      alpha[i] = on ? 255 : 0;
    }
  const soft = await sharp(alpha, { raw: { width: W, height: H, channels: 1 } })
    .blur(0.8)
    .toColourspace('b-w')
    .raw()
    .toBuffer();

  const rgba = Buffer.alloc(N * 4);
  let x0 = W;
  let y0 = H;
  let x1 = -1;
  let y1 = -1;
  for (let i = 0; i < N; i++) {
    rgba[i * 4] = rgb[i * 3];
    rgba[i * 4 + 1] = rgb[i * 3 + 1];
    rgba[i * 4 + 2] = rgb[i * 3 + 2];
    const a = soft[i];
    rgba[i * 4 + 3] = a;
    if (a > 8) {
      const x = i % W;
      const y = (i - x) / W;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) throw new Error('nothing left after removing the background');
  const box = { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
  const trimmed = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
    .extract(box)
    .raw()
    .toBuffer();
  const notes = [];
  if (holes.length)
    notes.push('krémové pozadí odstraněno i uvnitř (např. pod obloukem), zkontroluj v náhledu');
  const edge = box.left <= 1 || box.top <= 1 || x1 >= W - 2 || y1 >= H - 2;
  return { data: trimmed, width: box.width, height: box.height, edge, notes };
}

/**
 * The diamond base of a piece, read off its outline: the front corner (lowest point) and the side
 * corners (in the outermost columns). Gemini tends to give the base thin earth sides; their
 * thickness is the solid run under a side corner, where a flat base ends in a point.
 */
function measureBase({ data, width: W, height: H }) {
  const solid = (x, y) => data[(y * W + x) * 4 + 3] > 128;
  let tipY = H - 1;
  const rowEmpty = (y) => {
    for (let x = 0; x < W; x++) if (solid(x, y)) return false;
    return true;
  };
  while (tipY > 0 && rowEmpty(tipY)) tipY--;
  let sx = 0;
  let n = 0;
  for (let y = Math.max(0, tipY - 2); y <= tipY; y++)
    for (let x = 0; x < W; x++)
      if (solid(x, y)) {
        sx += x;
        n++;
      }
  const tipX = sx / n;
  // A side corner: its point (the first solid pixel of the outermost column) and the longest
  // solid run in the 5 columns next to it. A flat corner spans ~5 px there; earth sides add their
  // thickness.
  const corner = (x0, step) => {
    const first = (x) => {
      let y = 0;
      while (y < H && !solid(x, y)) y++;
      return y;
    };
    let run = 0;
    for (let k = 0; k < 5; k++) {
      const x = x0 + k * step;
      let r = 0;
      for (let y = first(x); y < H && solid(x, y); y++) r++;
      run = Math.max(run, r);
    }
    return { top: first(x0), run };
  };
  // the outermost columns with solid pixels (the soft edge around the cut-out is not solid)
  const solidColumn = (x) => {
    for (let y = 0; y < H; y++) if (solid(x, y)) return true;
    return false;
  };
  let xl = 0;
  while (xl < W - 1 && !solidColumn(xl)) xl++;
  let xr = W - 1;
  while (xr > 0 && !solidColumn(xr)) xr--;
  const left = corner(xl, 1);
  const right = corner(xr, -1);
  // the sides are as thick as the shorter run, less what a flat corner spans anyway
  let sides = Math.max(0, Math.min(left.run, right.run) - 6);
  const unclear = sides > W * 0.04;
  if (unclear) sides = 0;
  const frontY = tipY - sides;
  return {
    tipX,
    xl,
    xr,
    frontY,
    leftY: left.top,
    rightY: right.top,
    sides,
    unclear,
    ratioLeft: (tipX - xl) / Math.max(1, frontY - left.top),
    ratioRight: (xr - tipX) / Math.max(1, frontY - right.top),
  };
}

/** Cut the earth sides off, along the base's two front edges, so the piece lies flat. */
function flattenBase(c, base) {
  // no sides, or a tree or a wall at a corner hides them: leave the picture as it is
  if (!base.sides) return c;
  const { data, width: W } = c;
  const edge = (x) =>
    x <= base.tipX
      ? base.leftY +
        (Math.max(0, x - base.xl) / Math.max(1, base.tipX - base.xl)) * (base.frontY - base.leftY)
      : base.frontY +
        Math.min(1, (x - base.tipX) / Math.max(1, base.xr - base.tipX)) *
          (base.rightY - base.frontY);
  const height = Math.min(c.height, Math.ceil(base.frontY) + 2);
  const out = Buffer.alloc(W * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const keep = Math.min(1, Math.max(0, edge(x) + 1 - y));
      out[i] = data[i];
      out[i + 1] = data[i + 1];
      out[i + 2] = data[i + 2];
      out[i + 3] = Math.round(data[i + 3] * keep);
    }
  return { ...c, data: out, height };
}

function pieceWarnings(base, width) {
  const w = [];
  const ratio = (base.ratioLeft + base.ratioRight) / 2;
  if (Math.abs(ratio - RATIO) / RATIO > 0.1)
    w.push(`úhel parcely nesedí (${ratio.toFixed(2)} : 1 místo ${RATIO} : 1)`);
  if (
    Math.abs(base.ratioLeft - base.ratioRight) / RATIO > 0.12 ||
    Math.abs(base.tipX - width / 2) > width * 0.05
  )
    w.push('parcela není souměrná (něco přečnívá přes roh, nebo je stavba natočená)');
  if (base.unclear) w.push('u rohu parcely něco stojí, boky parcely nešly oříznout');
  return w;
}

const webp = (img) => img.webp({ quality: 90, alphaQuality: 100, effort: 5 });
const raw = (c) => ({ raw: { width: c.width, height: c.height, channels: 4 } });

/** Fit a cut-out picture into a canvas (scale, and the box it may fill). */
async function onCanvas(c, { width, height, fitW, fitH, bottom }) {
  const k = Math.min(fitW / c.width, fitH / c.height);
  const w = Math.max(1, Math.round(c.width * k));
  const h = Math.max(1, Math.round(c.height * k));
  const scaled = await sharp(c.data, raw(c)).resize(w, h, { kernel: 'lanczos3' }).png().toBuffer();
  const left = Math.round((width - w) / 2);
  const top = bottom != null ? height - bottom - h : Math.round((height - h) / 2);
  return {
    image: sharp({
      create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    }).composite([{ input: scaled, left, top }]),
    widthLimited: fitW / c.width < fitH / c.height,
  };
}

/** Process one downloaded picture into the app's folder; returns the manifest entry and notes. */
async function processOne(file, asset) {
  const group = GROUP(asset);
  const rel = `${group}/${asset.id}.webp`;
  const dest = path.join(out, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  // The dressing-up test keeps its originals: the gear is cut out by comparing each edit with
  // the base, which needs the pictures as Gemini made them.
  if (asset.batch === 'dressup' || asset.kind === 'layer') {
    const original = path.join(out, group, `${asset.id}${path.extname(file).toLowerCase()}`);
    fs.copyFileSync(file, original);
    if (asset.kind === 'layer')
      return {
        entry: { kind: 'layer', file: path.relative(out, original).split(path.sep).join('/') },
        notes: [],
      };
  }

  if (asset.kind === 'ground') {
    const img = sharp(file).resize(1024, 1024, { fit: 'cover' });
    await img.clone().webp({ quality: 88 }).toFile(dest);
    // Seams: the edge columns and rows should differ no more than neighbours inside do.
    const px = await sharp(file)
      .resize(1024, 1024, { fit: 'cover' })
      .removeAlpha()
      .raw()
      .toBuffer();
    const diff = (a, b) => {
      let s = 0;
      for (let t = 0; t < 1024; t++)
        for (let ch = 0; ch < 3; ch++) s += Math.abs(px[a(t) * 3 + ch] - px[b(t) * 3 + ch]);
      return s / 1024 / 3;
    };
    const edges =
      (diff(
        (t) => t * 1024,
        (t) => t * 1024 + 1023,
      ) +
        diff(
          (t) => t,
          (t) => 1023 * 1024 + t,
        )) /
      2;
    const inside =
      (diff(
        (t) => t * 1024 + 511,
        (t) => t * 1024 + 512,
      ) +
        diff(
          (t) => 511 * 1024 + t,
          (t) => 512 * 1024 + t,
        )) /
      2;
    const notes = edges > Math.max(12, inside * 2.5) ? ['textura asi nenavazuje na krajích'] : [];
    return { entry: { kind: 'ground', file: rel, width: 1024, height: 1024 }, notes };
  }

  if (asset.kind === 'map') {
    // no cut-out: the map keeps its cream, and is stretched to the template's frame exactly
    const m = MAPS[asset.id];
    const meta = await sharp(file).metadata();
    const got = meta.width / meta.height;
    const want = m.width / m.height;
    const notes =
      Math.abs(got / want - 1) > 0.03
        ? [`jiný poměr stran (${got.toFixed(2)} místo ${want.toFixed(2)}), hranice asi nesedí`]
        : [];
    await sharp(file)
      .resize(m.width, m.height, { fit: 'fill', kernel: 'lanczos3' })
      .webp({ quality: 86 })
      .toFile(dest);
    return {
      entry: { kind: 'map', file: rel, width: m.width, height: m.height, geo: frameOf(asset.id) },
      notes,
    };
  }

  const c = await cutout(file, { holes: !asset.keepHoles });
  const notes = [...c.notes];
  if (c.edge) notes.push('obrázek sahá až k okraji (něco je asi uříznuté)');

  if (asset.kind === 'piece') {
    const base = measureBase(c);
    notes.push(...pieceWarnings(base, c.width));
    const flat = flattenBase(c, base);
    // The base (its solid corners, not the soft edge) becomes exactly size × TILE wide, and its
    // height is evened out to the grid's angle: Gemini draws it a few per cent taller or flatter.
    const k = (asset.size * TILE) / (base.xr - base.xl + 1);
    const ky = (k * (base.ratioLeft + base.ratioRight)) / 2 / RATIO;
    const width = Math.round(flat.width * k);
    const height = Math.round(flat.height * ky);
    await webp(
      sharp(flat.data, raw(flat)).resize(width, height, { kernel: 'lanczos3', fit: 'fill' }),
    ).toFile(dest);
    return {
      entry: {
        kind: 'piece',
        size: asset.size,
        file: rel,
        width,
        height,
        // the base's front corner, which goes on the grid point under the piece
        anchor: [Math.round(base.tipX * k), Math.round((base.frontY + 1) * ky)],
      },
      notes,
    };
  }

  const canvas =
    asset.kind === 'figure'
      ? { width: 720, height: 960, fitW: 660, fitH: 880, bottom: 40 }
      : asset.kind === 'emblem'
        ? { width: 512, height: 512, fitW: 472, fitH: 472 }
        : asset.small
          ? { width: 256, height: 256, fitW: 232, fitH: 232 }
          : { width: 512, height: 512, fitW: 448, fitH: 448 };
  const { image, widthLimited } = await onCanvas(c, canvas);
  if (asset.kind === 'figure' && widthLimited)
    notes.push('postava je moc široká, bude menší než ostatní');
  await webp(image).toFile(dest);
  return {
    entry: { kind: asset.kind, file: rel, width: canvas.width, height: canvas.height },
    notes,
  };
}

// ───────────── The ground ─────────────

/**
 * The grass texture, toned to the grass on the pieces' bases, so a base does not show as a
 * square on the ground around it. Made again from its original after every import.
 */
async function matchGrass(manifest) {
  const grass = manifest.assets['ground-grass'];
  const original = fs.existsSync(archive)
    ? fs.readdirSync(archive).find((f) => /^ground-grass\.(jpe?g|png|webp)$/i.test(f))
    : null;
  const pieces = ASSETS.filter(
    (a) =>
      a.kind === 'piece' && a.base === 'grass' && !a.id.startsWith('tree') && manifest.assets[a.id],
  );
  if (!grass || !original || pieces.length < 3) return;
  const mean = async (file, keep) => {
    const { data, info } = await sharp(file)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const sum = [0, 0, 0];
    let n = 0;
    for (let y = 0; y < info.height; y++)
      for (let x = 0; x < info.width; x++) {
        const i = (y * info.width + x) * 4;
        if (data[i + 3] < 250 || !keep(x, y)) continue;
        for (let c = 0; c < 3; c++) sum[c] += data[i + c];
        n++;
      }
    return n ? sum.map((v) => v / n) : null;
  };
  // a band just inside each base's front edges, near its side corners (open grass)
  const samples = [];
  for (const a of pieces) {
    const p = manifest.assets[a.id];
    const [ax, ay] = p.anchor;
    const half = p.width / 2;
    const m = await mean(path.join(out, p.file), (x, y) => {
      const dx = Math.abs(x - ax) / half;
      const dy = (ay - y) / (half / RATIO);
      return dx > 0.75 && dx < 0.9 && dy > 0.9 && dy < 1.1;
    });
    if (m) samples.push(m);
  }
  const target = [0, 1, 2].map((c) => samples.reduce((s, m) => s + m[c], 0) / samples.length);
  const source = path.join(archive, original);
  const texture = await sharp(source).resize(1024, 1024, { fit: 'cover' }).png().toBuffer();
  const now = await mean(texture, () => true);
  const gain = now.map((v, c) => Math.min(1.4, Math.max(0.75, target[c] / v)));
  await sharp(texture)
    .linear(gain, [0, 0, 0])
    .webp({ quality: 88 })
    .toFile(path.join(out, grass.file));
}

// ───────────── Previews ─────────────

/** Every city piece on a grid, as the app will place them, so one can see if they fit. */
async function cityPreview(manifest) {
  const pieces = Object.entries(manifest.assets)
    .filter(([, a]) => a.kind === 'piece')
    .sort(([ia, a], [ib, b]) => b.size - a.size || ia.localeCompare(ib));
  const file = path.join(kit, 'nahled-mesto.png');
  if (!pieces.length) return fs.rmSync(file, { force: true });

  const scale = 0.5;
  const TW = TILE * scale;
  const TH = TW / RATIO;
  const area = pieces.reduce((s, [, a]) => s + a.size * a.size, 0);
  let N = Math.max(6, Math.ceil(Math.sqrt(area * 1.5)));
  let placed;
  // greedy: the biggest first, row by row, a tile of grass between pieces when there is room
  for (;;) {
    const used = Array.from({ length: N }, () => new Array(N).fill(false));
    placed = [];
    const free = (i, j, s) => {
      if (i + s > N || j + s > N) return false;
      for (let a = i; a < i + s; a++) for (let b = j; b < j + s; b++) if (used[a][b]) return false;
      return true;
    };
    let ok = true;
    for (const [id, a] of pieces) {
      let spot = null;
      for (let j = 0; j <= N - a.size && !spot; j++)
        for (let i = 0; i <= N - a.size && !spot; i++) if (free(i, j, a.size)) spot = [i, j];
      if (!spot) {
        ok = false;
        break;
      }
      for (let x = spot[0]; x < spot[0] + a.size; x++)
        for (let y = spot[1]; y < spot[1] + a.size; y++) used[x][y] = true;
      placed.push({ id, a, i: spot[0], j: spot[1] });
    }
    if (ok) break;
    N++;
  }

  const thick = 16;
  const margin = 60;
  const ox = margin + (N * TW) / 2;
  const items = await Promise.all(
    placed.map(async (p) => {
      const w = Math.round(p.a.width * scale);
      const h = Math.round(p.a.height * scale);
      const input = await sharp(path.join(out, p.a.file)).resize(w, h).png().toBuffer();
      const s = p.a.size;
      const sx = ox + ((p.i - p.j) * TW) / 2;
      const sy = ((p.i + p.j + 2 * s) * TH) / 2;
      return {
        input,
        left: Math.round(sx - p.a.anchor[0] * scale),
        top: Math.round(sy - p.a.anchor[1] * scale),
        depth: p.i + p.j + 2 * s + (p.i + s) / 1000,
      };
    }),
  );
  const highest = Math.min(0, ...items.map((t) => t.top));
  const oy = margin - highest;
  const W = Math.round(N * TW + margin * 2);
  const H = Math.round(oy + N * TH + thick + margin);
  const g = (i, j) => [ox + ((i - j) * TW) / 2, oy + ((i + j) * TH) / 2];
  const pt = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  const [top, right, bottom, left] = [g(0, 0), g(N, 0), g(N, N), g(0, N)];
  const lines = [];
  for (let k = 1; k < N; k++) lines.push([g(k, 0), g(k, N)], [g(0, k), g(N, k)]);
  const board = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
<rect width="100%" height="100%" fill="#F2EBDB"/>
<polygon points="${pt(left)} ${pt(bottom)} ${pt([bottom[0], bottom[1] + thick])} ${pt([left[0], left[1] + thick])}" fill="#7A5A3A"/>
<polygon points="${pt(bottom)} ${pt(right)} ${pt([right[0], right[1] + thick])} ${pt([bottom[0], bottom[1] + thick])}" fill="#5E4329"/>
<polygon points="${pt(top)} ${pt(right)} ${pt(bottom)} ${pt(left)}" fill="#9AA15A"/>
${lines.map(([a, b]) => `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="#6F7840" stroke-opacity="0.5" stroke-width="1"/>`).join('\n')}
</svg>`;
  items.sort((a, b) => a.depth - b.depth);
  await sharp(Buffer.from(board))
    .composite(items.map(({ input, left: l, top: t }) => ({ input, left: l, top: t + oy })))
    .png()
    .toFile(file);
}

/** Each painted map with the real outline over it in red: it must match the painted border. */
async function mapPreview(manifest) {
  for (const id of Object.keys(MAPS)) {
    const file = path.join(kit, `nahled-${id}.png`);
    const a = manifest.assets[id];
    if (!a) {
      fs.rmSync(file, { force: true });
      continue;
    }
    await sharp(path.join(out, a.file))
      .composite([{ input: Buffer.from(mapSvg(id, { overlay: true })) }])
      .png()
      .toFile(file);
  }
}

/** Gladiators, gear, emblems, icons and ground, each with its id. */
async function otherPreview(manifest) {
  const file = path.join(kit, 'nahled-ostatni.png');
  const rows = ['gladiators', 'gear', 'leagues', 'icons', 'ground']
    .map((group) =>
      Object.entries(manifest.assets).filter(
        ([, a]) => a.kind !== 'piece' && a.file.startsWith(`${group}/`),
      ),
    )
    .filter((r) => r.length);
  if (!rows.length) return fs.rmSync(file, { force: true });
  const cell = 200;
  const perRow = 8;
  const lineH = (g) => (g[0][1].kind === 'figure' ? cell * 1.33 : cell) + 34;
  const blocks = rows.flatMap((r) =>
    Array.from({ length: Math.ceil(r.length / perRow) }, (_, k) =>
      r.slice(k * perRow, k * perRow + perRow),
    ),
  );
  const W = perRow * cell + 40;
  const H = blocks.reduce((s, b) => s + lineH(b), 0) + 40;
  const comps = [];
  const labels = [];
  let y = 20;
  for (const b of blocks) {
    const h = lineH(b) - 34;
    for (const [n, [id, a]] of b.entries()) {
      const x = 20 + n * cell;
      if (a.kind === 'ground') {
        const half = Math.round(cell / 2) - 4;
        const tile = await sharp(path.join(out, a.file)).resize(half, half).png().toBuffer();
        for (const [dx, dy] of [
          [0, 0],
          [half, 0],
          [0, half],
          [half, half],
        ])
          comps.push({ input: tile, left: x + 4 + dx, top: y + dy });
      } else {
        const input = await sharp(path.join(out, a.file))
          .resize(cell - 16, h - 8, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer();
        comps.push({ input, left: x + 8, top: y + 4 });
      }
      labels.push(
        `<text x="${x + cell / 2}" y="${y + h + 22}" font-family="Arial, sans-serif" font-size="15" fill="#3B2F22" text-anchor="middle">${id}</text>`,
      );
    }
    y += lineH(b);
  }
  const bg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#F2EBDB"/>${labels.join('')}</svg>`;
  await sharp(Buffer.from(bg)).composite(comps).png().toFile(file);
}

// ───────────── The app's list of pieces ─────────────

/** src/features/game/city/pieces.ts: every city piece with its plot, anchor and picture. */
function writeLinks(manifest) {
  if (out !== path.join(root, 'assets/game/painted')) return; // a trial run elsewhere
  const pic = (file) => `require('../../../../assets/game/painted/${file}')`;
  const pieces = Object.entries(manifest.assets).filter(([, a]) => a.kind === 'piece');
  const paving = manifest.assets['ground-paving'];
  const text = `/** Generated by \`npm run art\` from assets/game/painted/manifest.json. Do not edit by hand. */
import type { ImageSourcePropType } from 'react-native';

/** Width : height of a tile's diamond. */
export const CITY_RATIO = ${RATIO};
/** A tile's width in the pictures, in px. */
export const CITY_TILE = ${TILE};

export interface CityPicture {
  /** Plot size in tiles. */
  size: number;
  width: number;
  height: number;
  /** The plot's front corner in the picture, in px. */
  anchor: [number, number];
  image: ImageSourcePropType;
}

export const CITY_PIECES: Record<string, CityPicture> = {
${pieces
  .map(
    ([id, a]) =>
      `  '${id}': { size: ${a.size}, width: ${a.width}, height: ${a.height}, anchor: [${a.anchor[0]}, ${a.anchor[1]}], image: ${pic(a.file)} },`,
  )
  .join('\n')}
};

/** Cobbles for the streets (a seamless texture, seen from above). */
export const CITY_PAVING: ImageSourcePropType | null = ${paving ? pic(paving.file) : 'null'};
`;
  const dest = path.join(root, 'src/features/game/city/pieces.ts');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, text);
  writeArtLinks(manifest);
}

/**
 * The other painted pictures for the app (src/components/art/painted.ts): the gladiator classes,
 * the gear and icons, the league emblems, the maps with their frame, and the dressing-up layers.
 */
function writeArtLinks(manifest) {
  const pic = (file) => `require('../../../assets/game/painted/${file}')`;
  const of = (group) =>
    Object.entries(manifest.assets).filter(
      ([, a]) => a.file.startsWith(`${group}/`) && a.kind !== 'layer',
    );
  const map = (list, key = (id) => id) =>
    list.map(([id, a]) => `  '${key(id)}': ${pic(a.file)},`).join('\n');
  const dressDir = path.join(out, 'dress');
  const dress = fs.existsSync(dressDir)
    ? fs
        .readdirSync(dressDir)
        .filter((f) => f.endsWith('.webp'))
        .sort()
    : [];
  const maps = Object.entries(manifest.assets).filter(([, a]) => a.kind === 'map');
  const text = `/** Generated by \`npm run art\` from assets/game/painted/manifest.json. Do not edit by hand. */
import type { ImageSourcePropType } from 'react-native';

/** The gladiator classes: rank-<rank id> and style-<style id> (720 × 960, transparent). */
export const PAINTED_FIGURES: Record<string, ImageSourcePropType> = {
${map(of('gladiators'))}
};

/** Gear by its id in lib/game/gear.ts, and the icons (512 × 512, transparent). */
export const PAINTED_GEAR: Record<string, ImageSourcePropType> = {
${map(of('gear'))}
};
export const PAINTED_ICONS: Record<string, ImageSourcePropType> = {
${map(of('icons'), (id) => id.replace('icon-', ''))}
};

/** League emblems by league id (512 × 512, transparent). */
export const PAINTED_LEAGUES: Record<string, ImageSourcePropType> = {
${map(of('leagues'), (id) => id.replace('league-', ''))}
};

/** Painted maps and their frame in degrees, to put places on them by their coordinates. */
export const PAINTED_MAPS: Record<
  string,
  { image: ImageSourcePropType; width: number; height: number; geo: { west: number; east: number; south: number; north: number } }
> = {
${maps.map(([id, a]) => `  '${id}': { image: ${pic(a.file)}, width: ${a.width}, height: ${a.height}, geo: ${JSON.stringify(a.geo)} },`).join('\n')}
};

/** Dressing up: the base gladiator and every piece of gear cut out in the same frame (540 × 723). */
export const DRESS: Record<string, ImageSourcePropType> = {
${dress.map((f) => `  '${f.replace('.webp', '')}': ${pic(`dress/${f}`)},`).join('\n')}
};
export const DRESS_SIZE = { width: 540, height: 723 };
`;
  const dest = path.join(root, 'src/components/art/painted.ts');
  fs.writeFileSync(dest, text);
}

async function importInbox() {
  fs.mkdirSync(inbox, { recursive: true });
  const files = filesIn(inbox);
  if (!files.length) {
    console.log(
      `V ${path.relative(root, inbox)} nejsou žádné obrázky. Nejdřív je tam stáhni z Gemini.`,
    );
    return;
  }
  const manifest = readManifest();
  const queue = missing(manifest).map((a) => a.id);
  const rows = [];
  const plan = [];
  const taken = new Set();
  for (const f of files) {
    if (REJECTED.test(path.basename(f))) {
      rows.push([f, '(přeskočeno: označené jako špatné)']);
      continue;
    }
    const id = idOf(f);
    if (!id) continue;
    if (!queue.includes(id) && !args.includes('--replace')) {
      rows.push([f, `(přeskočeno: ${id} už obrázek má)`]);
      continue;
    }
    plan.push([f, id]);
    taken.add(id);
  }
  // Files still named by Gemini take what is left, in the batch order, by download time.
  const order = batchesOf(missing(manifest))
    .flatMap((b) => b.list.map((a) => a.id))
    .filter((id) => !taken.has(id));
  for (const f of files) {
    if (REJECTED.test(path.basename(f)) || idOf(f)) continue;
    // A short name ("rack.jpg", "temple.jpg"): the first picture still missing whose id starts
    // with it, in the batch order, which is the batch being made.
    const short = slug(path.basename(f).replace(/\.[^.]+$/, ''));
    const prefixed = order.find((id) => slug(id).startsWith(`${short}-`));
    if (short && prefixed) {
      order.splice(order.indexOf(prefixed), 1);
      plan.push([f, prefixed]);
      continue;
    }
    if (!UNNAMED.test(path.basename(f))) {
      rows.push([
        f,
        '(přeskočeno: žádný obrázek se tak nejmenuje; přejmenuj soubor na id z dávky)',
      ]);
      continue;
    }
    const id = order.shift();
    if (!id) {
      rows.push([f, '(přeskočeno: všechny obrázky už jsou hotové)']);
      continue;
    }
    plan.push([f, id]);
  }

  const byId = new Map(ASSETS.map((a) => [a.id, a]));
  fs.mkdirSync(archive, { recursive: true });
  let done = 0;
  for (const [f, id] of plan) {
    try {
      const { entry, notes } = await processOne(f, byId.get(id));
      manifest.assets[id] = { ...entry, rev: byId.get(id).rev ?? 1 };
      const ext = path.extname(f).toLowerCase();
      let target = path.join(archive, `${id}${ext}`);
      for (let n = 2; fs.existsSync(target); n++) target = path.join(archive, `${id} (${n})${ext}`);
      fs.renameSync(f, target);
      rows.push([f, `${id}${notes.length ? `   ⚠ ${notes.join('; ')}` : ''}`]);
      done++;
    } catch (e) {
      rows.push([f, `(chyba: ${e.message})`]);
    }
  }
  const sorted = Object.fromEntries(
    ASSETS.filter((a) => manifest.assets[a.id]).map((a) => [a.id, manifest.assets[a.id]]),
  );
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(
    manifestFile,
    `${JSON.stringify({ ratio: RATIO, tile: TILE, assets: sorted }, null, 1)}\n`,
  );

  for (const [f, what] of rows) console.log(`${path.relative(inbox, f)}  →  ${what}`);
  await matchGrass({ assets: sorted });
  await dressLayers();
  writeLinks({ assets: sorted });
  await cityPreview({ assets: sorted });
  await otherPreview({ assets: sorted });
  await mapPreview({ assets: sorted });
  const kitInfo = await writeKit({ assets: sorted });
  console.log(
    `\nNaimportováno ${done}. Zbývá ${kitInfo.todo} obrázků v ${kitInfo.batches} dávkách.` +
      `\nNáhledy: ${path.relative(root, path.join(kit, 'nahled-mesto.png'))}, ${path.relative(root, path.join(kit, 'nahled-ostatni.png'))}`,
  );
}

if (args.includes('--import')) await importInbox();
else if (args.includes('--previews')) {
  // the grass tone and both previews again, without importing anything
  const manifest = readManifest();
  await matchGrass(manifest);
  writeLinks(manifest);
  await cityPreview(manifest);
  await otherPreview(manifest);
  await mapPreview(manifest);
} else {
  writeLinks(readManifest());
  const info = await writeKit(readManifest());
  console.log(
    `Sada v ${path.relative(root, kit)}: ${info.todo} obrázků v ${info.batches} dávkách.`,
  );
}
