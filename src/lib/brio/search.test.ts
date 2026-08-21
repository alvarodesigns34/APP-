import { beforeAll, describe, expect, it } from "vitest";
import { BASE_FOODS, ensureCatalog, searchFoods } from "./catalog";

import { categoryIdsForQuery, fuzzyMaxDistance, levenshtein, levenshteinAtMost, tokenize } from "./search";
import type { Food, UserRecipe } from "./types";

const emptyCtx = { customFoods: [] as Food[], recipes: [] as UserRecipe[] };

beforeAll(async () => {
  await ensureCatalog();
});

function customFood(partial: Partial<Food> & Pick<Food, "id" | "name">): Food {
  return {
    cat: "propio",
    kcal: 100,
    prot: 1,
    carb: 10,
    fat: 1,
    fib: 0,
    sug: null,
    sat: null,
    sod: null,
    units: [{ name: "g", g: 1 }],
    base: "g",
    ...partial,
  };
}

describe("search helpers", () => {
  it("tokenizes normalized names", () => {
    expect(tokenize("zumo de manzana")).toEqual(["zumo", "de", "manzana"]);
    expect(tokenize("manzana")).toEqual(["manzana"]);
  });

  it("computes levenshtein and bails when over max", () => {
    expect(levenshtein("manzana", "manzana")).toBe(0);
    expect(levenshtein("manzana", "manzama")).toBe(1);
    expect(levenshtein("manzana", "manzanaa")).toBe(1);
    expect(levenshteinAtMost("manzana", "naranja", 1)).toBe(2);
    expect(levenshteinAtMost("abc", "abcdef", 1)).toBe(2);
  });

  it("sets fuzzy caps from query length", () => {
    expect(fuzzyMaxDistance(3)).toBe(0);
    expect(fuzzyMaxDistance(4)).toBe(1);
    expect(fuzzyMaxDistance(6)).toBe(1);
    expect(fuzzyMaxDistance(7)).toBe(2);
  });

  it("maps category labels and ids", () => {
    expect(categoryIdsForQuery("fruta")).toContain("fruta");
    expect(categoryIdsForQuery("frutas")).toContain("fruta");
    expect(categoryIdsForQuery("lacteo")).toContain("lacteo");
    expect(categoryIdsForQuery("lácteo".normalize("NFD").replace(/[\u0300-\u036f]/g, ""))).toContain("lacteo");
    expect(categoryIdsForQuery("pan")).toEqual([]);
  });
});

describe("searchFoods", () => {
  it("finds Manzana for manzana without editing foods.json", () => {
    expect(BASE_FOODS.some((f) => f.name === "Manzana" && f.cat === "fruta")).toBe(true);
    const hits = searchFoods("manzana", null, emptyCtx);
    expect(hits.some((f) => f.name === "Manzana")).toBe(true);
    expect(hits[0]?.name).toBe("Manzana");
  });

  it("finds Manzana despite distance-1 typos", () => {
    const a = searchFoods("manzama", null, emptyCtx);
    const b = searchFoods("manzanaa", null, emptyCtx);
    expect(a.some((f) => f.name === "Manzana")).toBe(true);
    expect(b.some((f) => f.name === "Manzana")).toBe(true);
  });

  it("does not fuzzy-match queries shorter than 4 characters", () => {
    const hits = searchFoods("xyz", null, emptyCtx);
    expect(hits).toEqual([]);
  });

  it("category filter fruta excludes meat", () => {
    const hits = searchFoods("pollo", "fruta", emptyCtx, 80);
    expect(hits.every((f) => f.cat === "fruta")).toBe(true);
    expect(hits.some((f) => f.cat === "carne")).toBe(false);

    const fruits = searchFoods("", "fruta", emptyCtx, 200);
    expect(fruits.length).toBeGreaterThan(0);
    expect(fruits.every((f) => f.cat === "fruta")).toBe(true);
    expect(fruits.some((f) => f.cat === "carne")).toBe(false);
  });

  it("a category label query returns foods in that category", () => {
    const frutas = searchFoods("fruta", null, emptyCtx, 80);
    expect(frutas.filter((f) => f.cat === "fruta").length).toBeGreaterThan(10);

    const lacteos = searchFoods("lácteo", null, emptyCtx, 80);
    expect(lacteos.some((f) => f.cat === "lacteo")).toBe(true);
    expect(lacteos.filter((f) => f.cat === "lacteo").length).toBeGreaterThan(10);
  });

  it("finds a custom food from ctx", () => {
    const food = customFood({ id: "cf-lunar", name: "Queso Lunar Brío Danone" });
    const hits = searchFoods("lunar", null, { customFoods: [food], recipes: [] });
    expect(hits.some((f) => f.id === "cf-lunar")).toBe(true);
    expect(hits.find((f) => f.id === "cf-lunar")?.cat).toBe("propio");
  });

  it("finds a user recipe from ctx", () => {
    const recipe: UserRecipe = {
      id: "ur-bowl",
      name: "Bowl de quinoa lunar",
      items: [],
      servings: 1,
      servingG: 250,
      per100: { kcal: 120, prot: 5, carb: 20, fat: 2, fib: 3 },
    };
    const hits = searchFoods("quinoa lunar", null, { customFoods: [], recipes: [recipe] });
    expect(hits.some((f) => f.id === "ur-bowl")).toBe(true);
  });

  it("keeps empty-query behaviour", () => {
    const slice = searchFoods("", null, emptyCtx, 80);
    expect(slice).toHaveLength(80);

    const filtered = searchFoods("  ", "carne", emptyCtx, 40);
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((f) => f.cat === "carne")).toBe(true);
  });

  it("ranks name prefix above word prefix and substring", () => {
    const hits = searchFoods("manzana", null, emptyCtx);
    const names = hits.map((f) => f.name);
    expect(names[0]).toBe("Manzana");
    const prefix = names.indexOf("Manzana verde");
    const later = names.indexOf("Zumo de manzana");
    expect(prefix).toBeGreaterThanOrEqual(0);
    expect(later).toBeGreaterThanOrEqual(0);
    expect(prefix).toBeLessThan(later);
  });

  it("respects limit", () => {
    expect(searchFoods("a", null, emptyCtx, 5)).toHaveLength(5);
  });
});
