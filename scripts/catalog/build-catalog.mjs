/**
 * Builds the built-in exercise catalog.
 *
 *   node scripts/catalog/build-catalog.mjs
 *
 * Inputs
 * - curated-old.json: Colosseum's own list (core lifts + Jeff Nippard's S/A/B tier picks),
 *   with the names they had before the naming cleanup.
 * - dataset.json: exercise names and muscles from hasaneyldrm/exercises-dataset (MIT, see
 *   THIRD_PARTY_NOTICES.md). Only names and muscles are used; its media is not (© Gym visual).
 *
 * Outputs
 * - src/data/exercises.json            demo-mode catalog
 * - supabase/seed.sql                  fresh projects
 * - supabase/updates/2026-10-04-exercise-catalog.sql   existing projects (renames keep ids)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { cleanName, key } from './names.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(here, p), 'utf8'));

// Jeff Nippard tier per curated exercise (S+ and S → S, A+ and A → A). Best tier wins.
const TIERS = {
  S: [
    'Cable lateral raise',
    'Cable Y-raise',
    'Behind-the-back cuffed cable lateral raise',
    'Reverse pec deck',
    'Reverse cable crossover',
    'Hack squat',
    'Squat',
    'Pendulum squat',
    'Smith machine squat',
    'Bulgarian split squat',
    'Machine chest press',
    'Seated cable pec fly',
    'Lat pulldown',
    'Neutral-grip lat pulldown',
    'One-arm lat pulldown',
    'Meadows row',
    'Chest-supported row',
    'Seated cable row',
    'Wide-grip cable row',
    'Overhead cable triceps extension',
    'Skull crusher',
    'Bayesian cable curl',
    'Dumbbell preacher curl',
    'Machine preacher curl',
    'Preacher hammer curl',
    'Walking lunge',
    'Machine hip abduction',
    '45-degree back extension',
    'Front-foot-elevated Smith machine lunge',
  ],
  A: [
    'Machine shoulder press',
    'Standing machine lateral raise',
    'Lean-in dumbbell lateral raise',
    'Face pull',
    'Dumbbell shoulder press',
    'Side-lying dumbbell lateral raise',
    'Front squat',
    'Low-bar squat',
    'Leg press',
    'Leg extension',
    'Reverse Nordic',
    'Bench press',
    'Incline bench press',
    'Dumbbell bench press',
    'Incline dumbbell press',
    'Dips',
    'Deficit push-up',
    'Dumbbell guillotine press',
    'Smith machine bench press',
    'Incline Smith machine bench press',
    'Cable crossover',
    'Pec deck',
    'Dumbbell fly',
    'Cable press-around',
    'Pull-up',
    'Neutral-grip pull-up',
    'Cross-body one-arm lat pulldown',
    'Deficit Pendlay row',
    'Dumbbell row',
    'Kroc row',
    'Cable lat prayer',
    'Dumbbell pullover',
    'Triceps pushdown',
    'Katana cable triceps extension',
    'One-arm dumbbell overhead extension',
    'Dumbbell skull crusher',
    'Smith machine JM press',
    'Cable triceps kickback',
    'Close-grip bench press',
    'EZ-bar curl',
    'Biceps curl',
    'Incline dumbbell curl',
    'Lying dumbbell curl',
    'Cable curl',
    'Hammer curl',
    'Inverse Zottman curl',
    'Machine hip thrust',
    'Single-leg dumbbell hip thrust',
    'Cable glute kickback',
    'Step-up',
    'Smith machine lunge',
    'Romanian deadlift',
  ],
  B: [
    'Overhead press',
    'Lateral raise',
    'Bent-over reverse dumbbell fly',
    'Seated machine lateral raise',
    'Lean-away dumbbell lateral raise',
    'Super-ROM dumbbell lateral raise',
    'Seated barbell overhead press',
    'Upright row',
    'Lunge',
    'Goblet squat',
    'Sissy squat',
    'Decline bench press',
    'Decline dumbbell press',
    'Banded push-up',
    'Chin-up',
    'Barbell row',
    'Pendlay row',
    'Rope triceps pushdown',
    'Dumbbell French press',
    'JM press',
    'Machine dips',
    'Diamond push-up',
    'Barbell curl',
    'Flat bench dumbbell curl',
    'Hip thrust',
    'Glute bridge',
    'Cable hip abduction',
    'Curtsy lunge',
    'Deadlift',
    'Sumo deadlift',
    'Cable pull-through',
  ],
};

const MUSCLE = {
  pectorals: 'chest',
  delts: 'shoulders',
  deltoids: 'shoulders',
  lats: 'back',
  'latissimus dorsi': 'back',
  spine: 'lower back',
  abs: 'core',
  abdominals: 'core',
  'lower abs': 'core',
  obliques: 'core',
  'cardiovascular system': 'cardio',
  'serratus anterior': 'chest',
  'levator scapulae': 'neck',
  sternocleidomastoid: 'neck',
  trapezius: 'traps',
  quadriceps: 'quads',
  'inner thighs': 'adductors',
  groin: 'adductors',
  'rear deltoids': 'rear delts',
  rhomboids: 'upper back',
  'rotator cuff': 'shoulders',
  brachialis: 'biceps',
  wrists: 'forearms',
  'wrist flexors': 'forearms',
  'wrist extensors': 'forearms',
  'grip muscles': 'forearms',
  hands: 'forearms',
  soleus: 'calves',
  ankles: 'calves',
  feet: 'calves',
  shins: 'calves',
  'ankle stabilizers': 'calves',
};
const mapMuscle = (m) => MUSCLE[m.toLowerCase()] ?? m.toLowerCase();

// Dataset names that are the same lift as a curated one.
const ALIASES = {
  'barbell full squat': 'Squat',
  'barbell squat': 'Squat',
  'barbell high bar squat': 'Squat',
  'barbell low bar squat': 'Low Bar Squat',
  'barbell bench press': 'Bench Press',
  'barbell incline bench press': 'Incline Bench Press',
  'barbell decline bench press': 'Decline Bench Press',
  'barbell close grip bench press': 'Close Grip Bench Press',
  'barbell deadlift': 'Deadlift',
  'barbell romanian deadlift': 'Romanian Deadlift',
  'barbell sumo deadlift': 'Sumo Deadlift',
  'barbell front squat': 'Front Squat',
  'barbell bent over row': 'Barbell Row',
  'barbell pendlay row': 'Pendlay Row',
  'barbell standing military press': 'Overhead Press',
  'barbell seated overhead press': 'Seated Barbell Overhead Press',
  'barbell upright row': 'Upright Row',
  'barbell curl': 'Barbell Curl',
  'barbell preacher curl': 'Preacher Curl',
  'barbell lying triceps extension skull crusher': 'Skull Crusher',
  'barbell good morning': 'Good Morning',
  'barbell shrug': 'Shrug',
  'barbell hip thrust': 'Hip Thrust',
  'barbell glute bridge': 'Glute Bridge',
  'barbell jm bench press': 'JM Press',
  'barbell lunge': 'Lunge',
  'barbell hack squat': 'Hack Squat',
  'dumbbell bench press': 'Dumbbell Bench Press',
  'dumbbell incline bench press': 'Incline Dumbbell Press',
  'dumbbell decline bench press': 'Decline Dumbbell Press',
  'dumbbell fly': 'Dumbbell Fly',
  'dumbbell seated shoulder press': 'Dumbbell Shoulder Press',
  'dumbbell lateral raise': 'Lateral Raise',
  'dumbbell biceps curl': 'Biceps Curl',
  'dumbbell hammer curl': 'Hammer Curl',
  'dumbbell incline curl': 'Incline Dumbbell Curl',
  'dumbbell bent over row': 'Dumbbell Row',
  'dumbbell one arm bent over row': 'Dumbbell Row',
  'dumbbell goblet squat': 'Goblet Squat',
  'dumbbell step up': 'Step Up',
  'dumbbell walking lunge': 'Walking Lunge',
  'dumbbell lunge': 'Lunge',
  'dumbbell single leg split squat': 'Bulgarian Split Squat',
  'dumbbell arnold press': 'Arnold Press',
  'dumbbell pullover': 'Dumbbell Pullover',
  'dumbbell shrug': 'Shrug',
  'dumbbell preacher curl': 'Dumbbell Preacher Curl',
  'dumbbell lying triceps extension': 'Dumbbell Skull Crusher',
  'dumbbell rear fly': 'Bent Over Reverse Dumbbell Fly',
  'cable pulldown': 'Lat Pulldown',
  'cable bar lateral pulldown': 'Lat Pulldown',
  'cable seated row': 'Seated Cable Row',
  'cable pushdown': 'Triceps Pushdown',
  'cable triceps pushdown v bar': 'Triceps Pushdown',
  'cable pushdown with rope attachment': 'Rope Triceps Pushdown',
  'cable curl': 'Cable Curl',
  'cable lateral raise': 'Cable Lateral Raise',
  'cable one arm lateral raise': 'Cable Lateral Raise',
  'cable cross over variation': 'Cable Crossover',
  'cable standing fly': 'Cable Fly',
  'cable rear delt row with rope': 'Face Pull',
  'cable kneeling crunch': 'Cable Crunch',
  'cable pull through with rope': 'Cable Pull Through',
  'cable kickback': 'Cable Triceps Kickback',
  'lever seated leg curl': 'Leg Curl',
  'lever leg extension': 'Leg Extension',
  'lever seated hip abduction': 'Machine Hip Abduction',
  'lever chest press': 'Machine Chest Press',
  'lever shoulder press': 'Machine Shoulder Press',
  'lever seated fly': 'Pec Deck',
  'lever pec deck fly': 'Pec Deck',
  'lever seated reverse fly': 'Reverse Pec Deck',
  'lever preacher curl': 'Machine Preacher Curl',
  'lever triceps dip': 'Machine Dips',
  'lever standing calf raise': 'Calf Raise',
  'sled 45 degree leg press': 'Leg Press',
  'smith squat': 'Smith Machine Squat',
  'smith bench press': 'Smith Machine Bench Press',
  'smith incline bench press': 'Incline Smith Machine Bench Press',
  'pull up': 'Pull Up',
  'chin up': 'Chin Up',
  'push up': 'Push Up',
  'chest dip': 'Dips',
  'triceps dip': 'Dips',
  'diamond push up': 'Diamond Push Up',
  'hanging leg raise': 'Hanging Leg Raise',
  'front plank': 'Plank',
  'ez barbell curl': 'EZ Bar Curl',
  'ez bar curl': 'EZ Bar Curl',
  'farmers walk': 'Farmers Carry',
  'sissy squat': 'Sissy Squat',
  'weighted front plank': 'Plank',
};
const EQUIPMENT_PREFIX = /^barbell /; // "Barbell Squat" is "Squat"; other equipment makes a different exercise

// ---------------------------------------------------------------- curated
const tierOf = new Map();
for (const t of ['B', 'A', 'S']) for (const n of TIERS[t]) tierOf.set(n.toLowerCase(), t);

const curatedOld = read('curated-old.json');
const curated = curatedOld.map((e) => ({
  name: cleanName(e.old),
  old: e.old,
  muscles: e.muscles,
  tier: tierOf.get(e.old.toLowerCase()) ?? null,
  core: true,
}));
for (const n of Object.values(TIERS).flat())
  if (!curatedOld.some((e) => e.old.toLowerCase() === n.toLowerCase()))
    throw new Error(`tier name not in catalog: ${n}`);

const byKey = new Map(curated.map((e) => [key(e.name), e]));
const aliasTargets = new Set(Object.values(ALIASES).map(key));
for (const k of aliasTargets) if (!byKey.has(k)) throw new Error(`alias target not curated: ${k}`);

// ---------------------------------------------------------------- dataset
const dataset = read('dataset.json');
const added = [];
const merged = [];
for (const e of dataset) {
  const name = cleanName(e.name);
  const k = key(name);
  if (!name || name.length < 3) continue;
  const stripped = k.replace(EQUIPMENT_PREFIX, '');
  const alias = ALIASES[k];
  if (alias || byKey.has(k) || byKey.has(stripped)) {
    merged.push(`${e.name}  ->  ${alias ?? (byKey.get(k) ?? byKey.get(stripped)).name}`);
    continue;
  }
  const muscles = [
    ...new Set([e.target, ...(e.secondary ?? [])].filter(Boolean).map(mapMuscle)),
  ].slice(0, 3);
  const entry = { name, muscles, tier: null, core: false };
  byKey.set(k, entry);
  added.push(entry);
}

const catalog = [...curated, ...added.sort((a, b) => a.name.localeCompare(b.name))];

// ---------------------------------------------------------------- outputs
const sq = (s) => `'${s.replace(/'/g, "''")}'`;
const row = (e) =>
  `  (${sq(e.name)}, '{${e.muscles.join(',')}}', ${e.tier ? sq(e.tier) : 'null'}, ${e.name === 'Bench Press' ? "'bench-press'" : 'null'})`;

fs.writeFileSync(
  path.join(root, 'src/data/exercises.json'),
  JSON.stringify(
    catalog.map(({ name, muscles, tier, core }) => ({
      name,
      muscles,
      tier,
      ...(core ? { core } : null),
    })),
  ),
);

fs.writeFileSync(
  path.join(root, 'supabase/seed.sql'),
  `-- Built-in exercises (created_by = null). Run after schema.sql. Generated by
-- scripts/catalog/build-catalog.mjs: Colosseum's own list with Jeff Nippard tiers, plus names and
-- muscles from hasaneyldrm/exercises-dataset (MIT). Safe to run again: existing names are skipped.
insert into public.exercises (name, muscles, tier, image_key)
select v.name, v.muscles::text[], v.tier, v.image_key
from (values
${catalog.map(row).join(',\n')}
) as v(name, muscles, tier, image_key)
where not exists (
  select 1 from public.exercises e where e.created_by is null and lower(e.name) = lower(v.name)
);
`,
);

const renames = curated.filter((e) => e.old !== e.name);
fs.writeFileSync(
  path.join(root, 'supabase/updates/2026-10-04-exercise-catalog.sql'),
  `-- Run once in the SQL editor. Bigger exercise catalog with one naming style and Nippard tiers.
-- Existing exercises are renamed in place (same ids), so programs and history are kept.

alter table public.exercises add column if not exists tier text check (tier in ('S','A','B'));

-- One naming style: Title Case, no hyphens or apostrophes.
${curated.map((e) => `update public.exercises set name = ${sq(e.name)} where created_by is null and name = ${sq(e.old)};`).join('\n')}

-- Tiers (Jeff Nippard's tier lists).
${curated
  .filter((e) => e.tier)
  .map(
    (e) =>
      `update public.exercises set tier = '${e.tier}' where created_by is null and name = ${sq(e.name)};`,
  )
  .join('\n')}

-- New exercises.
insert into public.exercises (name, muscles, tier)
select v.name, v.muscles::text[], v.tier
from (values
${added.map((e) => `  (${sq(e.name)}, '{${e.muscles.join(',')}}', null)`).join(',\n')}
) as v(name, muscles, tier)
where not exists (
  select 1 from public.exercises e where e.created_by is null and lower(e.name) = lower(v.name)
);
`,
);

// Pose prompts follow the new names.
const posesPath = path.join(root, 'scripts/exercise-poses.json');
const poses = JSON.parse(fs.readFileSync(posesPath, 'utf8'));
const renamed = Object.fromEntries(Object.entries(poses).map(([k, v]) => [cleanName(k), v]));
fs.writeFileSync(posesPath, JSON.stringify(renamed, null, 2) + '\n');

fs.writeFileSync(path.join(here, 'merged.txt'), merged.join('\n') + '\n');
console.log(
  `catalog: ${catalog.length} (${curated.length} curated, ${curated.filter((e) => e.tier).length} with a tier, ${added.length} from the dataset; ${merged.length} dataset entries merged into curated ones, see merged.txt); ${renames.length} renames`,
);
