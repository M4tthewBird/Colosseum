/* Colosseum service worker: lets the installed web app open and log workouts offline.
   Pages: network first (bypassing the browser's HTTP cache, so a new deploy shows on the next
   open), falling back to the cached app shell when offline.
   Static assets (hashed bundles, icons): cache first. Supabase calls are never cached. */
const CACHE = 'colosseum-v2';
const scope = self.registration.scope;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) =>
        c.addAll(
          [scope, `${scope}manifest.webmanifest`].map((u) => new Request(u, { cache: 'reload' })),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      // GitHub Pages lets browsers keep HTML for 10 minutes; always revalidate it.
      fetch(new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' }))
        .then((res) => {
          // A followed redirect (e.g. /workouts -> /workouts/) must be re-issued to the page.
          if (res.redirected) return Response.redirect(res.url, 302);
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match(scope))),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
