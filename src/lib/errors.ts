/**
 * True for errors that mean the request never reached the server (Chrome "Failed to fetch",
 * Safari "Load failed", React Native "Network request failed", timeouts).
 */
export function isNetworkError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /failed to fetch|network ?(request failed|error)|load failed|timed? ?out/i.test(msg);
}
