import { describe, expect, it } from "vitest";
import { migrate } from "./persist";
import { DEFAULT_REMINDERS } from "./reminders";
import { DEFAULT_WEEKDAY_PLAN } from "./weekday-goals";

describe("migrate", () => {
  it("returns defaults for garbage input", () => {
    const s = migrate("not json object");
    expect(s.profile.weight).toBe(70);
    expect(s.customFoods).toEqual([]);
    expect(s.recipes).toEqual([]);
    expect(s.favorites).toEqual([]);
  });

  it("drops malformed customFoods, recipes and id lists", () => {
    const s = migrate({
      customFoods: [
        null,
        1,
        { id: "bad" },
        {
          id: "ok",
          name: "Yogur",
          cat: "propio",
          kcal: 80,
          prot: 4,
          carb: 6,
          fat: 3,
          fib: 0,
          sug: null,
          sat: null,
          sod: null,
          units: [{ name: "unidad", g: 125 }],
          base: "g",
          barcode: " 3017 6204 2200 3 ",
        },
      ],
      recipes: [
        "nope",
        { id: "r1" },
        {
          id: "r-ok",
          name: "Tostada",
          items: [{ foodId: "pan", grams: 40 }],
          servings: 1,
          servingG: 40,
          per100: { kcal: 250, prot: 8, carb: 40, fat: 4, fib: 3 },
        },
      ],
      favorites: [1, "f1", null, ""],
      favRecipes: ["rec-1", 4],
      pantry: { salt: true },
      recents: ["a", "b", 3],
    });
    expect(s.customFoods).toHaveLength(1);
    expect(s.customFoods[0].id).toBe("ok");
    expect(s.customFoods[0].barcode).toBe("3017620422003");
    expect(s.recipes).toHaveLength(1);
    expect(s.recipes[0].id).toBe("r-ok");
    expect(s.favorites).toEqual(["f1"]);
    expect(s.favRecipes).toEqual(["rec-1"]);
    expect(s.pantry).toEqual([]);
    expect(s.recents).toEqual(["a", "b"]);
  });

  it("fills reminder defaults when migrating an old save and keeps the rest", () => {
    const s = migrate({
      onboarded: true,
      profile: {
        name: "Ana",
        sex: "m",
        birth: "1990-01-01",
        height: 160,
        weight: 58,
        activity: "mod",
        purpose: "perder",
      },
      settings: { theme: "dark", units: "imp", glass: 300, pantryBasics: false },
      goals: { kcal: 1800, water: 2200 },
      weights: [{ date: "2026-08-20", kg: 58 }],
      favorites: ["manzana"],
    });
    expect(s.onboarded).toBe(true);
    expect(s.profile.name).toBe("Ana");
    expect(s.profile.weight).toBe(58);
    expect(s.settings.theme).toBe("dark");
    expect(s.settings.units).toBe("imp");
    expect(s.settings.glass).toBe(300);
    expect(s.settings.pantryBasics).toBe(false);
    expect(s.goals.kcal).toBe(1800);
    expect(s.goals.water).toBe(2200);
    expect(s.weights).toEqual([{ date: "2026-08-20", kg: 58 }]);
    expect(s.favorites).toEqual(["manzana"]);
    expect(s.settings.reminders).toEqual(DEFAULT_REMINDERS);
    expect(s.settings.reminders.enabled).toBe(false);
  });

  it("replaces garbage reminders with defaults", () => {
    const s = migrate({
      settings: { theme: "light", reminders: "nope" },
    });
    expect(s.settings.theme).toBe("light");
    expect(s.settings.reminders).toEqual(DEFAULT_REMINDERS);
  });

  it("fills weekdayPlan defaults when migrating an old save", () => {
    const s = migrate({
      onboarded: true,
      settings: { theme: "dark" },
    });
    expect(s.settings.weekdayPlan).toEqual(DEFAULT_WEEKDAY_PLAN);
    expect(s.settings.weekdayPlan.enabled).toBe(false);
    expect(s.settings.weekdayPlan.training).toEqual([false, true, true, true, true, true, false]);
  });

  it("parses weekdayPlan from a save", () => {
    const training = [true, false, false, false, false, false, true];
    const s = migrate({
      settings: { weekdayPlan: { enabled: true, training } },
    });
    expect(s.settings.weekdayPlan.enabled).toBe(true);
    expect(s.settings.weekdayPlan.training).toEqual(training);
  });

  it("replaces garbage weekdayPlan with defaults", () => {
    const s = migrate({
      settings: { theme: "light", weekdayPlan: "nope" },
    });
    expect(s.settings.theme).toBe("light");
    expect(s.settings.weekdayPlan).toEqual(DEFAULT_WEEKDAY_PLAN);
  });

  describe("activityAdjust", () => {
    it("defaults a save from before this setting existed to off, not the new-install default", () => {
      const s = migrate({ settings: { theme: "dark", units: "imp" } });
      expect(s.settings.activityAdjust).toBe(false);
    });

    it("respects an explicit false the same save already had", () => {
      const s = migrate({ settings: { activityAdjust: false } });
      expect(s.settings.activityAdjust).toBe(false);
    });

    it("respects an explicit true the same save already had", () => {
      const s = migrate({ settings: { activityAdjust: true } });
      expect(s.settings.activityAdjust).toBe(true);
    });

    it("treats garbage as absent and defaults to off", () => {
      const s = migrate({ settings: { activityAdjust: "yes" } });
      expect(s.settings.activityAdjust).toBe(false);
    });
  });

  describe("workouts", () => {
    it("drops malformed workout entries and keeps valid ones", () => {
      const s = migrate({
        days: {
          "2026-08-22": {
            workouts: [
              null,
              "nope",
              { id: "w1" },
              { id: "w2", type: "correr", min: -5, intensity: "media", kcal: 300 },
              { id: "w3", type: "correr", min: 30, intensity: "rara", kcal: 300 },
              { id: "w4", type: "correr", min: 30, intensity: "alta", kcal: 300 },
            ],
          },
        },
      });
      const workouts = s.days["2026-08-22"].workouts;
      expect(workouts).toHaveLength(1);
      expect(workouts[0]).toEqual({ id: "w4", type: "correr", min: 30, intensity: "alta", kcal: 300 });
    });
  });
});
