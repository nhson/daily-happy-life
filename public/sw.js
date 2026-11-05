/*
 * daily-happy-life service worker.
 * - Today opens offline: pages are network-first, the last good copy is kept; static assets are
 *   cache-first (their names change with every build).
 * - The daily reminder: a push shows the day's Compass line; tapping it opens Today.
 * Nothing is synced offline: capture keeps its draft on the device instead (SPEC Slice 9).
 */
const VERSION = "v1";
const PAGES = `pages-${VERSION}`;
const ASSETS = `assets-${VERSION}`;

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(PAGES).then((c) => c.add("/today").catch(() => {})));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== PAGES && key !== ASSETS) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(ASSETS).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        const c = await caches.open(PAGES);
        try {
          const res = await fetch(req);
          // Only real pages: not a redirect to sign-in, not an error.
          if (res.ok && !res.redirected && !url.pathname.startsWith("/sign-in")) c.put(url.pathname, res.clone());
          return res;
        } catch {
          return (await c.match(url.pathname)) || (await c.match("/today")) || Response.error();
        }
      })(),
    );
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title || "daily-happy-life", {
      body: data.body || "",
      tag: data.tag || "daily-reminder",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/today" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/today";
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of wins) {
        if ("focus" in w) {
          await w.navigate(target).catch(() => {});
          return w.focus();
        }
      }
      return self.clients.openWindow(target);
    })(),
  );
});
