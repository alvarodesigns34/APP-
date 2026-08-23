const CACHE = "brio-v4.7";
// Deployment-agnostic on purpose: this file is a raw public/ asset, so Vite
// never rewrites it. Every entry is relative (no leading "/"), which the Cache
// API resolves against this script's own URL — the site root whether that is
// "/" (local, a custom domain) or "/APP-/" (GitHub Pages project site).
// Sin el shell no hay app: si alguna de estas falla, el worker no debe instalar.
const SHELL = ["./", "./index.html"];

const PRECACHE = [
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

// Los chunks con hash de este build. El plugin `brio-sw-precache` de
// vite.config.ts sustituye este marcador al escribir dist/, así que en
// desarrollo queda vacío (donde no hay build que cachear) y en producción trae
// el shell de las cinco pantallas. Sin esto, offline solo funcionaba en la
// pantalla por la que hubieras pasado antes de quedarte sin red.
const BUILD_ASSETS = /* __BRIO_BUILD_ASSETS__ */ [];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(async (cache) => {
        // El shell es obligatorio; lo demás, mejor esfuerzo. Antes todo iba en
        // un único `addAll`, que es todo o nada: renombrar un icono o una
        // fuente sin tocar esta lista hacía fallar el install, y entonces
        // ningún worker nuevo llegaba a activar nunca — los que ya tuvieran la
        // PWA instalada se quedaban con la versión vieja indefinidamente.
        await cache.addAll(SHELL);
        await Promise.allSettled([...PRECACHE, ...BUILD_ASSETS].map((url) => cache.add(url)));
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      // Solo las nuestras. `caches.keys()` es por origen, no por scope, y en
      // github.io ese origen lo comparten todos los project pages de la misma
      // cuenta: sin el filtro, cada versión de Brío borraba la caché de las
      // otras PWA del usuario y las dejaba sin modo offline.
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("brio-") && k !== CACHE).map((k) => caches.delete(k))))
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
    const shell = () =>
      caches
        .match("./index.html")
        .then((res) => res || caches.match("./"))
        .then((res) => res || Response.error());
    event.respondWith(
      fetch(event.request)
        // Un 404 es un fetch que ha ido bien, así que el `.catch` no lo veía y
        // se pintaba la página de error del servidor en vez de la app. Pasa
        // siempre que el alojamiento no tenga fallback de SPA configurado, y
        // en Pages basta con que falte el 404.html para que refrescar en
        // /comida saque el 404 genérico de GitHub.
        .then((res) => (res && res.ok ? res : shell()))
        .catch(() => shell()),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      // Los assets del build llevan el hash del contenido en el nombre, así que
      // ese nombre no puede servir nunca otra cosa. Revalidarlos duplicaba una
      // petición por asset y por carga sin poder aprender nada. El resto sigue
      // en stale-while-revalidate: es lo que hace que data/foods.json se quede
      // rancio una sola carga tras publicar, en vez de para siempre.
      if (cached && url.pathname.includes("/assets/")) return cached;
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
