/* Viketa service worker — KILL SWITCH.
 *
 * The previous service worker was caching the app shell aggressively, so
 * users kept seeing stale UI even after we shipped updates. This file
 * replaces it. On install it activates immediately, deletes every cache
 * it can find, reloads any open tabs onto fresh HTML, then unregisters
 * itself. Once every device has run it at least once, this file can be
 * deleted entirely.
 */

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await self.clients.claim();

    // Nuke every cache this origin has.
    try {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    } catch {}

    // Force-reload every open tab so the user sees fresh HTML/JS.
    try {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      await Promise.all(wins.map((c) => {
        try {
          const u = new URL(c.url);
          u.searchParams.set('sw-cleanup', Date.now().toString());
          return c.navigate(u.toString());
        } catch {
          return null;
        }
      }));
    } catch {}

    // Remove ourselves so the SW never runs again.
    try {
      await self.registration.unregister();
    } catch {}
  })());
});

// Pass-through everything to the network — never serve from cache.
self.addEventListener('fetch', () => {});
