import { clamp, round } from "./format";
import type { FoodBase, Macros, Recipe } from "./types";

export function scaleRecipe(
  recipe: Pick<Recipe, "servings" | "servingG" | "ing" | "perServing">,
  targetServings: number,
): {
  servings: number;
  factor: number;
  grams: number;
  ingredients: Array<{ id: string; name: string; g: number; base: FoodBase; kcal: number }>;
  macros: Pick<Macros, "kcal" | "prot" | "carb" | "fat" | "fib">;
} {
  const servings = round(clamp(targetServings, 0.5, 20), 1);
  const factor = servings / Math.max(recipe.servings, 1);
  return {
    servings,
    factor,
    grams: round(recipe.servingG * servings, 1),
    ingredients: recipe.ing.map((i) => ({
      id: i.id,
      name: i.name,
      g: round(i.g * factor, 1),
      base: i.base,
      kcal: round(i.kcal * factor),
    })),
    macros: {
      kcal: round(recipe.perServing.kcal * servings),
      prot: round(recipe.perServing.prot * servings, 1),
      carb: round(recipe.perServing.carb * servings, 1),
      fat: round(recipe.perServing.fat * servings, 1),
      fib: round(recipe.perServing.fib * servings, 1),
    },
  };
}
