import type { Recipe } from "./types";

export type RecipeSortId = "relevancia" | "kcal-asc" | "prot-desc" | "tiempo-asc";

export const RECIPE_SORTS: { id: RecipeSortId; n: string }[] = [
  { id: "relevancia", n: "Relevancia" },
  { id: "kcal-asc", n: "Menos kcal" },
  { id: "prot-desc", n: "Más proteína" },
  { id: "tiempo-asc", n: "Más rápida" },
];

/**
 * Orders an already-filtered list. `relevancia` keeps the incoming order, which
 * is the search ranking (or the catalogue order when there is no query), so
 * choosing it is always a no-op rather than a second, competing sort.
 *
 * Ties fall back to the name so the order is stable and predictable instead of
 * shifting between renders.
 */
export function sortRecipes(list: Recipe[], sort: RecipeSortId): Recipe[] {
  if (sort === "relevancia") return list;
  const byName = (a: Recipe, b: Recipe) => a.name.localeCompare(b.name, "es");
  const out = [...list];
  switch (sort) {
    case "kcal-asc":
      return out.sort((a, b) => a.perServing.kcal - b.perServing.kcal || byName(a, b));
    case "prot-desc":
      return out.sort((a, b) => b.perServing.prot - a.perServing.prot || byName(a, b));
    case "tiempo-asc":
      return out.sort((a, b) => a.minutes - b.minutes || byName(a, b));
    default:
      return out;
  }
}
