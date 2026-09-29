import * as Crypto from 'expo-crypto';

/** Client-generated ids make offline writes safe to sync more than once. */
export function uuid(): string {
  return Crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
