import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import sw from "../../../public/sw.js?raw";

/**
 * `public/sw.js` is plain worker script, not a module, so it cannot be imported
 * here. These checks assert the two properties whose absence broke offline use:
 * a navigation fallback to the cached shell, and never resolving `respondWith`
 * with `undefined`.
 */
describe("service worker offline navigation", () => {
  it("precaches the SPA shell and the catalog data, relative to its own script", () => {
    // No leading "/": this file is a raw public/ copy Vite never rewrites, so a
    // root-absolute path would point at the domain root instead of the actual
    // site root — "/" locally, "/APP-/" on GitHub Pages. Relative entries
    // resolve against the SW's own URL and work under either.
    for (const asset of ["./index.html", "./data/foods.json", "./data/recipes.json", "./data/routines.json"]) {
      expect(sw).toContain(asset);
    }
    expect(sw).not.toMatch(/["'](?:\/index\.html|\/data\/)/);
  });

  it("handles navigation requests separately from asset requests", () => {
    // Routes like /comida are never cached under their own URL, so a plain
    // cache-match strategy leaves an offline refresh with nothing to serve.
    expect(sw).toMatch(/request\.mode\s*===\s*"navigate"/);
  });

  it("falls back to the cached shell when a navigation cannot reach the network", () => {
    const navBlock = sw.slice(sw.indexOf('request.mode === "navigate"'), sw.indexOf("caches.match(event.request)"));
    expect(navBlock).toContain("catch");
    // Whitespace-insensitive: Prettier reflows this block freely.
    expect(navBlock.replace(/\s+/g, " ")).toMatch(/caches\s*\.match\("\.\/index\.html"\)/);
  });

  it("never resolves respondWith with undefined", () => {
    // `respondWith(undefined)` surfaces to the user as a network error even when
    // the only real problem is an empty cache.
    expect(sw).toContain("Response.error()");
    expect(sw).not.toMatch(/\.catch\(\(\)\s*=>\s*cached\)/);
  });

  it("deja el marcador que el build sustituye por los chunks con hash", () => {
    // Sin esto, el precache solo lleva rutas fijas y ningún chunk del build:
    // con autoCodeSplitting cada pantalla es el suyo, así que offline solo
    // funcionaba en la pantalla por la que hubieras pasado. El plugin
    // `brio-sw-precache` de vite.config.ts sustituye este marcador exacto al
    // escribir dist/, y si alguien lo reformatea deja de encontrarlo.
    expect(sw).toContain("/* __BRIO_BUILD_ASSETS__ */ []");
    expect(sw).toMatch(/\.\.\.BUILD_ASSETS|BUILD_ASSETS\]/);
  });

  it("solo borra sus propias cachés al activar", () => {
    // `caches.keys()` es por origen, no por scope: en github.io ese origen lo
    // comparten todos los project pages de la cuenta, así que sin el filtro
    // cada versión de Brío dejaba sin offline a las demás PWA del usuario.
    expect(sw).toMatch(/startsWith\("brio-"\)/);
  });

  it("cae al shell también cuando el servidor responde 404", () => {
    // Un 404 es un fetch que ha ido bien, así que el `.catch` no lo ve: sin
    // comprobar `res.ok` se pinta la página de error del servidor en vez de la
    // app en cualquier alojamiento sin fallback de SPA.
    const navBlock = sw.slice(sw.indexOf('request.mode === "navigate"'), sw.indexOf("caches.match(event.request)"));
    expect(navBlock.replace(/\s+/g, " ")).toMatch(/res\s*&&\s*res\.ok/);
  });

  it("resolves the notification fallback against the SW's own scope, not the domain root", () => {
    // A bare "/" default would open the site's domain root instead of
    // "/APP-/" on a GitHub Pages project-page deploy.
    expect(sw).toContain("self.registration.scope");
    expect(sw).not.toMatch(/notification\.data\.url\)\s*\|\|\s*"\/"/);
  });
});

describe("las rutas del precache existen de verdad", () => {
  // `cache.addAll` del shell es todo-o-nada: renombrar un icono o una fuente
  // sin tocar sw.js hacía fallar el install, y entonces ningún worker nuevo
  // llegaba a activar — quien tuviera la PWA instalada se quedaba con la
  // versión vieja indefinidamente. Nada en CI lo detectaba.
  const listed = [...sw.matchAll(/"\.\/([^"]+)"/g)]
    .map((m) => m[1])
    .filter((p) => p && !p.startsWith("assets/") && p !== "index.html" && p.includes("."));

  it("lista algo que comprobar", () => {
    expect(listed.length).toBeGreaterThan(5);
  });

  it.each([...new Set(listed)])("public/%s existe", (rel) => {
    expect(existsSync(join(process.cwd(), "public", rel))).toBe(true);
  });
});
