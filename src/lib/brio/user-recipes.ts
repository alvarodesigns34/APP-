import { round, uid } from "./format";
import type { Food, UserRecipe } from "./types";

/** An ingredient picked from the catalog while drafting a recipe, before it is saved. */
export type RecipeDraftItem = {
  food: Pick<Food, "id" | "name" | "kcal" | "prot" | "carb" | "fat" | "fib" | "sug" | "sat" | "sod">;
  grams: number;
};

/**
 * Builds a `UserRecipe` from a name, its ingredients and a serving count —
 * the same per-100g aggregation `buildRecipe` in catalog.ts uses for the
 * built-in recipes, but working from foods picked at save time rather than a
 * JSON file resolved at build time.
 *
 * Returns null for anything unusable (no name, no ingredients with weight) so
 * the caller can show an inline error instead of saving a broken recipe.
 */
export function buildUserRecipe(
  existingId: string | null,
  name: string,
  items: RecipeDraftItem[],
  servings: number,
): UserRecipe | null {
  const cleanName = name.trim();
  if (!cleanName) return null;
  const valid = items.filter((i) => Number.isFinite(i.grams) && i.grams > 0);
  if (valid.length === 0) return null;
  // Same reasoning as scaleUserRecipe: `|| 1` would treat a real 0 as falsy
  // and skip straight to 1 instead of flooring to 0.5.
  const rawServings = Number.isFinite(servings) ? servings : 1;
  const s = Math.max(0.5, round(rawServings, 1));

  let totalG = 0;
  const sum = { kcal: 0, prot: 0, carb: 0, fat: 0, fib: 0, sug: 0, sat: 0, sod: 0 };
  // Mismo criterio que `buildRecipe` para las recetas del catálogo: si a un
  // solo ingrediente le falta el dato, el total de la receta es "no lo
  // sabemos" y no una suma a la que le faltan trozos. Antes estos tres ni se
  // sumaban, así que registrar «mis lentejas» borraba del día el sodio y el
  // azúcar que sí contaban las lentejas del catálogo.
  let sugOk = true;
  let satOk = true;
  let sodOk = true;
  for (const it of valid) {
    const k = it.grams / 100;
    sum.kcal += it.food.kcal * k;
    sum.prot += it.food.prot * k;
    sum.carb += it.food.carb * k;
    sum.fat += it.food.fat * k;
    sum.fib += it.food.fib * k;
    if (it.food.sug == null) sugOk = false;
    else sum.sug += it.food.sug * k;
    if (it.food.sat == null) satOk = false;
    else sum.sat += it.food.sat * k;
    if (it.food.sod == null) sodOk = false;
    else sum.sod += it.food.sod * k;
    totalG += it.grams;
  }

  return {
    id: existingId ?? uid("ur"),
    name: cleanName,
    items: valid.map((i) => ({ foodId: i.food.id, grams: round(i.grams, 1) })),
    servings: s,
    servingG: round(totalG / s, 1),
    per100: {
      kcal: round((sum.kcal * 100) / totalG, 1),
      prot: round((sum.prot * 100) / totalG, 1),
      carb: round((sum.carb * 100) / totalG, 1),
      fat: round((sum.fat * 100) / totalG, 1),
      fib: round((sum.fib * 100) / totalG, 1),
      // Sin redondear, igual que `buildRecipe` en catalog.ts, para que la misma
      // lista de ingredientes dé el mismo número por los dos caminos. Además,
      // el catálogo trae saturadas por debajo de 0,1 g/100 g (la manzana tiene
      // 0,03): a un decimal se quedaban en 0,0, que vuelve a borrar el dato que
      // este cambio viene a conservar. Azúcar y saturada van en gramos por
      // 100 g; el sodio, en miligramos.
      sug: sugOk ? (sum.sug * 100) / totalG : null,
      sat: satOk ? (sum.sat * 100) / totalG : null,
      sod: sodOk ? (sum.sod * 100) / totalG : null,
    },
  };
}

/** Macros for one serving, at the size the recipe was saved with. */
export function userRecipePerServing(ur: UserRecipe): { kcal: number; prot: number; carb: number; fat: number; fib: number } {
  const k = ur.servingG / 100;
  return {
    kcal: round(ur.per100.kcal * k, 1),
    prot: round(ur.per100.prot * k, 1),
    carb: round(ur.per100.carb * k, 1),
    fat: round(ur.per100.fat * k, 1),
    fib: round(ur.per100.fib * k, 1),
  };
}

export type ScaledUserRecipe = {
  servings: number;
  grams: number;
  macros: { kcal: number; prot: number; carb: number; fat: number; fib: number };
  ingredients: { foodId: string; grams: number }[];
};

/** Scales a saved recipe to a different serving count, for the "log this" flow. */
export function scaleUserRecipe(ur: UserRecipe, targetServings: number): ScaledUserRecipe {
  // `|| 1` would have looked right but silently turned a legitimate 0 into 1
  // before the clamp ever saw it (0 is falsy) — servings=0 needs to floor to
  // 0.5, not jump straight to 1.
  const raw = Number.isFinite(targetServings) ? targetServings : 1;
  const servings = Math.min(20, Math.max(0.5, round(raw, 1)));
  const factor = servings / Math.max(ur.servings, 0.5);
  const grams = round(ur.servingG * servings, 1);
  const k = grams / 100;
  return {
    servings,
    grams,
    macros: {
      kcal: round(ur.per100.kcal * k, 1),
      prot: round(ur.per100.prot * k, 1),
      carb: round(ur.per100.carb * k, 1),
      fat: round(ur.per100.fat * k, 1),
      fib: round(ur.per100.fib * k, 1),
    },
    ingredients: ur.items.map((i) => ({ foodId: i.foodId, grams: round(i.grams * factor, 1) })),
  };
}
