import { defaultPhases, phaseFor, phasedSets, resizePhases, rpeHint } from './periodization';

describe('periodization', () => {
  it('splits 8 weeks into Intro 1–2, Build 3–5, Push 6–7, Deload 8', () => {
    expect(defaultPhases(8).map((p) => [p.name, p.from, p.to])).toEqual([
      ['Intro', 1, 2],
      ['Build', 3, 5],
      ['Push', 6, 7],
      ['Deload', 8, 8],
    ]);
  });

  it('covers every week without gaps for other lengths', () => {
    for (const weeks of [4, 6, 10, 12, 16]) {
      const phases = defaultPhases(weeks);
      expect(phases[0].from).toBe(1);
      expect(phases[phases.length - 1].to).toBe(weeks);
      phases.slice(1).forEach((p, i) => expect(p.from).toBe(phases[i].to + 1));
    }
    expect(defaultPhases(3)).toHaveLength(1);
  });

  it('scales sets per phase, never below 1', () => {
    const phases = defaultPhases(8);
    expect(phasedSets(4, phaseFor(phases, 1))).toBe(3); // Intro 0.75
    expect(phasedSets(4, phaseFor(phases, 4))).toBe(4); // Build
    expect(phasedSets(3, phaseFor(phases, 6))).toBe(4); // Push 1.25
    expect(phasedSets(3, phaseFor(phases, 8))).toBe(2); // Deload 0.5
    expect(phasedSets(1, phaseFor(phases, 8))).toBe(1);
  });

  it('falls back to the last phase after the program and to plain sets without phases', () => {
    expect(phaseFor(defaultPhases(8), 12)?.name).toBe('Deload');
    expect(phasedSets(3, phaseFor([], 2))).toBe(3);
  });

  it('explains RPE', () => {
    expect(rpeHint(8)).toBe('about 2 reps left');
    expect(rpeHint(9)).toBe('about 1 rep left');
    expect(rpeHint(10)).toBe('to failure');
  });
});

describe('resizePhases', () => {
  it('moves the week ranges but keeps custom sets and RPE', () => {
    const custom = defaultPhases(8).map((p) =>
      p.name === 'Push' ? { ...p, sets: 1.5, rpe: 10 } : p,
    );
    const r = resizePhases(custom, 12);
    expect(r[r.length - 1].to).toBe(12);
    expect(r.find((p) => p.name === 'Push')).toMatchObject({ sets: 1.5, rpe: 10 });
  });
});
