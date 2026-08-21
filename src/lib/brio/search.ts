import { CATEGORIES, type Food } from "./types";
import { norm } from "./format";

/** Rank: name prefix < word prefix < substring < fuzzy < category-only. */
export const RANK_NAME_PREFIX = 0;
export const RANK_WORD_PREFIX = 1;
export const RANK_SUBSTRING = 2;
export const RANK_FUZZY = 3;
export const RANK_CATEGORY = 4;

/** Run fuzzy only when exact/prefix/substring produced fewer than this many hits. */
const FEW_EXACT = 8;

export type FoodIndexEntry = {
  food: Food;
  order: number;
  nn: string;
  tokens: string[];
};

export function tokenize(nn: string): string[] {
  return nn.split(/[^a-z0-9]+/).filter((t) => t.length > 0);
}

export function buildFoodIndex(foods: Food[], orderOffset = 0): FoodIndexEntry[] {
  return foods.map((food, i) => {
    const nn = norm(food.name);
    return { food, order: orderOffset + i, nn, tokens: tokenize(nn) };
  });
}

export function fuzzyMaxDistance(queryLen: number): number {
  if (queryLen >= 7) return 2;
  if (queryLen >= 4) return 1;
  return 0;
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Uint16Array(n + 1);
  let curr = new Uint16Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      const del = prev[j]! + 1;
      const ins = curr[j - 1]! + 1;
      const sub = prev[j - 1]! + cost;
      curr[j] = del < ins ? (del < sub ? del : sub) : ins < sub ? ins : sub;
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }
  return prev[n]!;
}

/** Distance, or max+1 when it cannot be ≤ max. Length-gap bails before DP. */
export function levenshteinAtMost(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (max < 0) return 1;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (max === 0) return 1;
  const d = levenshtein(a, b);
  return d > max ? max + 1 : d;
}

/**
 * Category ids whose id or label matches the query (e.g. "fruta", "lácteo").
 * Requires ≥ 4 chars so short tokens like "pan" do not dump a whole aisle.
 */
export function categoryIdsForQuery(nq: string): string[] {
  if (nq.length < 4) return [];
  const out: string[] = [];
  for (const c of CATEGORIES) {
    const id = norm(c.id);
    const name = norm(c.n);
    if (id === nq || name === nq) {
      out.push(c.id);
      continue;
    }
    if (id.startsWith(nq) || (nq.startsWith(id) && nq.length - id.length <= 2)) {
      out.push(c.id);
      continue;
    }
    const tokens = tokenize(name);
    if (tokens.some((t) => t === nq || (t.length >= 4 && (t.startsWith(nq) || nq.startsWith(t))))) {
      out.push(c.id);
    }
  }
  return out;
}

function exactMatch(e: FoodIndexEntry, nq: string, qTokens: string[]): { rank: number; dist: number } | null {
  if (e.nn.startsWith(nq)) return { rank: RANK_NAME_PREFIX, dist: 0 };
  if (qTokens.length <= 1) {
    if (e.tokens.some((t) => t.startsWith(nq))) return { rank: RANK_WORD_PREFIX, dist: 0 };
    if (e.nn.includes(nq)) return { rank: RANK_SUBSTRING, dist: 0 };
    return null;
  }
  if (qTokens.every((qt) => e.tokens.some((t) => t.startsWith(qt)))) {
    return { rank: RANK_WORD_PREFIX, dist: 0 };
  }
  if (e.nn.includes(nq) || qTokens.every((qt) => e.nn.includes(qt))) {
    return { rank: RANK_SUBSTRING, dist: 0 };
  }
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

function fuzzyMatch(e: FoodIndexEntry, qTokens: string[], cap: number): { rank: number; dist: number } | null {
  if (qTokens.length === 0 || cap <= 0) return null;
  let dist = 0;
  for (const qt of qTokens) {
    const d = bestTokenDistance(qt, e.tokens, cap);
    const max = Math.min(cap, fuzzyMaxDistance(qt.length));
    if (d > max) return null;
    dist += d;
  }
  return { rank: RANK_FUZZY, dist };
}

export function searchIndexed(
  q: string,
  cat: string | null,
  builtin: FoodIndexEntry[],
  extra: Food[],
  limit = 80,
): Food[] {
  const extras = buildFoodIndex(extra, builtin.length);
  const pool = cat ? [...builtin, ...extras].filter((e) => e.food.cat === cat) : [...builtin, ...extras];

  const nq = norm(q).trim();
  if (!nq) {
    const empty = pool.slice();
    empty.sort((a, b) => a.food.name.length - b.food.name.length || a.order - b.order);
    return empty.slice(0, limit).map((e) => e.food);
  }

  const qTokens = tokenize(nq);
  const hits: { e: FoodIndexEntry; rank: number; dist: number }[] = [];
  const seen = new Set<string>();

  for (const e of pool) {
    const m = exactMatch(e, nq, qTokens);
    if (!m) continue;
    hits.push({ e, rank: m.rank, dist: m.dist });
    seen.add(e.food.id);
  }

  const cap = fuzzyMaxDistance(nq.length);
  if (cap > 0 && hits.length < FEW_EXACT && hits.length < limit) {
    for (const e of pool) {
      if (seen.has(e.food.id)) continue;
      const m = fuzzyMatch(e, qTokens, cap);
      if (!m) continue;
      hits.push({ e, rank: m.rank, dist: m.dist });
      seen.add(e.food.id);
    }
  }

  if (!cat) {
    const catIds = categoryIdsForQuery(nq);
    if (catIds.length) {
      const want = new Set(catIds);
      for (const e of pool) {
        if (seen.has(e.food.id) || !want.has(e.food.cat)) continue;
        hits.push({ e, rank: RANK_CATEGORY, dist: 0 });
        seen.add(e.food.id);
      }
    }
  }

  hits.sort(
    (a, b) =>
      a.rank - b.rank || a.dist - b.dist || a.e.food.name.length - b.e.food.name.length || a.e.order - b.e.order,
  );
  return hits.slice(0, limit).map((x) => x.e.food);
}
