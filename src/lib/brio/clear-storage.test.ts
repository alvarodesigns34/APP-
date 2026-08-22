/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vitest";
import { clearAuxStorage } from "./persist";
import { AUX_STORE_KEYS, LEGACY_STORE_KEYS, STORE_KEY } from "./types";
import { SEARCH_PREFS_KEY } from "./search-prefs";

/**
 * `resetAll` rewrites STORE_KEY through `persist()`, which never touches the side
 * keys. "Borrar todos los datos" has to clear those too or the wipe silently
 * leaves the last search and the reminder bookkeeping behind.
 */
describe("clearAuxStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("removes every auxiliary and legacy key", () => {
    for (const k of AUX_STORE_KEYS) localStorage.setItem(k, "x");
    for (const k of LEGACY_STORE_KEYS) localStorage.setItem(k, "x");

    clearAuxStorage();

    for (const k of AUX_STORE_KEYS) expect(localStorage.getItem(k)).toBeNull();
    for (const k of LEGACY_STORE_KEYS) expect(localStorage.getItem(k)).toBeNull();
  });

  it("leaves the main store to resetAll", () => {
    localStorage.setItem(STORE_KEY, "main");
    clearAuxStorage();
    expect(localStorage.getItem(STORE_KEY)).toBe("main");
  });

  it("covers the key the search-prefs module actually writes", () => {
    // Guards against the two definitions drifting apart.
    expect(AUX_STORE_KEYS).toContain(SEARCH_PREFS_KEY);
  });
});
