import { describe, expect, it } from "vitest";
import { defaultState } from "./persist";
import { pickSuggestedRecipes, pantryHint } from "./selectors-catalog";
import type { Recipe } from "./types";

function recipe(id: string, prot: number, ingIds: string[], kcal = 400): Recipe {
  const macros = { kcal, prot, carb: 40, fat: 10, fib: 2, sug: null, sat: null, sod: null };
  return {
    id,
    name: id,
    cat: "principal",
    servings: 1,
    minutes: 20,
    items: [],
    steps: [],
    tags: [],
    vegetarian: false,
    vegan: false,
    totalG: 200,
    servingG: 200,
    per100: macros,
    perServing: macros,
    badges: [],
    ing: ingIds.map((ingId) => ({ id: ingId, name: ingId, g: 50, base: "g" as const, kcal: 50 })),
  };
}

describe("pickSuggestedRecipes", () => {
  it("ranks pantry-ready recipes above ones that only fit macros", () => {
    const s = defaultState();
    s.settings.pantryBasics = false;
    s.pantry = ["a", "b"];
    const ready = recipe("ready", 20, ["a", "b"]);
    const almost = recipe("almost", 40, ["a", "c"]);
    const far = recipe("far", 50, ["x", "y", "z"]);
    const list = pickSuggestedRecipes([far, almost, ready], s, 2000, 100, 3);
    expect(list.map((x) => x.recipe.id)).toEqual(["ready", "almost", "far"]);
    expect(list.map((x) => x.miss)).toEqual([0, 1, 3]);
  });

  it("still prefers more protein when missing count ties", () => {
    const s = defaultState();
    s.settings.pantryBasics = false;
    s.pantry = [];
    const low = recipe("low", 12, ["x"]);
    const high = recipe("high", 40, ["y"]);
    const list = pickSuggestedRecipes([low, high], s, 2000, 100, 2);
    expect(list[0]?.recipe.id).toBe("high");
    expect(list[0]?.miss).toBe(1);
  });
});

describe("pantryHint", () => {
  it("uses Spanish copy for 0–3 missing, then stays quiet", () => {
    expect(pantryHint(0)).toBe("La puedes hacer ahora");
    expect(pantryHint(1)).toBe("Te falta 1 ingrediente");
    expect(pantryHint(2)).toBe("Te faltan 2 ingredientes");
    expect(pantryHint(4)).toBeNull();
  });
});
