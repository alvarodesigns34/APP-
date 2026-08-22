import { describe, expect, it } from "vitest";
import { nf, parseNum, parsePositive, plural } from "./format";

describe("nf", () => {
  it("groups thousands with dots and uses a comma for decimals", () => {
    expect(nf(1234567)).toBe("1.234.567");
    expect(nf(2200)).toBe("2.200");
    expect(nf(12.34, 2)).toBe("12,34");
    expect(nf(-1500)).toBe("-1.500");
  });

  it("shows an em dash for nothing to show", () => {
    expect(nf(null)).toBe("—");
    expect(nf(undefined)).toBe("—");
    expect(nf(NaN)).toBe("—");
  });

  it("shows an em dash for Infinity instead of the literal word", () => {
    expect(nf(Infinity)).toBe("—");
    expect(nf(-Infinity)).toBe("—");
  });
});

describe("parsePositive", () => {
  it("accepts finite values above zero, comma decimals included", () => {
    expect(parsePositive("500")).toBe(500);
    expect(parsePositive("1,5")).toBe(1.5);
    expect(parsePositive(70)).toBe(70);
  });

  it("rejects zero and negatives, which parseNum happily returns", () => {
    expect(parseNum("-500")).toBe(-500);
    expect(parsePositive("-500")).toBeNaN();
    expect(parsePositive("0")).toBeNaN();
    expect(parsePositive("-0.1")).toBeNaN();
  });

  it("rejects garbage and empty input", () => {
    expect(parsePositive("")).toBeNaN();
    expect(parsePositive("   ")).toBeNaN();
    expect(parsePositive("abc")).toBeNaN();
    expect(parsePositive(null)).toBeNaN();
    expect(parsePositive(undefined)).toBeNaN();
  });

  it("is falsy for every rejected value, so `if (!n) return` guards hold", () => {
    for (const bad of ["-500", "0", "abc", "", null, undefined]) {
      expect(!parsePositive(bad)).toBe(true);
    }
  });
});

describe("plural", () => {
  it("uses the singular for exactly one", () => {
    expect(plural(1, "día", "días")).toBe("1 día");
    expect(plural(1, "sesión", "sesiones")).toBe("1 sesión");
    expect(plural(1, "registro", "registros")).toBe("1 registro");
  });

  it("uses the plural for everything else, zero included", () => {
    expect(plural(0, "día", "días")).toBe("0 días");
    expect(plural(2, "día", "días")).toBe("2 días");
    expect(plural(30, "sesión", "sesiones")).toBe("30 sesiones");
  });

  it("formats the count the same way nf does", () => {
    expect(plural(1234, "día", "días")).toBe("1.234 días");
  });
});
