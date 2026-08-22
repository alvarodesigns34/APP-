import { clamp, round } from "./format";
import { scaleMacros } from "./scale-macros";
import type { FoodBase, Macros, Recipe } from "./types";

/**
 * Scales a recipe to a target number of servings for preview/logging.
 *
 * Macros come from `per100 × grams` — the same grams already rounded for
 * display — rather than from `perServing` scaled independently. `servingG`
 * is a rounded gram figure, so a formula built on unrounded `perServing`
 * would preview macros that don't quite match what actually gets logged:
 * adding this recipe as a meal entry goes through `recipeAsFood()` (which
 * exposes `per100`) and `scaleMacros(food, grams)` with that same rounded
 * `servingG`. Sharing the formula keeps the preview and the logged entry
 * identical instead of off by a rounding fraction.
 */
export function scaleRecipe(
  recipe: Pick<Recipe, "servings" | "servingG" | "ing" | "per100">,
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
  const grams = round(recipe.servingG * servings, 1);
  const scaled = scaleMacros(recipe.per100, grams);
  return {
    servings,
    factor,
    grams,
    ingredients: recipe.ing.map((i) => ({
      id: i.id,
      name: i.name,
      g: round(i.g * factor, 1),
      base: i.base,
      kcal: round(i.kcal * factor),
    })),
    macros: {
      kcal: round(scaled.kcal),
      prot: round(scaled.prot, 1),
      carb: round(scaled.carb, 1),
      fat: round(scaled.fat, 1),
      fib: round(scaled.fib, 1),
    },
  };
}
