const CACHE = "brio-v4.7";
// Deployment-agnostic on purpose: this file is a raw public/ asset, so Vite
// never rewrites it. Every entry is relative (no leading "/"), which the Cache
// API resolves against this script's own URL — the site root whether that is
// "/" (local, a custom domain) or "/APP-/" (GitHub Pages project site).
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./favicon.svg",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png",
  "./fonts/outfit-latin-wght.woff2",
  "./fonts/fraunces-latin-opsz-wght.woff2",
  "./data/foods.json",
  "./data/recipes.json",
  "./data/routines.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // SPA routes (/comida, /tendencias…) are not cached under their own URL, so
  // offline navigations must fall back to the cached shell. Without this a
  // refresh — or a tap on a meal reminder, which deep-links to /comida — lands
  // on the browser's network-error page.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches
          .match("./index.html")
          .then((shell) => shell || caches.match("./"))
          .then((shell) => shell || Response.error()),
      ),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetched = fetch(event.request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            // Swallowed on purpose: a failed write (quota, a partial 206, a
            // storage-partitioned context) must not surface as an unhandled
            // rejection in the worker — the response itself is already fine.
            caches
              .open(CACHE)
              .then((cache) => cache.put(event.request, copy))
              .catch(() => {});
          }
          return res;
        })
        // Never resolve to undefined: respondWith(undefined) surfaces as a
        // network error even when we simply have nothing cached.
        .catch(() => cached || Response.error());
      return cached || fetched;
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // The app supplies a full deployed path (reminders-boot.tsx bakes BASE_URL
  // in); this scope fallback is only for the rare case it did not.
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      for (const c of clientsArr) {
        if ("focus" in c) {
          if ("navigate" in c) c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
