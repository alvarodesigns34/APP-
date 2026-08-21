import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SEARCH_PREFS,
  SEARCH_PREFS_KEY,
  loadSearchPrefs,
  parseSearchPrefs,
  rememberQuery,
  saveSearchPrefs,
} from "./search-prefs";

describe("rememberQuery", () => {
  it("puts newest first", () => {
    expect(rememberQuery(["manzana", "pan"], "yogur")).toEqual(["yogur", "manzana", "pan"]);
  });

  it("dedupes case-insensitively and keeps newest casing", () => {
    expect(rememberQuery(["Pollo", "arroz"], "pollo")).toEqual(["pollo", "arroz"]);
    expect(rememberQuery(["pollo asado", "pan"], "POLLO ASADO")).toEqual(["POLLO ASADO", "pan"]);
  });

  it("trims and collapses internal whitespace", () => {
    expect(rememberQuery([], "  pollo   asado  ")).toEqual(["pollo asado"]);
  });

  it("ignores queries shorter than 2 after normalize", () => {
    const prev = ["pan"];
    expect(rememberQuery(prev, "a")).toBe(prev);
    expect(rememberQuery(prev, "  a  ")).toBe(prev);
    expect(rememberQuery(prev, " ")).toBe(prev);
    expect(rememberQuery(prev, "")).toBe(prev);
    expect(rememberQuery([], "ab")).toEqual(["ab"]);
  });

  it("caps at max (default 8)", () => {
    const eight = ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8"];
    expect(rememberQuery(eight, "nuevo")).toEqual(["nuevo", "a1", "a2", "a3", "a4", "a5", "a6", "a7"]);
    expect(rememberQuery(["x", "y", "z"], "ww", 2)).toEqual(["ww", "x"]);
  });
});

describe("parseSearchPrefs", () => {
  it("returns defaults for garbage", () => {
    expect(parseSearchPrefs(null)).toEqual(DEFAULT_SEARCH_PREFS);
    expect(parseSearchPrefs(undefined)).toEqual(DEFAULT_SEARCH_PREFS);
    expect(parseSearchPrefs("nope")).toEqual(DEFAULT_SEARCH_PREFS);
    expect(parseSearchPrefs(1)).toEqual(DEFAULT_SEARCH_PREFS);
    expect(parseSearchPrefs([])).toEqual(DEFAULT_SEARCH_PREFS);
  });

  it("parses valid prefs and drops bad fields", () => {
    expect(parseSearchPrefs({ queries: ["pollo", "pan"], cat: "carne" })).toEqual({
      queries: ["pollo", "pan"],
      cat: "carne",
    });
    expect(parseSearchPrefs({ queries: ["ok", 1, null, "", "arroz"], cat: null })).toEqual({
      queries: ["ok", "arroz"],
      cat: null,
    });
    expect(parseSearchPrefs({ queries: "nope", cat: 3 })).toEqual({ queries: [], cat: null });
    expect(parseSearchPrefs({})).toEqual({ queries: [], cat: null });
  });
});

describe("save/load", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns defaults when localStorage is missing", () => {
    expect(loadSearchPrefs()).toEqual(DEFAULT_SEARCH_PREFS);
    expect(() => saveSearchPrefs({ queries: ["x"], cat: "fruta" })).not.toThrow();
  });

  it("roundtrips through localStorage", () => {
    const map = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
      removeItem: (k: string) => {
        map.delete(k);
      },
    });
    const prefs = { queries: ["pollo asado", "yogur"], cat: "lacteos" };
    saveSearchPrefs(prefs);
    expect(map.get(SEARCH_PREFS_KEY)).toBe(JSON.stringify(prefs));
    expect(loadSearchPrefs()).toEqual(prefs);
  });

  it("load returns defaults for corrupt JSON", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => "{not json",
      setItem: () => {},
    });
    expect(loadSearchPrefs()).toEqual(DEFAULT_SEARCH_PREFS);
  });

  it("save swallows storage errors", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    });
    expect(() => saveSearchPrefs({ queries: ["x"], cat: null })).not.toThrow();
  });
});
