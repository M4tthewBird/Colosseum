export interface Release {
  /** Unique, never changes once shipped. */
  id: string;
  /** YYYY-MM-DD */
  date: string;
  title: string;
  items: string[];
}

/**
 * Releases the device has not shown yet (newest first). With nothing remembered, or an id that
 * is no longer in the list, only the newest release counts as unseen.
 */
export function unseenReleases(
  changelog: Release[],
  lastSeen: string | null,
  max = 3,
): Release[] {
  if (!changelog.length) return [];
  const i = lastSeen ? changelog.findIndex((r) => r.id === lastSeen) : -1;
  if (i === -1) return changelog.slice(0, 1);
  return changelog.slice(0, Math.min(i, max));
}
