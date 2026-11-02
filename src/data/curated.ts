/** The curated part of the catalog (core lifts and tier picks), by name. */
import catalog from './exercises.json';

export const CURATED_EXERCISES = new Set(
  (catalog as { name: string; core?: boolean }[]).filter((e) => e.core).map((e) => e.name),
);
