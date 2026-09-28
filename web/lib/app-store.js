// Dicta's App Store listing. Pages offer the app only once Apple has published it:
// until then Apple's lookup answers resultCount 0.
export const APP_ID = '6816172939';
export const APP_STORE_URL = `https://apps.apple.com/app/id${APP_ID}`;

// Checked at most every 10 minutes (the lookup allows about 20 calls a minute), then
// daily once the app is out. Exported so tests can start over.
export const listing = { live: false, checkedAt: 0 };

export async function isOnAppStore(now = Date.now()) {
  if (now - listing.checkedAt < (listing.live ? 86_400_000 : 600_000)) return listing.live;
  try {
    const res = await fetch(`https://itunes.apple.com/lookup?id=${APP_ID}`, { signal: AbortSignal.timeout(1500) });
    if (res.ok) listing.live = (await res.json()).resultCount > 0;
  } catch {
    // Slow or unreachable: keep what we knew.
  }
  listing.checkedAt = now;
  return listing.live;
}
