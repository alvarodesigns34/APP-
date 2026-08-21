import { describe, expect, it } from "vitest";
import { MACRO_PRESETS, clampMacroPct, macrosFromKcal, pctForPreset } from "./domain";
import { migrate } from "./persist";

describe("macrosFromKcal", () => {
  it("uses 25/45/30 by default", () => {
    const m = macrosFromKcal(2000);
    expect(m.prot).toBe(Math.round((2000 * 0.25) / 4));
    expect(m.carb).toBe(Math.round((2000 * 0.45) / 4));
    expect(m.fat).toBe(Math.round((2000 * 0.3) / 9));
  });

  it("keto 2000 kcal", () => {
    const m = macrosFromKcal(2000, pctForPreset("keto"));
    expect(m.fat).toBe(Math.round((2000 * 0.75) / 9));
    expect(m.carb).toBe(Math.round((2000 * 0.05) / 4));
    expect(m.prot).toBe(Math.round((2000 * 0.2) / 4));
  });

  it("alto-prot 2000 kcal", () => {
    const m = macrosFromKcal(2000, pctForPreset("alto-prot"));
    expect(m.prot).toBe(Math.round((2000 * 0.4) / 4));
    expect(m.carb).toBe(Math.round((2000 * 0.35) / 4));
    expect(m.fat).toBe(Math.round((2000 * 0.25) / 9));
  });
});

describe("macro presets", () => {
  it("percents of a preset sum 100", () => {
    for (const p of MACRO_PRESETS) {
      expect(p.pct.prot + p.pct.carb + p.pct.fat).toBe(100);
    }
  });

  it("clampMacroPct keeps a 100% split", () => {
    expect(clampMacroPct({ prot: 40, carb: 40, fat: 30 })).toEqual({ prot: 40, carb: 30, fat: 30 });
    const overflow = clampMacroPct({ prot: 80, carb: 10, fat: 50 }, "prot");
    expect(overflow.prot + overflow.carb + overflow.fat).toBe(100);
    expect(overflow.prot).toBe(80);
  });
});

describe("migrate macro preset", () => {
  it("missing preset falls back to equilibrado", () => {
    const s = migrate({});
    expect(s.settings.macroPreset).toBe("equilibrado");
    expect(s.settings.macroPct).toEqual({ prot: 25, carb: 45, fat: 30 });
  });

  it("garbage preset falls back to equilibrado", () => {
    const s = migrate({
      settings: { macroPreset: "nope", macroPct: { prot: 1, carb: 2, fat: 3 } },
    });
    expect(s.settings.macroPreset).toBe("equilibrado");
    expect(s.settings.macroPct).toEqual({ prot: 25, carb: 45, fat: 30 });
  });

  it("keeps keto and fills official split", () => {
    const s = migrate({ settings: { macroPreset: "keto" } });
    expect(s.settings.macroPreset).toBe("keto");
    expect(s.settings.macroPct).toEqual({ prot: 20, carb: 5, fat: 75 });
  });
});
