import { describe, expect, it } from "vitest";
import { buildRecipeIndex, searchRecipesIndexed } from "./search-recipes";
import type { Recipe } from "./types";

function recipe(id: string, name: string, extra: Partial<Recipe> = {}): Recipe {
  const macros = { kcal: 100, prot: 5, carb: 10, fat: 3, fib: 2, sug: null, sat: null, sod: null };
  return {
    id,
    name,
    cat: "principal",
    servings: 1,
    minutes: 20,
    items: [],
    steps: [],
    tags: [],
    vegetarian: false,
    vegan: false,
    totalG: 100,
    servingG: 100,
    per100: macros,
    perServing: macros,
    badges: [],
    ing: [],
    ...extra,
  };
}

const RECIPES = [
  recipe("r1", "Brócoli salteado"),
  recipe("r2", "Plátano con avena"),
  recipe("r3", "Salmón al limón"),
  recipe("r4", "Puré de patata"),
  recipe("r5", "Atún con tomate"),
  recipe("r6", "Café con leche"),
  recipe("r7", "Tortilla de champiñones"),
  recipe("r8", "Ensalada templada", {
    ing: [{ id: "f1", name: "Pollo", g: 100, base: "g", kcal: 165 }],
    tags: ["cena"],
  }),
];
const INDEX = buildRecipeIndex(RECIPES);
const names = (q: string, opts = {}) => searchRecipesIndexed(q, INDEX, opts).map((r) => r.name);

describe("searchRecipesIndexed", () => {
  it("finds accented recipes typed without accents", () => {
    // The old filter was `name.toLowerCase().includes(q.toLowerCase())`, which
    // returned nothing for every one of these — the common way to type on a
    // phone keyboard.
    expect(names("brocoli")).toEqual(["Brócoli salteado"]);
    expect(names("platano")).toEqual(["Plátano con avena"]);
    expect(names("salmon")).toEqual(["Salmón al limón"]);
    expect(names("limon")).toEqual(["Salmón al limón"]);
    expect(names("pure")).toEqual(["Puré de patata"]);
    expect(names("atun")).toEqual(["Atún con tomate"]);
    expect(names("cafe")).toEqual(["Café con leche"]);
    expect(names("champinones")).toEqual(["Tortilla de champiñones"]);
  });

  it("still finds them when typed with accents", () => {
    expect(names("brócoli")).toEqual(["Brócoli salteado"]);
    expect(names("salmón")).toEqual(["Salmón al limón"]);
    expect(names("café")).toEqual(["Café con leche"]);
  });

  it("is case-insensitive and tolerates surrounding spaces", () => {
    expect(names("  ATUN  ")).toEqual(["Atún con tomate"]);
  });

  it("matches every word of a multi-word query", () => {
    expect(names("tortilla champinones")).toEqual(["Tortilla de champiñones"]);
    expect(names("cafe leche")).toEqual(["Café con leche"]);
    expect(names("salmon brocoli")).toEqual([]);
  });

  it("matches ingredients and tags, ranked below name matches", () => {
    // "Ensalada templada" has chicken in it but is not named for it.
    expect(names("pollo")).toEqual(["Ensalada templada"]);
    expect(names("cena")).toEqual(["Ensalada templada"]);
  });

  it("ranks a name match above an ingredient match", () => {
    const withNamed = [...RECIPES, recipe("r9", "Pollo asado")];
    const idx = buildRecipeIndex(withNamed);
    expect(searchRecipesIndexed("pollo", idx).map((r) => r.name)).toEqual([
      "Pollo asado",
      "Ensalada templada",
    ]);
  });

  it("returns everything (up to the limit) for an empty query", () => {
    expect(searchRecipesIndexed("", INDEX)).toHaveLength(RECIPES.length);
    expect(searchRecipesIndexed("   ", INDEX)).toHaveLength(RECIPES.length);
    expect(searchRecipesIndexed("", INDEX, { limit: 3 })).toHaveLength(3);
  });

  it("applies category and badge filters alongside the query", () => {
    const idx = buildRecipeIndex([
      recipe("a", "Tostada de aguacate", { cat: "desayuno", badges: ["quick"] }),
      recipe("b", "Tostada de tomate", { cat: "desayuno", badges: [] }),
      recipe("c", "Tostada de salmón", { cat: "principal", badges: ["quick"] }),
    ]);
    expect(searchRecipesIndexed("tostada", idx, { cat: "desayuno" })).toHaveLength(2);
    expect(searchRecipesIndexed("tostada", idx, { badge: "quick" })).toHaveLength(2);
    expect(
      searchRecipesIndexed("tostada", idx, { cat: "desayuno", badge: "quick" }).map((r) => r.name),
    ).toEqual(["Tostada de aguacate"]);
  });

  it("returns nothing for a query that matches no recipe", () => {
    expect(names("zzzqqq")).toEqual([]);
  });
});
