import { useBadgeSync, useMyBadges } from './hooks';

/** Keeps user_badges up to date with what the history has earned. Rendered on Today. */
export function BadgeSync() {
  useBadgeSync(useMyBadges());
  return null;
}
