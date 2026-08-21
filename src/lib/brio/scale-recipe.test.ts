import { describe, expect, it } from "vitest";
import { scaleRecipe } from "./scale-recipe";
import type { Recipe } from "./types";

const recipe: Pick<Recipe, "servings" | "servingG" | "ing" | "perServing"> = {
  servings: 4,
  servingG: 250,
  perServing: {
    kcal: 400,
    prot: 30.2,
    carb: 40.4,
    fat: 12.6,
    fib: 5.1,
    sug: null,
    sat: null,
    sod: null,
  },
  ing: [
    { id: "a", name: "Arroz", g: 200, base: "g", kcal: 260 },
    { id: "b", name: "Pollo", g: 300, base: "g", kcal: 330 },
  ],
};

describe("scaleRecipe", () => {
  it("halves ingredients and uses 2 × perServing at 2 raciones", () => {
    const out = scaleRecipe(recipe, 2);
    expect(out.servings).toBe(2);
    expect(out.factor).toBe(0.5);
    expect(out.grams).toBe(500);
    expect(out.ingredients).toEqual([
      { id: "a", name: "Arroz", g: 100, base: "g", kcal: 130 },
      { id: "b", name: "Pollo", g: 150, base: "g", kcal: 165 },
    ]);
    expect(out.macros).toEqual({
      kcal: 800,
      prot: 60.4,
      carb: 80.8,
      fat: 25.2,
      fib: 10.2,
    });
  });

  it("scales 1.5× from 4 to 6 raciones", () => {
    const out = scaleRecipe(recipe, 6);
    expect(out.servings).toBe(6);
    expect(out.factor).toBe(1.5);
    expect(out.grams).toBe(1500);
    expect(out.ingredients[0].g).toBe(300);
    expect(out.ingredients[0].kcal).toBe(390);
    expect(out.ingredients[1].g).toBe(450);
    expect(out.ingredients[1].kcal).toBe(495);
    expect(out.macros).toEqual({
      kcal: 2400,
      prot: 181.2,
      carb: 242.4,
      fat: 75.6,
      fib: 30.6,
    });
  });

  it("is identity at 4 raciones within rounding", () => {
    const out = scaleRecipe(recipe, 4);
    expect(out.servings).toBe(4);
    expect(out.factor).toBe(1);
    expect(out.grams).toBe(1000);
    expect(out.ingredients[0].g).toBeCloseTo(recipe.ing[0].g, 1);
    expect(out.ingredients[0].kcal).toBeCloseTo(recipe.ing[0].kcal, 0);
    expect(out.ingredients[1].g).toBeCloseTo(recipe.ing[1].g, 1);
    expect(out.ingredients[1].kcal).toBeCloseTo(recipe.ing[1].kcal, 0);
    expect(out.macros.kcal).toBe(1600);
    expect(out.macros.prot).toBeCloseTo(120.8, 1);
    expect(out.macros.carb).toBeCloseTo(161.6, 1);
    expect(out.macros.fat).toBeCloseTo(50.4, 1);
    expect(out.macros.fib).toBeCloseTo(20.4, 1);
  });

  it("clamps 0 to 0.5 and 100 to 20", () => {
    const low = scaleRecipe(recipe, 0);
    expect(low.servings).toBe(0.5);
    expect(low.factor).toBe(0.125);
    expect(low.grams).toBe(125);
    expect(low.ingredients[0].g).toBe(25);
    expect(low.macros.kcal).toBe(200);

    const high = scaleRecipe(recipe, 100);
    expect(high.servings).toBe(20);
    expect(high.factor).toBe(5);
    expect(high.grams).toBe(5000);
    expect(high.ingredients[0].g).toBe(1000);
    expect(high.macros.kcal).toBe(8000);
  });

  it("does not mutate the input recipe ingredients", () => {
    const snapshot = recipe.ing.map((i) => ({ ...i }));
    const out = scaleRecipe(recipe, 2);
    expect(recipe.ing).toEqual(snapshot);
    out.ingredients[0].g = 0;
    out.ingredients[0].kcal = 0;
    expect(recipe.ing[0].g).toBe(200);
    expect(recipe.ing[0].kcal).toBe(260);
  });
});
