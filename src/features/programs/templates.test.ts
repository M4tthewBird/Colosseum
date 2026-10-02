import fs from 'node:fs';
import path from 'node:path';

import { setsPerWeek, TEMPLATES, templateExerciseNames } from './templates';

jest.mock('@/lib/uuid', () => ({ uuid: () => 'id', nowIso: () => '' }));

const seed = fs.readFileSync(path.join(__dirname, '../../../supabase/seed.sql'), 'utf8');
const catalog = new Set(
  [...seed.matchAll(/^\s+\('((?:[^']|'')+)', '\{/gm)].map((m) =>
    m[1].replace(/''/g, "'").toLowerCase(),
  ),
);

describe('program templates', () => {
  it('only use exercises from the built-in catalog', () => {
    const missing = templateExerciseNames().filter((n) => !catalog.has(n.toLowerCase()));
    expect(missing).toEqual([]);
  });

  it('assign every training day to exactly one workout day', () => {
    for (const t of TEMPLATES) {
      const assigned = t.days.flatMap((d) => d.weekdays).sort();
      expect(assigned).toEqual([...t.trainingDays].sort());
    }
  });

  it('stay in a sensible weekly volume', () => {
    for (const t of TEMPLATES) {
      const sets = setsPerWeek(t);
      expect(sets).toBeGreaterThanOrEqual(t.key === 'arms-shoulders' ? 20 : 40);
      expect(sets).toBeLessThanOrEqual(130);
    }
  });
});
