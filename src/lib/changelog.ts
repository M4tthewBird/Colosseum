/** Big features with a live preview and a "Show me" (see features/onboarding/Highlights.tsx). */
export type FeatureId = 'badges' | 'friend-qr' | 'favorites';

/** A big new feature, shown as its own card above the release's list. */
export interface Highlight {
  feature: FeatureId;
  title: string;
  /** One or two sentences: what it does for you. */
  body: string;
  /** Where it lives, e.g. "Profile → Badges". */
  where: string;
}

export interface Release {
  /** Unique, never changes once shipped. */
  id: string;
  /** YYYY-MM-DD */
  date: string;
  title: string;
  /** Big features only; small ones stay in `items`. */
  highlights?: Highlight[];
  items: string[];
}

/**
 * What the device remembers after showing the changelog: the newest release and how many items
 * it had then ("2026-10-23#17"), so items added to it later show it again.
 */
export function seenMark(release: Release): string {
  return `${release.id}#${size(release)}`;
}

/** Items and highlights together: adding either shows a seen release again. */
const size = (r: Release) => r.items.length + (r.highlights?.length ?? 0);

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
  const grown = size(changelog[i]) > Number(count ?? 0);
  return changelog.slice(0, grown ? i + 1 : i);
}
