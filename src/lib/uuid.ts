import * as Crypto from 'expo-crypto';

/** Client-generated ids make offline writes safe to sync more than once. */
export function uuid(): string {
  return Crypto.randomUUID();
}

/**
 * The same uuid-shaped id for the same label on every device (FNV-1a), for rows that must be one
 * per key, e.g. one exercise setting per user and exercise.
 */
export function stableUuid(label: string): string {
  let h = 0x811c9dc5;
  const parts: string[] = [];
  for (let round = 0; round < 4; round++) {
    for (const ch of `${round}:${label}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
    parts.push(h.toString(16).padStart(8, '0'));
  }
  const hex = parts.join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
