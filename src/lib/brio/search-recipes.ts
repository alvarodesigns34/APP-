import { norm } from "./format";
import { tokenize } from "./search";
import type { Recipe } from "./types";

/**
 * Recipe search, matching what the food search already does.
 *
 * The previous filter was `name.toLowerCase().includes(q.toLowerCase())`, which
 * is accent-sensitive: "brocoli", "platano", "limon", "salmon", "atun", "pure",
 * "cafe" and friends returned nothing at all, even though the recipes exist.
 * Typing Spanish without accents is the norm on a phone keyboard, so that hid a
 * large part of the catalog.
 *
 * Ranked so the closest match leads:
 *   0 name starts with the query
 *   1 every query word prefixes a word of the name
 *   2 the name contains the query
 *   3 an ingredient or tag matches (a recipe "with chicken" is a fair hit for
 *     "pollo", it just should not outrank one named for it)
 */
export const RECIPE_RANK_NAME_PREFIX = 0;
export const RECIPE_RANK_WORD_PREFIX = 1;
export const RECIPE_RANK_SUBSTRING = 2;
export const RECIPE_RANK_CONTENT = 3;

export type RecipeIndexEntry = {
  recipe: Recipe;
  order: number;
  nn: string;
  tokens: string[];
  /** Ingredient names plus tags, normalised, for the widest match tier. */
  content: string;
};

export function buildRecipeIndex(recipes: Recipe[]): RecipeIndexEntry[] {
  return recipes.map((recipe, i) => {
    const nn = norm(recipe.name);
    const content = norm(
      [...recipe.ing.map((x) => x.name), ...recipe.tags].join(" "),
    );
    return { recipe, order: i, nn, tokens: tokenize(nn), content };
  });
}

function rankOf(e: RecipeIndexEntry, nq: string, qTokens: string[]): number | null {
  if (e.nn.startsWith(nq)) return RECIPE_RANK_NAME_PREFIX;
  if (qTokens.length <= 1) {
    if (e.tokens.some((t) => t.startsWith(nq))) return RECIPE_RANK_WORD_PREFIX;
    if (e.nn.includes(nq)) return RECIPE_RANK_SUBSTRING;
  } else {
    if (qTokens.every((qt) => e.tokens.some((t) => t.startsWith(qt)))) return RECIPE_RANK_WORD_PREFIX;
    if (e.nn.includes(nq) || qTokens.every((qt) => e.nn.includes(qt))) return RECIPE_RANK_SUBSTRING;
  }
  if (qTokens.length > 0 && qTokens.every((qt) => e.content.includes(qt))) return RECIPE_RANK_CONTENT;
  return null;
}

export function searchRecipesIndexed(
  q: string,
  index: RecipeIndexEntry[],
  opts: { cat?: string | null; badge?: string | null; limit?: number } = {},
): Recipe[] {
  const { cat = null, badge = null, limit = 60 } = opts;
  const pool = index.filter((e) => {
    if (cat && e.recipe.cat !== cat) return false;
    if (badge && !e.recipe.badges.includes(badge)) return false;
    return true;
  });

  const nq = norm(q).trim();
  if (!nq) return pool.slice(0, limit).map((e) => e.recipe);

  const qTokens = tokenize(nq);
  const hits: { e: RecipeIndexEntry; rank: number }[] = [];
  for (const e of pool) {
    const rank = rankOf(e, nq, qTokens);
    if (rank != null) hits.push({ e, rank });
  }
  hits.sort(
    (a, b) =>
      a.rank - b.rank || a.e.recipe.name.length - b.e.recipe.name.length || a.e.order - b.e.order,
  );
  return hits.slice(0, limit).map((x) => x.e.recipe);
}
