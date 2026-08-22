import { describe, expect, it } from "vitest";
import { displayToCm, displayToKg, displayToMl, fmtHeight, uniqueGlassAmounts } from "./units";

describe("units", () => {
  it("rounds imperial conversions instead of storing long floats", () => {
    const kg = displayToKg(150, "imp");
    expect(String(kg)).not.toMatch(/\d{6,}/);
    expect(kg).toBe(68.04);
    expect(displayToCm(69, "imp")).toBe(175.3);
    expect(displayToMl(8, "imp")).toBe(237);
  });

  it("formats imperial height as feet and inches", () => {
    expect(fmtHeight(175.26, "imp")).toBe("5'9\"");
    expect(fmtHeight(175, "met")).toBe("175 cm");
  });
});

describe("uniqueGlassAmounts", () => {
  it("keeps all three when the custom glass size differs from the presets", () => {
    expect(uniqueGlassAmounts(250)).toEqual([250, 200, 500]);
  });

  it("does not repeat the custom size when it matches a preset", () => {
    expect(uniqueGlassAmounts(200)).toEqual([200, 500]);
    expect(uniqueGlassAmounts(500)).toEqual([500, 200]);
  });
});
