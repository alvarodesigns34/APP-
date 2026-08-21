import { describe, expect, it } from "vitest";
import { scaleMacros } from "./scale-macros";
import { useBrioStore } from "./store";
import { BASE_FOODS, ensureCatalog, isCatalogReady, searchFoods } from "./catalog";

const sources = import.meta.glob("./*.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

describe("start-chunk modules do not pull the catalog JSON", () => {
  it("scale-macros, store and selectors have no catalog/JSON imports", () => {
    const scale = sources["./scale-macros.ts"] ?? "";
    expect(scale.length).toBeGreaterThan(0);
    expect(scale).not.toMatch(/foods\.json|recipes\.json|routines\.json/);
    expect(scale).not.toMatch(/from ["']\.\/catalog["']/);

    const store = sources["./store.ts"] ?? "";
    expect(store.length).toBeGreaterThan(0);
    expect(store).not.toMatch(/from ["']\.\/catalog["']/);
    expect(store).not.toMatch(/foods\.json|recipes\.json|routines\.json/);

    const selectors = sources["./selectors.ts"] ?? "";
    expect(selectors.length).toBeGreaterThan(0);
    expect(selectors).not.toMatch(/from ["']\.\/catalog["']/);
    expect(selectors).not.toMatch(/foods\.json|recipes\.json/);
  });
});

describe("catalog loads on demand", () => {
  it("is empty on import of scale-macros/store, then finds Manzana after ensureCatalog", async () => {
    expect(typeof scaleMacros).toBe("function");
    expect(useBrioStore.getState().hydrated).toBe(false);
    expect(isCatalogReady()).toBe(false);
    expect(BASE_FOODS).toHaveLength(0);

    await ensureCatalog();

    expect(BASE_FOODS.some((f) => f.name === "Manzana" && f.cat === "fruta")).toBe(true);
    const empty = { customFoods: [], recipes: [] };
    const hits = searchFoods("manzana", null, empty);
    expect(hits[0]?.name).toBe("Manzana");
    const fuzzy = searchFoods("manzama", null, empty);
    expect(fuzzy.some((f) => f.name === "Manzana")).toBe(true);
  });
});
