import { describe, expect, it } from "vitest";
import { defaultState, emptyDay } from "./persist";
import { kcalGoalFor } from "./selectors";
import { DEFAULT_WEEKDAY_PLAN, MIN_DAY_KCAL, kcalForWeekday, parseWeekdayPlan } from "./weekday-goals";

const MON_FRI: boolean[] = [false, true, true, true, true, true, false];

function weekSum(base: number, training: boolean[]): number {
  let sum = 0;
  for (let d = 0; d < 7; d++) sum += kcalForWeekday(base, training, d);
  return sum;
}

describe("kcalForWeekday", () => {
  it("keeps the weekly sum equal to 7 * base with 5 training days", () => {
    const base = 2200;
    expect(weekSum(base, MON_FRI)).toBe(7 * base);
    expect(kcalForWeekday(base, MON_FRI, 1)).toBe(Math.round(base * 1.12));
  });

  it("returns baseKcal when every day is training or every day is rest", () => {
    const allOn = [true, true, true, true, true, true, true];
    const allOff = [false, false, false, false, false, false, false];
    expect(kcalForWeekday(2200, allOn, 1)).toBe(2200);
    expect(kcalForWeekday(2200, allOn, 0)).toBe(2200);
    expect(kcalForWeekday(1800, allOff, 3)).toBe(1800);
    expect(weekSum(2200, allOn)).toBe(7 * 2200);
  });

  it("gives Monday more kcal than Sunday on the default Mon–Fri plan", () => {
    const base = 2200;
    const monday = kcalForWeekday(base, MON_FRI, 1);
    const sunday = kcalForWeekday(base, MON_FRI, 0);
    expect(monday).toBe(Math.round(base * 1.12));
    expect(sunday).toBeLessThan(base);
    expect(monday).toBeGreaterThan(sunday);
  });

  it("puts leftover rest kcal on the last rest day (Saturday, not Sunday)", () => {
    const base = 2010;
    const trainingKcal = Math.round(base * 1.12);
    const restTotal = 7 * base - 5 * trainingKcal;
    expect(kcalForWeekday(base, MON_FRI, 1)).toBe(trainingKcal);
    const sunday = kcalForWeekday(base, MON_FRI, 0);
    const saturday = kcalForWeekday(base, MON_FRI, 6);
    // Rest days split `restTotal`; the remainder lands on Saturday, so it is the
    // larger of the two and the pair still adds up exactly.
    expect(saturday).toBeGreaterThanOrEqual(sunday);
    expect(sunday + saturday).toBe(restTotal);
    expect(weekSum(base, MON_FRI)).toBe(7 * base);
  });

  it("returns baseKcal for a training array that is not length 7", () => {
    expect(kcalForWeekday(2200, [true, false], 1)).toBe(2200);
    expect(kcalForWeekday(2200, [], 0)).toBe(2200);
  });

  it("keeps every day at or above the floor without breaking the weekly sum", () => {
    // Previously the split was allowed to push rest days under the floor to keep
    // the weekly total exact. Shrinking the training bonus satisfies both.
    for (const base of [1000, 1100, 1200, 1350, 1500]) {
      const days = [0, 1, 2, 3, 4, 5, 6].map((d) => kcalForWeekday(base, MON_FRI, d));
      expect(Math.min(...days)).toBeGreaterThanOrEqual(MIN_DAY_KCAL);
      expect(weekSum(base, MON_FRI)).toBe(7 * base);
    }
  });

  it("holds the floor even when almost every day is a training day", () => {
    const SIX_TRAINING: boolean[] = [true, true, true, true, true, true, false];
    const days = [0, 1, 2, 3, 4, 5, 6].map((d) => kcalForWeekday(1000, SIX_TRAINING, d));
    expect(Math.min(...days)).toBeGreaterThanOrEqual(MIN_DAY_KCAL);
    expect(weekSum(1000, SIX_TRAINING)).toBe(7000);
  });

  it("flattens instead of amplifying when the base is already under the floor", () => {
    const base = 900;
    for (let d = 0; d < 7; d++) expect(kcalForWeekday(base, MON_FRI, d)).toBe(base);
    expect(weekSum(base, MON_FRI)).toBe(7 * base);
  });
});

describe("parseWeekdayPlan", () => {
  it("returns defaults for garbage", () => {
    expect(parseWeekdayPlan(null)).toEqual(DEFAULT_WEEKDAY_PLAN);
    expect(parseWeekdayPlan("nope")).toEqual(DEFAULT_WEEKDAY_PLAN);
    expect(parseWeekdayPlan(1)).toEqual(DEFAULT_WEEKDAY_PLAN);
    expect(parseWeekdayPlan([])).toEqual(DEFAULT_WEEKDAY_PLAN);
  });

  it("does not mutate DEFAULT_WEEKDAY_PLAN", () => {
    const p = parseWeekdayPlan(null);
    p.training[0] = true;
    p.enabled = true;
    expect(DEFAULT_WEEKDAY_PLAN.enabled).toBe(false);
    expect(DEFAULT_WEEKDAY_PLAN.training[0]).toBe(false);
  });

  it("keeps a valid plan and fills a short training array from defaults", () => {
    expect(
      parseWeekdayPlan({
        enabled: true,
        training: [true, false, false, false, false, false, true],
      }),
    ).toEqual({
      enabled: true,
      training: [true, false, false, false, false, false, true],
    });
    expect(parseWeekdayPlan({ enabled: 1, training: [1, 0] })).toEqual({
      enabled: true,
      training: [...DEFAULT_WEEKDAY_PLAN.training],
    });
  });

  it("coerces training flags and ignores extra fields", () => {
    const p = parseWeekdayPlan({
      enabled: 0,
      training: [1, 0, "yes", null, true, false, 2],
      extra: true,
    });
    expect(p.enabled).toBe(false);
    expect(p.training).toEqual([true, false, true, false, true, false, true]);
    expect(p).not.toHaveProperty("extra");
  });
});

describe("kcalGoalFor weekday plan", () => {
  it("ignores the plan when disabled", () => {
    const s = defaultState();
    s.settings.activityAdjust = false;
    s.settings.weekdayPlan = { enabled: false, training: [...MON_FRI] };
    s.goals.kcal = 2200;
    expect(kcalGoalFor(s, "2026-08-24")).toBe(2200);
    expect(kcalGoalFor(s, "2026-08-23")).toBe(2200);
  });

  it("applies weekday kcal and still adds activity on top", () => {
    const s = defaultState();
    s.settings.activityAdjust = true;
    s.settings.weekdayPlan = { enabled: true, training: [...MON_FRI] };
    s.goals.kcal = 2200;
    const monday = emptyDay();
    monday.workouts = [{ id: "w1", type: "run", min: 30, intensity: "media", kcal: 300 }];
    s.days["2026-08-24"] = monday;
    expect(kcalGoalFor(s, "2026-08-24")).toBe(Math.round(2200 * 1.12) + 300);
    expect(kcalGoalFor(s, "2026-08-23")).toBe(kcalForWeekday(2200, MON_FRI, 0));
  });
});
