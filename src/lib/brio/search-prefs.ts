export const SEARCH_PREFS_KEY = "brio.search-prefs";

export type SearchPrefs = { queries: string[]; cat: string | null };

export const DEFAULT_SEARCH_PREFS: SearchPrefs = { queries: [], cat: null };

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function parseSearchPrefs(raw: unknown): SearchPrefs {
  if (!isObj(raw)) return { queries: [], cat: null };
  const queries = Array.isArray(raw.queries)
    ? raw.queries.filter((x): x is string => typeof x === "string" && x.length > 0)
    : [];
  const cat = typeof raw.cat === "string" ? raw.cat : null;
  return { queries, cat };
}

export function rememberQuery(queries: string[], q: string, max = 8): string[] {
  const normalized = q.trim().replace(/\s+/g, " ");
  if (normalized.length < 2) return queries;
  const key = normalized.toLowerCase();
  const next = [normalized, ...queries.filter((item) => item.toLowerCase() !== key)];
  return next.slice(0, max);
}

export function loadSearchPrefs(): SearchPrefs {
  if (typeof localStorage === "undefined") return { queries: [], cat: null };
  try {
    const raw = localStorage.getItem(SEARCH_PREFS_KEY);
    if (!raw) return { queries: [], cat: null };
    return parseSearchPrefs(JSON.parse(raw));
  } catch {
    return { queries: [], cat: null };
  }
}

export function saveSearchPrefs(p: SearchPrefs): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(SEARCH_PREFS_KEY, JSON.stringify(p));
  } catch {
    /* quota / private mode */
  }
}
