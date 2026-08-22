import { norm } from "./format";
import { fuzzyMaxDistance, levenshteinAtMost, tokenize } from "./search";
import type { Recipe } from "./types";

/**
 * Recipe search: accent-blind (same `norm` as foods) plus a fuzzy tier when
 * exact/prefix/substring hits are few, matching `search.ts`.
 *
 * Ranked so the closest match leads:
 *   0 name starts with the query
 *   1 every query word prefixes a word of the name
 *   2 the name contains the query
 *   3 fuzzy (typos, e.g. "brocoi" → Brócoli)
 *   4 an ingredient or tag matches
 */
export const RECIPE_RANK_NAME_PREFIX = 0;
export const RECIPE_RANK_WORD_PREFIX = 1;
export const RECIPE_RANK_SUBSTRING = 2;
export const RECIPE_RANK_FUZZY = 3;
export const RECIPE_RANK_CONTENT = 4;

/** Same threshold as food search: only fuzzy when exact hits are scarce. */
const FEW_EXACT = 8;

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

function exactRank(e: RecipeIndexEntry, nq: string, qTokens: string[]): number | null {
  if (e.nn.startsWith(nq)) return RECIPE_RANK_NAME_PREFIX;
  if (qTokens.length <= 1) {
    if (e.tokens.some((t) => t.startsWith(nq))) return RECIPE_RANK_WORD_PREFIX;
    if (e.nn.includes(nq)) return RECIPE_RANK_SUBSTRING;
    return null;
  }
  if (qTokens.every((qt) => e.tokens.some((t) => t.startsWith(qt)))) return RECIPE_RANK_WORD_PREFIX;
  if (e.nn.includes(nq) || qTokens.every((qt) => e.nn.includes(qt))) return RECIPE_RANK_SUBSTRING;
  return null;
}

function contentRank(e: RecipeIndexEntry, qTokens: string[]): number | null {
  if (qTokens.length > 0 && qTokens.every((qt) => e.content.includes(qt))) return RECIPE_RANK_CONTENT;
  return null;
}

function bestTokenDistance(qt: string, tokens: string[], cap: number): number {
  const max = Math.min(cap, fuzzyMaxDistance(qt.length));
  if (max <= 0) {
    return tokens.some((t) => t.startsWith(qt)) ? 0 : 1;
  }
  let best = max + 1;
  for (const t of tokens) {
    if (t.startsWith(qt)) return 0;
    if (Math.abs(t.length - qt.length) > max) continue;
    const d = levenshteinAtMost(qt, t, max);
    if (d < best) {
      best = d;
      if (best === 0) return 0;
    }
  }
  return best;
}

function fuzzyDist(e: RecipeIndexEntry, qTokens: string[], cap: number): number | null {
  if (qTokens.length === 0 || cap <= 0) return null;
  let dist = 0;
  for (const qt of qTokens) {
    const d = bestTokenDistance(qt, e.tokens, cap);
    const max = Math.min(cap, fuzzyMaxDistance(qt.length));
    if (d > max) return null;
    dist += d;
  }
  return dist;
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
  const hits: { e: RecipeIndexEntry; rank: number; dist: number }[] = [];
  const seen = new Set<string>();

  for (const e of pool) {
    const rank = exactRank(e, nq, qTokens);
    if (rank == null) continue;
    hits.push({ e, rank, dist: 0 });
    seen.add(e.recipe.id);
  }

  const cap = fuzzyMaxDistance(nq.length);
  if (cap > 0 && hits.length < FEW_EXACT && hits.length < limit) {
    for (const e of pool) {
      if (seen.has(e.recipe.id)) continue;
      const dist = fuzzyDist(e, qTokens, cap);
      if (dist == null) continue;
      hits.push({ e, rank: RECIPE_RANK_FUZZY, dist });
      seen.add(e.recipe.id);
    }
  }

  for (const e of pool) {
    if (seen.has(e.recipe.id)) continue;
    const rank = contentRank(e, qTokens);
    if (rank == null) continue;
    hits.push({ e, rank, dist: 0 });
    seen.add(e.recipe.id);
  }

  hits.sort(
    (a, b) =>
      a.rank - b.rank ||
      a.dist - b.dist ||
      a.e.recipe.name.length - b.e.recipe.name.length ||
      a.e.order - b.e.order,
  );
  return hits.slice(0, limit).map((x) => x.e.recipe);
}
