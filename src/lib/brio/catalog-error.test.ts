import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Regression cover for the offline path. The catalog moved out of the JS bundle
 * into `/data/*.json`, which introduced a failure mode the bundle never had: the
 * app loads but has no foods. A rejected fetch must settle on a retryable
 * `error` status instead of leaving every screen stuck on "loading" forever.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("catalog fetch failure", () => {
  it("settles on error and keeps the snapshot empty", async () => {
    vi.resetModules();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("offline"))),
    );
    const { ensureCatalog, getCatalogStatus, isCatalogReady } = await import("./catalog");

    expect(getCatalogStatus()).toBe("idle");
    await expect(ensureCatalog()).rejects.toThrow("offline");
    expect(getCatalogStatus()).toBe("error");
    expect(isCatalogReady()).toBe(false);
  });

  it("notifies subscribers so every screen leaves the loading state together", async () => {
    vi.resetModules();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("offline"))),
    );
    const { ensureCatalog, subscribeCatalog, getCatalogStatus } = await import("./catalog");

    const seen: string[] = [];
    const unsubscribe = subscribeCatalog(() => seen.push(getCatalogStatus()));
    await expect(ensureCatalog()).rejects.toThrow();
    unsubscribe();

    expect(seen).toContain("loading");
    expect(seen).toContain("error");
  });

  it("recovers when the network comes back, without reloading the page", async () => {
    vi.resetModules();
    const foods = [
      {
        id: "f1",
        name: "Manzana",
        cat: "fruta",
        kcal: 52,
        prot: 0.3,
        carb: 14,
        fat: 0.2,
        fib: 2.4,
        sug: null,
        sat: null,
        sod: null,
        units: [{ name: "pieza", g: 150 }],
        base: "g",
      },
    ];
    let online = false;
    vi.stubGlobal(
      "fetch",
      vi.fn((path: string) => {
        if (!online) return Promise.reject(new Error("offline"));
        const body = path.includes("foods") ? foods : [];
        return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
      }),
    );
    const { ensureCatalog, retryCatalog, getCatalogStatus, isCatalogReady } = await import("./catalog");

    await expect(ensureCatalog()).rejects.toThrow();
    expect(getCatalogStatus()).toBe("error");

    online = true;
    await retryCatalog();

    expect(getCatalogStatus()).toBe("ready");
    expect(isCatalogReady()).toBe(true);
  });

  it("does not replay a cached rejection: a later attempt refetches", async () => {
    vi.resetModules();
    const fetchMock = vi.fn(() => Promise.reject(new Error("offline")));
    vi.stubGlobal("fetch", fetchMock);
    const { ensureCatalog } = await import("./catalog");

    await expect(ensureCatalog()).rejects.toThrow();
    const afterFirst = fetchMock.mock.calls.length;
    await expect(ensureCatalog()).rejects.toThrow();

    expect(fetchMock.mock.calls.length).toBeGreaterThan(afterFirst);
  });
});
