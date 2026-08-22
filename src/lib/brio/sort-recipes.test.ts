import { describe, expect, it } from "vitest";
import { RECIPE_SORTS, sortRecipes } from "./sort-recipes";
import type { Recipe } from "./types";

function recipe(name: string, kcal: number, prot: number, minutes: number): Recipe {
  const per = { kcal, prot, carb: 0, fat: 0, fib: 0, sug: null, sat: null, sod: null };
  return {
    id: name,
    name,
    cat: "principal",
    servings: 1,
    minutes,
    items: [],
    steps: [],
    tags: [],
    vegetarian: false,
    vegan: false,
    totalG: 100,
    servingG: 100,
    per100: per,
    perServing: per,
    badges: [],
    ing: [],
  };
}

const LIST = [
  recipe("Cena rápida", 500, 30, 10),
  recipe("Almuerzo", 300, 40, 30),
  recipe("Batido", 300, 10, 5),
];
const names = (s: Parameters<typeof sortRecipes>[1]) => sortRecipes(LIST, s).map((r) => r.name);

describe("sortRecipes", () => {
  it("leaves the incoming (search-ranked) order alone for relevancia", () => {
    expect(names("relevancia")).toEqual(["Cena rápida", "Almuerzo", "Batido"]);
  });

  it("sorts by calories ascending", () => {
    expect(names("kcal-asc")).toEqual(["Almuerzo", "Batido", "Cena rápida"]);
  });

  it("sorts by protein descending", () => {
    expect(names("prot-desc")).toEqual(["Almuerzo", "Cena rápida", "Batido"]);
  });

  it("sorts by time ascending", () => {
    expect(names("tiempo-asc")).toEqual(["Batido", "Cena rápida", "Almuerzo"]);
  });

  it("breaks ties by name so the order is stable", () => {
    // Almuerzo and Batido are both 300 kcal; the name decides, every time.
    expect(names("kcal-asc").slice(0, 2)).toEqual(["Almuerzo", "Batido"]);
    expect(names("kcal-asc")).toEqual(names("kcal-asc"));
  });

  it("does not mutate the array it is given", () => {
    const before = LIST.map((r) => r.name);
    sortRecipes(LIST, "kcal-asc");
    expect(LIST.map((r) => r.name)).toEqual(before);
  });

  it("handles an empty list", () => {
    for (const s of RECIPE_SORTS) expect(sortRecipes([], s.id)).toEqual([]);
  });
});
