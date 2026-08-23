import { describe, expect, it } from "vitest";
import { addDays, dateOf, todayKey } from "./dates";
import { bmr, macrosFromKcal, targetKcal, tdee } from "./domain";
import { defaultState, emptyDay } from "./persist";
import { fastingStatus, kcalGoalFor, latestWeight, macroGoalsFor, weeklyInsights } from "./selectors";
import { scaleMacros } from "./scale-macros";
import type { Food } from "./types";

describe("weeklyInsights water average", () => {
  it("divides water by days with a log, not by 7", () => {
    const s = defaultState();
    const today = todayKey();
    const a = emptyDay();
    a.water = [{ id: "w1", t: 1, ml: 2000 }];
    const b = emptyDay();
    b.water = [{ id: "w2", t: 1, ml: 2000 }];
    s.days[today] = a;
    s.days[addDays(today, -1)] = b;
    const text = weeklyInsights(s).join(" ");
    // 4000 ml over the two days that have a log, not over all 7 (which would
    // be 571). Grouped the Spanish way, like every other figure in the app.
    expect(text).toMatch(/2\.000 ml/);
    expect(text).toMatch(/días con registro/);
    expect(text).not.toMatch(/571 ml/);
  });
});

describe("weeklyInsights sleep average", () => {
  it("writes the average with a Spanish decimal comma", () => {
    const s = defaultState();
    const today = todayKey();
    // 7 h 30 min: the only figure in the recap that is not a whole number.
    const night = emptyDay();
    night.sleep = { bed: 23 * 60, wake: 6 * 60 + 30 };
    s.days[today] = night;
    const text = weeklyInsights(s).join(" ");
    expect(text).toMatch(/de media 7,5 h/);
    expect(text).not.toMatch(/7\.5 h/);
  });
});

describe("latestWeight as of a date", () => {
  it("uses the weight valid on that date, not the newest absolute", () => {
    const s = defaultState();
    s.profile.weight = 70;
    s.weights = [
      { date: "2026-01-01", kg: 80 },
      { date: "2026-01-20", kg: 78 },
      { date: "2026-02-01", kg: 76 },
    ];
    expect(latestWeight(s, "2026-01-10")?.kg).toBe(80);
    expect(latestWeight(s, "2026-01-20")?.kg).toBe(78);
    expect(latestWeight(s, "2026-02-10")?.kg).toBe(76);
  });
});

describe("fastingStatus 16:8 windows", () => {
  const id = "16-8" as const;
  it("morning fast, before the eating window", () => {
    const st = fastingStatus(id, 8 * 60);
    expect(st).not.toBeNull();
    expect(st!.eating).toBe(false);
  });
  it("midday eating window", () => {
    const st = fastingStatus(id, 14 * 60);
    expect(st).not.toBeNull();
    expect(st!.eating).toBe(true);
  });
  it("evening fast, after the window closes", () => {
    const st = fastingStatus(id, 21 * 60);
    expect(st).not.toBeNull();
    expect(st!.eating).toBe(false);
  });
  it("overnight fast, after midnight", () => {
    const st = fastingStatus(id, 2 * 60);
    expect(st).not.toBeNull();
    expect(st!.eating).toBe(false);
  });
});

describe("energy math", () => {
  it("bmr / tdee / targetKcal stay consistent", () => {
    const b = bmr("h", 80, 180, 30);
    expect(b).toBe(Math.round(10 * 80 + 6.25 * 180 - 5 * 30 + 5));
    const t = tdee(b, "lig");
    expect(t).toBe(Math.round(b * 1.375));
    const goal = targetKcal(t, "mantener", "h");
    expect(goal.kcal).toBeGreaterThanOrEqual(1500);
  });

  it("scaleMacros is linear in grams", () => {
    const food = {
      kcal: 100,
      prot: 10,
      carb: 20,
      fat: 5,
      fib: 2,
      sug: 1,
      sat: 1,
      sod: 10,
    } as Pick<Food, "kcal" | "prot" | "carb" | "fat" | "fib" | "sug" | "sat" | "sod">;
    const half = scaleMacros(food, 50);
    expect(half.kcal).toBe(50);
    expect(half.prot).toBe(5);
  });

  it("macrosFromKcal uses 25/45/30", () => {
    const m = macrosFromKcal(2000);
    expect(m.prot).toBe(Math.round((2000 * 0.25) / 4));
    expect(m.carb).toBe(Math.round((2000 * 0.45) / 4));
    expect(m.fat).toBe(Math.round((2000 * 0.3) / 9));
  });
});

describe("macroGoalsFor follows the weekday plan like kcalGoalFor", () => {
  it("returns the flat goal when the weekday plan is off", () => {
    const s = defaultState();
    s.goals = { ...s.goals, kcal: 2000, prot: 125, carb: 225, fat: 67 };
    s.settings.weekdayPlan = { enabled: false, training: [false, true, true, true, true, true, false] };
    const key = todayKey();
    expect(macroGoalsFor(s, key)).toEqual({ prot: 125, carb: 225, fat: 67 });
  });

  it("scales macros with the same weekday kcal that kcalGoalFor uses", () => {
    const s = defaultState();
    s.goals = { ...s.goals, kcal: 2000, prot: 125, carb: 225, fat: 67 };
    s.settings.macroPct = { prot: 25, carb: 45, fat: 30 };
    s.settings.weekdayPlan = { enabled: true, training: [false, true, true, true, true, true, false] };
    s.settings.activityAdjust = false;
    const key = todayKey();
    const dayKcal = kcalGoalFor(s, key);
    const mg = macroGoalsFor(s, key);
    expect(mg).toEqual(macrosFromKcal(dayKcal, s.settings.macroPct));
    // A training day (weekday plan on) should not silently keep the flat base macros.
    if (s.settings.weekdayPlan.training[dateOf(key).getDay()] !== undefined && dayKcal !== 2000) {
      expect(mg).not.toEqual({ prot: 125, carb: 225, fat: 67 });
    }
  });

  it("does not fold the activity-kcal bonus into macro grams", () => {
    const s = defaultState();
    s.goals = { ...s.goals, kcal: 2000, prot: 125, carb: 225, fat: 67 };
    s.settings.weekdayPlan = { enabled: false, training: [false, true, true, true, true, true, false] };
    s.settings.activityAdjust = true;
    const key = todayKey();
    s.days[key] = { ...emptyDay(), steps: 12000 };
    expect(kcalGoalFor(s, key)).toBeGreaterThan(2000);
    expect(macroGoalsFor(s, key)).toEqual({ prot: 125, carb: 225, fat: 67 });
  });
});
