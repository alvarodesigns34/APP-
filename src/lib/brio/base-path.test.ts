import { describe, expect, it } from "vitest";

/**
 * GitHub Pages serves this repo at /APP-/, not the domain root. A hardcoded
 * "/x" reference resolves against the origin and 404s under that subpath —
 * this was caught by hand (build with GH_PAGES=true, serve dist/ under
 * /APP-/, click through in a real browser) before these were added, so they
 * exist to keep the regression from coming back silently.
 */
describe("runtime code has no root-absolute static paths", () => {
  it("main.tsx builds the service worker URL from BASE_URL", async () => {
    const src = await import("../../main.tsx?raw").then((m) => m.default as unknown as string);
    expect(src).not.toContain('register("/sw.js")');
    expect(src).toContain("import.meta.env.BASE_URL");
  });

  it("catalog.ts builds the data URLs from BASE_URL", async () => {
    const src = await import("./catalog.ts?raw").then((m) => m.default as unknown as string);
    // Matches an actual fetch literal like "/data/foods.json"; a code comment
    // mentioning "/data/…" for context does not trip this.
    expect(src).not.toMatch(/["'`]\/data\/[a-z]+\.json["'`]/);
    expect(src).toContain("import.meta.env.BASE_URL");
  });

  it("reminders-boot.tsx bakes BASE_URL into the notification icon and deep link", async () => {
    const src = await import("../../components/brio/reminders-boot.tsx?raw").then(
      (m) => m.default as unknown as string,
    );
    expect(src).not.toContain('icon: "/icon-192.png"');
    expect(src).toContain("import.meta.env.BASE_URL");
  });

  it("router.tsx sets basepath so links and refreshes stay under the deployed prefix", async () => {
    const src = await import("../../router.tsx?raw").then((m) => m.default as unknown as string);
    expect(src).toMatch(/basepath:\s*import\.meta\.env\.BASE_URL/);
  });
});
