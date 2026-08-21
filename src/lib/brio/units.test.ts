import { describe, expect, it } from "vitest";
import { displayToCm, displayToKg, displayToMl, fmtHeight } from "./units";

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
