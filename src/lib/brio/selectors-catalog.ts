import { BASE_RECIPES, defaultServing, getFood, isPantryBasic } from "./catalog";
import { mealForHour, rangeKeys, todayKey } from "./dates";
import { dayFoodTotals, kcalGoalFor, macroGoalsFor } from "./selectors";
import type { MealId, SelectorState, Recipe } from "./types";
import { MEALS } from "./types";

export type SuggestedRecipe = { recipe: Recipe; miss: number };

/**
 * What deciding "do I have this ingredient?" actually needs. Narrower than the
 * whole state so a screen that only holds these four slices can call it
 * without inventing the rest.
 */
export type PantryState = Pick<SelectorState, "pantry" | "customFoods" | "recipes"> & {
  settings: Pick<SelectorState["settings"], "pantryBasics">;
};

/** Only `ing` is read, so a user recipe's scaled ingredient list works here too, honestly typed instead of cast through a fake `Recipe`. */
export function missingIngredients(s: PantryState, recipe: Pick<Recipe, "ing">): string[] {
  return recipe.ing
    .filter((i) => {
      if (s.pantry.includes(i.id)) return false;
      if (!s.settings.pantryBasics) return true;
      return !isPantryBasic(getFood(i.id, { customFoods: s.customFoods, recipes: s.recipes }));
    })
    .map((i) => i.name);
}

export function pickSuggestedRecipes(
  recipes: Recipe[],
  s: PantryState,
  remKcal: number,
  remProt: number,
  limit = 3,
): SuggestedRecipe[] {
  return recipes
    .filter((r) => {
      const k = r.perServing.kcal;
      if (k < 80 || k > remKcal + 80) return false;
      if (remProt > 15 && r.perServing.prot < 12) return false;
      return true;
    })
    .map((recipe) => ({ recipe, miss: missingIngredients(s, recipe).length }))
    .sort((a, b) => a.miss - b.miss || b.recipe.perServing.prot - a.recipe.perServing.prot)
    .slice(0, limit);
}

export function pantryHint(miss: number): string | null {
  if (miss === 0) return "La puedes hacer ahora";
  if (miss === 1) return "Te falta 1 ingrediente";
  if (miss <= 3) return `Te faltan ${miss} ingredientes`;
  return null;
}

export function suggestRecipes(s: SelectorState, key: string, limit = 3) {
  const food = dayFoodTotals(s, key);
  const remKcal = kcalGoalFor(s, key) - food.kcal;
  // El objetivo del día, no el plano: las kcal de arriba ya pasan por
  // `kcalGoalFor`, que aplica el plan de días de entreno/descanso, pero la
  // proteína salía de `s.goals.prot` a secas. Con el plan activado, "Te encaja
  // para lo que queda" contradecía a las barras de macros de la misma pantalla
  // — en un día de descanso las barras decían que quedaban 39 g y la tarjeta
  // decía 53 g. Y no es solo el texto: `remProt` decide qué recetas entran.
  const remProt = macroGoalsFor(s, key).prot - food.prot;
  if (remKcal < 120) return { remKcal, remProt, list: [] as SuggestedRecipe[] };
  return { remKcal, remProt, list: pickSuggestedRecipes(BASE_RECIPES, s, remKcal, remProt, limit) };
}

export type LastPortion = { grams: number; qty: number; unitName: string; meal: MealId; kcal: number };

export function lastPortion(s: SelectorState, foodId: string): LastPortion | null {
  const keys = rangeKeys(todayKey(), 60).reverse();
  for (const k of keys) {
    const d = s.days[k];
    if (!d) continue;
    for (const m of [...MEALS].reverse()) {
      const found = [...d.meals[m.id]].reverse().find((e) => e.foodId === foodId);
      if (found) {
        return { grams: found.grams, qty: found.qty, unitName: found.unitName, meal: m.id, kcal: found.kcal };
      }
    }
  }
  const food = getFood(foodId, { customFoods: s.customFoods, recipes: s.recipes });
  if (!food) return null;
  const serve = defaultServing(food);
  return {
    grams: serve.grams,
    qty: serve.qty,
    unitName: serve.unitName,
    meal: mealForHour(),
    kcal: Math.round((food.kcal * serve.grams) / 100),
  };
}