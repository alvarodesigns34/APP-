import { describe, expect, it } from "vitest";
import { compareWeeks, delta, isWeekEmpty, weekTotals, type WeekTotals } from "./week-compare";

const KEYS = ["a", "b", "c", "d", "e", "f", "g"];
const zeroFood = () => ({ kcal: 0, prot: 0 });
const zero = () => 0;

const emptyWeek: WeekTotals = { kcalAvg: 0, protAvg: 0, stepsAvg: 0, moveMin: 0, foodDays: 0 };

describe("weekTotals", () => {
  it("empty weeks are all zeros", () => {
    expect(weekTotals(KEYS, zeroFood, zero, zero)).toEqual(emptyWeek);
    expect(weekTotals([], zeroFood, zero, zero)).toEqual(emptyWeek);
  });

  it("kcal/prot average only days with kcal>0; a week without food is 0", () => {
    const food: Record<string, { kcal: number; prot: number }> = {
      a: { kcal: 2000, prot: 100 },
      c: { kcal: 1800, prot: 120 },
      d: { kcal: 0, prot: 50 },
    };
    const withFood = weekTotals(KEYS, (k) => food[k] ?? { kcal: 0, prot: 0 }, zero, zero);
    expect(withFood.foodDays).toBe(2);
    expect(withFood.kcalAvg).toBe(1900);
    expect(withFood.protAvg).toBe(110);

    const withoutFood = weekTotals(
      KEYS,
      zeroFood,
      () => 8000,
      () => 45,
    );
    expect(withoutFood.foodDays).toBe(0);
    expect(withoutFood.kcalAvg).toBe(0);
    expect(withoutFood.protAvg).toBe(0);
  });

  it("steps average 0-fills all 7 days (missing days count as 0)", () => {
    const t = weekTotals(KEYS, zeroFood, (k) => (k === "a" ? 7000 : 0), zero);
    expect(t.stepsAvg).toBe(1000);
  });

  it("move is the sum of minutes, not the mean", () => {
    const t = weekTotals(KEYS, zeroFood, zero, (k) => (k === "a" || k === "b" ? 30 : 0));
    expect(t.moveMin).toBe(60);
    expect(t.moveMin).not.toBe(60 / 7);
  });
});

describe("delta", () => {
  it("pct is null when prev is 0", () => {
    expect(delta(240, 0)).toEqual({ abs: 240, pct: null, dir: "up" });
    expect(delta(0, 0)).toEqual({ abs: 0, pct: null, dir: "flat" });
  });

  it("is flat when equal and when abs rounds to 0", () => {
    expect(delta(100, 100)).toEqual({ abs: 0, pct: 0, dir: "flat" });
    expect(delta(100.4, 100).dir).toBe("flat");
  });

  it("pct is (curr-prev)/prev*100 rounded to 0 decimals", () => {
    expect(delta(110, 100)).toEqual({ abs: 10, pct: 10, dir: "up" });
    expect(delta(88, 100)).toEqual({ abs: -12, pct: -12, dir: "down" });
    expect(delta(100.4, 100).pct).toBe(0);
  });
});

describe("compareWeeks", () => {
  it("one week with food vs one without: pct null, current up", () => {
    const curr: WeekTotals = { kcalAvg: 2000, protAvg: 120, stepsAvg: 5000, moveMin: 40, foodDays: 5 };
    const prev = emptyWeek;
    const c = compareWeeks(curr, prev);
    expect(c.kcal).toEqual({ abs: 2000, pct: null, dir: "up" });
    expect(c.prot).toEqual({ abs: 120, pct: null, dir: "up" });
    expect(c.steps).toEqual({ abs: 5000, pct: null, dir: "up" });
    expect(c.move).toEqual({ abs: 40, pct: null, dir: "up" });
  });

  it("is flat across metrics when weeks are equal", () => {
    const w: WeekTotals = { kcalAvg: 1900, protAvg: 110, stepsAvg: 8000, moveMin: 90, foodDays: 6 };
    const c = compareWeeks(w, w);
    expect(c.kcal).toEqual({ abs: 0, pct: 0, dir: "flat" });
    expect(c.prot).toEqual({ abs: 0, pct: 0, dir: "flat" });
    expect(c.steps).toEqual({ abs: 0, pct: 0, dir: "flat" });
    expect(c.move).toEqual({ abs: 0, pct: 0, dir: "flat" });
  });
});

describe("isWeekEmpty", () => {
  it("is true only when food, steps and move are all zero", () => {
    expect(isWeekEmpty(emptyWeek)).toBe(true);
    expect(isWeekEmpty({ ...emptyWeek, foodDays: 1 })).toBe(false);
    expect(isWeekEmpty({ ...emptyWeek, stepsAvg: 500 })).toBe(false);
    expect(isWeekEmpty({ ...emptyWeek, moveMin: 20 })).toBe(false);
  });

  it("flags a week with no logs yet even when the other week is not empty", () => {
    // This is what stops the UI from showing a misleading "-100%" for a
    // current week that simply has no data logged yet.
    const withData: WeekTotals = { kcalAvg: 1800, protAvg: 100, stepsAvg: 6000, moveMin: 60, foodDays: 5 };
    expect(isWeekEmpty(emptyWeek)).toBe(true);
    expect(isWeekEmpty(withData)).toBe(false);
  });
});
