import { describe, expect, it } from "vitest";
import sw from "../../../public/sw.js?raw";

/**
 * `public/sw.js` is plain worker script, not a module, so it cannot be imported
 * here. These checks assert the two properties whose absence broke offline use:
 * a navigation fallback to the cached shell, and never resolving `respondWith`
 * with `undefined`.
 */
describe("service worker offline navigation", () => {
  it("precaches the SPA shell and the catalog data", () => {
    for (const asset of ["/index.html", "/data/foods.json", "/data/recipes.json", "/data/routines.json"]) {
      expect(sw).toContain(asset);
    }
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
    expect(navBlock.replace(/\s+/g, " ")).toMatch(/caches\s*\.match\("\/index\.html"\)/);
  });

  it("never resolves respondWith with undefined", () => {
    // `respondWith(undefined)` surfaces to the user as a network error even when
    // the only real problem is an empty cache.
    expect(sw).toContain("Response.error()");
    expect(sw).not.toMatch(/\.catch\(\(\)\s*=>\s*cached\)/);
  });
});
