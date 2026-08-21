import { describe, expect, it } from "vitest";
import { addDays } from "./dates";
import { energySplit, lastLogged, recipesUsingFood } from "./food-detail";
import { emptyDay } from "./persist";
import type { MealEntry, MealId } from "./types";

function entry(foodId: string, over: Partial<MealEntry> = {}): MealEntry {
  return {
    id: `e-${foodId}`,
    foodId,
    name: foodId,
    qty: 1,
    unitName: "g",
    grams: 100,
    kcal: 120,
    prot: 10,
    carb: 10,
    fat: 4,
    fib: 1,
    sug: null,
    sat: null,
    sod: null,
    ...over,
  };
}

function dayWith(meal: MealId, ...entries: MealEntry[]) {
  const d = emptyDay();
  d.meals[meal] = entries;
  return d;
}

describe("energySplit", () => {
  it("returns zeros when kcal is 0", () => {
    expect(energySplit({ kcal: 0, prot: 10, carb: 20, fat: 5 })).toEqual({ prot: 0, carb: 0, fat: 0 });
  });

  it("returns zeros when macros contribute no energy", () => {
    expect(energySplit({ kcal: 12, prot: 0, carb: 0, fat: 0 })).toEqual({ prot: 0, carb: 0, fat: 0 });
  });

  it("rounds to whole percents that sum 100", () => {
    const s = energySplit({ kcal: 165, prot: 31, carb: 0, fat: 3.6 });
    expect(s.prot + s.carb + s.fat).toBe(100);
    expect(s.prot).toBeGreaterThan(70);
    expect(s.carb).toBe(0);
  });

  it("splits an even mix so the three percents sum 100", () => {
    const s = energySplit({ kcal: 300, prot: 25, carb: 25, fat: 100 / 9 });
    expect(s.prot + s.carb + s.fat).toBe(100);
    expect(s.prot).toBeGreaterThanOrEqual(33);
    expect(s.carb).toBeGreaterThanOrEqual(33);
    expect(s.fat).toBeGreaterThanOrEqual(33);
  });

  it("gives 100% to a single macro", () => {
    expect(energySplit({ kcal: 120, prot: 30, carb: 0, fat: 0 })).toEqual({ prot: 100, carb: 0, fat: 0 });
    expect(energySplit({ kcal: 80, prot: 0, carb: 20, fat: 0 })).toEqual({ prot: 0, carb: 100, fat: 0 });
    expect(energySplit({ kcal: 90, prot: 0, carb: 0, fat: 10 })).toEqual({ prot: 0, carb: 0, fat: 100 });
  });
});

describe("recipesUsingFood", () => {
  const recipes = [
    { id: "r1", name: "Tortilla", items: [{ foodId: "huevo" }, { foodId: "patata" }] },
    { id: "r2", name: "Revuelto", items: [{ foodId: "huevo" }, { foodId: "huevo" }] },
    { id: "r3", name: "Gazpacho", items: [{ foodId: "tomate" }] },
    { id: "r1", name: "Tortilla duplicada", items: [{ foodId: "huevo" }] },
  ];

  it("returns an empty list when nothing uses the food", () => {
    expect(recipesUsingFood("leche", recipes)).toEqual([]);
    expect(recipesUsingFood("huevo", [])).toEqual([]);
  });

  it("preserves recipe order and keeps ids unique", () => {
    expect(recipesUsingFood("huevo", recipes)).toEqual([
      { id: "r1", name: "Tortilla" },
      { id: "r2", name: "Revuelto" },
    ]);
  });
});

describe("lastLogged", () => {
  const today = "2026-08-22";

  it("returns null when the food was never logged", () => {
    expect(lastLogged({}, "manzana", today)).toBeNull();
    const days = { [today]: dayWith("comida", entry("pan")) };
    expect(lastLogged(days, "manzana", today)).toBeNull();
  });

  it("finds the newest log scanning from today backwards", () => {
    const older = addDays(today, -5);
    const newer = addDays(today, -1);
    const days = {
      [older]: dayWith("cena", entry("manzana", { grams: 80, kcal: 40 })),
      [newer]: dayWith("desayuno", entry("manzana", { grams: 180, kcal: 90 })),
      [addDays(today, -2)]: dayWith("comida", entry("pan")),
    };
    expect(lastLogged(days, "manzana", today)).toEqual({
      date: newer,
      meal: "desayuno",
      grams: 180,
      kcal: 90,
    });
  });

  it("prefers today over an older day", () => {
    const days = {
      [today]: dayWith("snack", entry("yogur", { grams: 125, kcal: 80 })),
      [addDays(today, -1)]: dayWith("comida", entry("yogur", { grams: 200, kcal: 130 })),
    };
    expect(lastLogged(days, "yogur", today)).toEqual({
      date: today,
      meal: "snack",
      grams: 125,
      kcal: 80,
    });
  });

  it("ignores logs older than 90 days", () => {
    const inside = addDays(today, -89);
    const outside = addDays(today, -90);
    const days = {
      [outside]: dayWith("comida", entry("arroz", { grams: 200, kcal: 260 })),
      [inside]: dayWith("cena", entry("arroz", { grams: 150, kcal: 195 })),
    };
    expect(lastLogged(days, "arroz", today)).toEqual({
      date: inside,
      meal: "cena",
      grams: 150,
      kcal: 195,
    });
    expect(lastLogged({ [outside]: days[outside]! }, "arroz", today)).toBeNull();
  });
});
