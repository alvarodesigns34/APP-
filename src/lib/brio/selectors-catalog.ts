import { BASE_RECIPES, defaultServing, getFood, isPantryBasic } from "./catalog";
import { mealForHour, rangeKeys, todayKey } from "./dates";
import { dayFoodTotals, kcalGoalFor } from "./selectors";
import type { MealId, PersistedState, Recipe } from "./types";
import { MEALS } from "./types";

export function suggestRecipes(s: PersistedState, key: string, limit = 3) {
  const food = dayFoodTotals(s, key);
  const remKcal = kcalGoalFor(s, key) - food.kcal;
  const remProt = s.goals.prot - food.prot;
  if (remKcal < 120) return { remKcal, remProt, list: [] as Recipe[] };
  const list = BASE_RECIPES.filter((r) => {
    const k = r.perServing.kcal;
    if (k < 80 || k > remKcal + 80) return false;
    if (remProt > 15 && r.perServing.prot < 12) return false;
    return true;
  })
    .sort((a, b) => b.perServing.prot - a.perServing.prot)
    .slice(0, limit);
  return { remKcal, remProt, list };
}

export function missingIngredients(s: PersistedState, recipe: Recipe): string[] {
  return recipe.ing
    .filter((i) => {
      if (s.pantry.includes(i.id)) return false;
      if (!s.settings.pantryBasics) return true;
      return !isPantryBasic(getFood(i.id, { customFoods: s.customFoods, recipes: s.recipes }));
    })
    .map((i) => i.name);
}

export type LastPortion = { grams: number; qty: number; unitName: string; meal: MealId; kcal: number };

export function lastPortion(s: PersistedState, foodId: string): LastPortion | null {
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
