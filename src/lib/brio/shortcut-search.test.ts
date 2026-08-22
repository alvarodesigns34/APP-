import { describe, expect, it } from "vitest";
import { parseShortcutSearch, stripShortcutSearch } from "./shortcut-search";

describe("parseShortcutSearch", () => {
  it("maps agua / peso / log query flags", () => {
    expect(parseShortcutSearch("?agua=1")).toBe("water");
    expect(parseShortcutSearch("?peso=1")).toBe("weight");
    expect(parseShortcutSearch("?log=1")).toBe("food");
    expect(parseShortcutSearch("")).toBeNull();
    expect(parseShortcutSearch("?foo=1")).toBeNull();
  });
});

describe("stripShortcutSearch", () => {
  it("drops shortcut flags and keeps other params", () => {
    expect(stripShortcutSearch("?agua=1")).toBe("");
    expect(stripShortcutSearch("?log=1&x=2")).toBe("?x=2");
  });
});
