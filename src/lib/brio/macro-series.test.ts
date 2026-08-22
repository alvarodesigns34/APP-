import { describe, expect, it } from "vitest";
import { buildMacroSeries, loggedDayMean, niceCeil, DEFAULT_TREND_RANGE, MACRO_MA_MIN_POINTS, MACRO_MA_WINDOW, TREND_RANGES } from "./macro-series";

const GOALS = { kcal: 2200, prot: 138, carb: 248, fat: 73 };

function day(d: string, kcal: number, prot = 0, carb = 0, fat = 0) {
  return { d, kcal, prot, carb, fat };
}

describe("loggedDayMean", () => {
  it("skips kcal=0 days so zeros do not pull the average down", () => {
    const days = [day("1/1", 0), day("2/1", 2000), day("3/1", 0), day("4/1", 1800)];
    // Including zeros would be (0+2000+0+1800)/4 = 950.
    expect(loggedDayMean(days, 3, (x) => x.kcal)).toBe(1900);
    expect(loggedDayMean(days, 3, (x) => x.kcal)).not.toBe(950);
  });

  it("is null until there are ≥2 logged days (kcal>0) in the window", () => {
    const days = [day("1/1", 0), day("2/1", 2000), day("3/1", 0)];
    expect(MACRO_MA_MIN_POINTS).toBe(2);
    expect(loggedDayMean(days, 0, (x) => x.kcal)).toBeNull();
    expect(loggedDayMean(days, 1, (x) => x.kcal)).toBeNull();
    expect(loggedDayMean(days, 2, (x) => x.kcal)).toBeNull();
  });

  it("uses only the last 7 calendar days, not the whole series", () => {
    expect(MACRO_MA_WINDOW).toBe(7);
    const days = [
      day("1/1", 1000),
      day("2/1", 1000),
      day("3/1", 1000),
      day("4/1", 1000),
      day("5/1", 1000),
      day("6/1", 1000),
      day("7/1", 1000),
      day("8/1", 8000),
    ];
    // Window for last day is days 2..8 (1000×6 + 8000), not including day 1.
    expect(loggedDayMean(days, 7, (x) => x.kcal)).toBeCloseTo((1000 * 6 + 8000) / 7, 10);
    expect(loggedDayMean(days, 6, (x) => x.kcal)).toBe(1000);
  });
});

describe("buildMacroSeries", () => {
  it("keeps empty days at 0 and stamps a constant goal on every point", () => {
    const pts = buildMacroSeries([day("1/1", 0), day("2/1", 2000, 120, 200, 70)], GOALS);
    expect(pts[0].kcal).toBe(0);
    expect(pts[0].prot).toBe(0);
    expect(pts[0].carb).toBe(0);
    expect(pts[0].fat).toBe(0);
    expect(pts.every((p) => p.kcalGoal === 2200 && p.protGoal === 138 && p.carbGoal === 248 && p.fatGoal === 73)).toBe(
      true,
    );
  });

  it("protein/carb/fat MA uses days with kcal>0, even if that macro is 0", () => {
    const pts = buildMacroSeries([day("1/1", 1800, 100, 0, 80), day("2/1", 0), day("3/1", 2000, 140, 220, 0)], GOALS);
    expect(pts[2].protMa).toBeCloseTo((100 + 140) / 2, 10);
    expect(pts[2].carbMa).toBeCloseTo((0 + 220) / 2, 10);
    expect(pts[2].fatMa).toBeCloseTo((80 + 0) / 2, 10);
    expect(pts[2].kcalMa).toBeCloseTo((1800 + 2000) / 2, 10);
  });

  it("passes through extra fields (water, sleep, …) for the chart row", () => {
    const pts = buildMacroSeries(
      [
        { d: "1/1", kcal: 2000, prot: 100, carb: 200, fat: 70, water: 500 },
        { d: "2/1", kcal: 1800, prot: 120, carb: 180, fat: 60, water: 0 },
      ],
      GOALS,
    );
    expect(pts[0].water).toBe(500);
    expect(pts[1].water).toBe(0);
    expect(pts[1].kcalMa).toBe(1900);
  });

  it("exposes the 14 / 30 / 90 day chart ranges", () => {
    expect(TREND_RANGES).toEqual([14, 30, 90]);
    expect(DEFAULT_TREND_RANGE).toBe(14);
    const pts = buildMacroSeries(
      Array.from({ length: 30 }, (_, i) => day(`${i + 1}/1`, i % 2 ? 1800 : 0)),
      GOALS,
    );
    expect(pts).toHaveLength(30);
  });
});

describe("niceCeil", () => {
  it("rounds a max up to a readable ceiling", () => {
    expect(niceCeil(2440.8)).toBe(2500);
    expect(niceCeil(140.8)).toBe(150);
    expect(niceCeil(18.04)).toBe(20);
    expect(niceCeil(1)).toBe(1);
    expect(niceCeil(1.2)).toBe(1.5);
  });

  it("never returns a ceiling below the value it was given", () => {
    for (const v of [1, 7, 99, 100, 101, 999, 1001, 2440.8, 12345]) {
      expect(niceCeil(v)).toBeGreaterThanOrEqual(v);
    }
  });

  it("falls back to 1 for nothing to plot", () => {
    expect(niceCeil(0)).toBe(1);
    expect(niceCeil(-5)).toBe(1);
    expect(niceCeil(NaN)).toBe(1);
  });
});
