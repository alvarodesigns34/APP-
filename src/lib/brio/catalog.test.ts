import { beforeAll, describe, expect, it } from "vitest";
import { BASE_FOODS, BASE_RECIPES, buildRecipe, ensureCatalog } from "./catalog";
import type { RecipeSource } from "./types";

beforeAll(async () => {
  await ensureCatalog();
});

describe("buildRecipe", () => {
  it("returns null when an ingredient is missing", () => {
    const src: RecipeSource = {
      id: "t1",
      name: "Test",
      cat: "test",
      servings: 1,
      minutes: 5,
      items: [{ foodId: "does-not-exist", grams: 100 }],
      steps: [],
      tags: [],
    };
    expect(buildRecipe(src)).toBeNull();
  });

  it("builds macros from a real food", () => {
    const food = BASE_FOODS[0];
    const src: RecipeSource = {
      id: "t2",
      name: "Solo",
      cat: "test",
      servings: 2,
      minutes: 1,
      items: [{ foodId: food.id, grams: 200 }],
      steps: [],
      tags: [],
    };
    const r = buildRecipe(src);
    expect(r).not.toBeNull();
    expect(r!.totalG).toBe(200);
    expect(r!.servingG).toBe(100);
    expect(r!.perServing.kcal).toBeCloseTo(food.kcal, 5);
  });
});

describe("catalog snapshot", () => {
  it("loads every builtin food and recipe", () => {
    expect(BASE_FOODS).toHaveLength(719);
    expect(BASE_RECIPES).toHaveLength(211);
  });
});
