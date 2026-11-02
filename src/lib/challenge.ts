/** Which exercises a gym challenge counts. Pure — see challenge.test.ts. */
import { movementOf } from './generator';
import type { Exercise } from './types';

/** Movements people think of as one thing: a pull-up challenge should count chin-ups. */
const FAMILIES = [['pull up', 'chin up']];

const familyOf = (name: string) => {
  const movement = movementOf(name);
  return FAMILIES.find((f) => f.includes(movement)) ?? [movement];
};

const MAX_SUGGESTED = 6;

/**
 * Well-known variations of the chosen exercises to offer as well. Only the curated part of the
 * catalog and rated exercises: the rest is too obscure to offer unasked.
 */
export function challengeVariants(
  chosen: Exercise[],
  all: Exercise[],
  curated: Set<string>,
): Exercise[] {
  if (chosen.length === 0) return [];
  const ids = new Set(chosen.map((e) => e.id));
  const families = chosen.flatMap((e) => familyOf(e.name));
  return all
    .filter(
      (e) =>
        !ids.has(e.id) &&
        !e.created_by &&
        (e.tier || curated.has(e.name)) &&
        families.includes(movementOf(e.name)),
    )
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, MAX_SUGGESTED);
}

/** "Pull Up, Chin Up and 2 more". */
export function challengeExercisesText(names: string[]): string {
  if (names.length <= 3) return names.join(', ');
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
}
