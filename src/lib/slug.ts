/**
 * File name for an exercise image: "Farmer's carry" → "farmers-carry".
 * Must match slug() in scripts/exercise-images.mjs.
 */
export function exerciseSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
