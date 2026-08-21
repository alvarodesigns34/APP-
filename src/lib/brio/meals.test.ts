import { describe, expect, it } from "vitest";
import { habitualMeals, mealSignature } from "./meals";
import { addDays, todayKey } from "./dates";
import { defaultState, emptyDay } from "./persist";
import type { MealEntry } from "./types";

function entry(foodId: string, name = foodId): MealEntry {
  return {
    id: `e-${foodId}`,
    foodId,
    name,
    qty: 1,
    unitName: "g",
    grams: 100,
    kcal: 100,
    prot: 10,
    carb: 10,
    fat: 2,
    fib: 1,
    sug: null,
    sat: null,
    sod: null,
  };
}

describe("mealSignature", () => {
  it("includes the meal slot so breakfast and dinner with the same foods stay distinct", () => {
    const foods = [entry("manzana"), entry("yogur")];
    expect(mealSignature("desayuno", foods)).not.toBe(mealSignature("cena", foods));
    expect(mealSignature("desayuno", foods)).toMatch(/^desayuno:/);
  });
});

describe("habitualMeals", () => {
  it("does not collapse the same foods logged at breakfast and dinner", () => {
    const s = defaultState();
    const a = addDays(todayKey(), -3);
    const b = addDays(todayKey(), -2);
    const foods = [entry("avena", "Avena"), entry("leche", "Leche")];
    for (const k of [a, b]) {
      const d = emptyDay();
      d.meals.desayuno = foods.map((e) => ({ ...e, id: `${k}-d-${e.foodId}` }));
      d.meals.cena = foods.map((e) => ({ ...e, id: `${k}-c-${e.foodId}` }));
      s.days[k] = d;
    }
    const habits = habitualMeals(s, 10);
    const breakfast = habits.filter((h) => h.meal === "desayuno");
    const dinner = habits.filter((h) => h.meal === "cena");
    expect(breakfast.length).toBeGreaterThanOrEqual(1);
    expect(dinner.length).toBeGreaterThanOrEqual(1);
  });
});
