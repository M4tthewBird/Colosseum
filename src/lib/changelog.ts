export interface Release {
  /** Unique, never changes once shipped. */
  id: string;
  /** YYYY-MM-DD */
  date: string;
  title: string;
  items: string[];
}

/**
 * What the device remembers after showing the changelog: the newest release and how many items
 * it had then ("2026-10-23#17"), so items added to it later show it again.
 */
export function seenMark(release: Release): string {
  return `${release.id}#${release.items.length}`;
}

/**
 * Releases the device has not shown yet, newest first, however many there are. A release counts
 * as unseen again when items were added to it since it was shown (a mark without a count, from
 * older versions, counts as none seen). With nothing remembered, `since` (YYYY-MM-DD, the last
 * day the user was around) picks every release from that day on; without it, only the newest.
 */
export function unseenReleases(
  changelog: Release[],
  seen: string | null,
  since: string | null = null,
): Release[] {
  if (!changelog.length) return [];
  const [id, count] = (seen ?? '').split('#');
  const i = seen ? changelog.findIndex((r) => r.id === id) : -1;
  if (i === -1) {
    const fromSince = since ? changelog.filter((r) => r.date >= since) : [];
    return fromSince.length ? fromSince : changelog.slice(0, 1);
  }
  const grown = changelog[i].items.length > Number(count ?? 0);
  return changelog.slice(0, grown ? i + 1 : i);
}
