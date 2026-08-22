import { getFood, searchFoods } from "./catalog";
import type { Food, UserRecipe } from "./types";

export type FoodLogTab = "buscar" | "recientes" | "favoritos" | "habituales";

/** Rows for the food-log list. Custom foods resolve even before the builtin catalog is ready. */
export function buildFoodLogList(opts: {
  picked: Food | null;
  editing: boolean;
  tab: FoodLogTab;
  q: string;
  cat: string | null;
  recents: string[];
  favorites: string[];
  habitual: string[];
  customFoods: Food[];
  recipes: UserRecipe[];
}): Food[] {
  if (opts.picked || opts.editing) return [];
  const catalogCtx = { customFoods: opts.customFoods, recipes: opts.recipes };
  if (opts.tab === "buscar") return searchFoods(opts.q, opts.cat, catalogCtx, 60);
  const ids = opts.tab === "recientes" ? opts.recents : opts.tab === "favoritos" ? opts.favorites : opts.habitual;
  return ids.map((id) => getFood(id, catalogCtx)).filter((f): f is Food => !!f);
}
