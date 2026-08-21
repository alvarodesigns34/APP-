import { afterEach, describe, expect, it } from "vitest";
import { dayHasMeals, habitualMeals, mealEntryCount, mealSignature, recentDaysWithMeals } from "./meals";
import { addDays, todayKey } from "./dates";
import { defaultState, emptyDay } from "./persist";
import { useBrioStore } from "./store";
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

describe("recentDaysWithMeals", () => {
  it("returns the last 14 calendar days that have meals, newest first, skipping the target", () => {
    const end = "2026-08-22";
    const days: Record<string, ReturnType<typeof emptyDay>> = {};
    const withFood = emptyDay();
    withFood.meals.comida = [entry("pollo", "Pollo")];
    const waterOnly = emptyDay();
    waterOnly.water = [{ id: "w1", t: 1, ml: 250 }];
    days["2026-08-22"] = withFood;
    days["2026-08-21"] = withFood;
    days["2026-08-20"] = waterOnly;
    days["2026-08-18"] = withFood;
    days["2026-08-07"] = withFood; // 15 days back — outside the window
    const keys = recentDaysWithMeals(days, end, 14, end);
    expect(keys).toEqual(["2026-08-21", "2026-08-18"]);
    expect(keys).not.toContain(end);
    expect(keys).not.toContain("2026-08-20");
    expect(keys).not.toContain("2026-08-07");
  });

  it("includes today when it has meals and is not excluded", () => {
    const end = "2026-08-22";
    const d = emptyDay();
    d.meals.desayuno = [entry("cafe", "Café")];
    expect(recentDaysWithMeals({ [end]: d }, end, 14)).toEqual([end]);
  });
});

describe("dayHasMeals / mealEntryCount", () => {
  it("ignores water-only days and counts every slot", () => {
    const empty = emptyDay();
    empty.water = [{ id: "w", t: 1, ml: 500 }];
    expect(dayHasMeals(empty)).toBe(false);
    expect(mealEntryCount(empty)).toBe(0);
    expect(dayHasMeals(undefined)).toBe(false);
    const d = emptyDay();
    d.meals.desayuno = [entry("a")];
    d.meals.cena = [entry("b"), entry("c")];
    expect(dayHasMeals(d)).toBe(true);
    expect(mealEntryCount(d)).toBe(3);
  });
});

describe("copyDayMeals", () => {
  afterEach(() => {
    useBrioStore.setState({ ...defaultState(), hydrated: false, viewDate: "" });
  });

  it("copies an entire source day onto the target with new ids", () => {
    const to = todayKey();
    const from = addDays(to, -1);
    const src = emptyDay();
    src.meals.desayuno = [entry("avena", "Avena")];
    src.meals.comida = [entry("pollo", "Pollo"), entry("arroz", "Arroz")];
    useBrioStore.setState({ days: { [from]: src } });
    const n = useBrioStore.getState().copyDayMeals(from, to);
    expect(n).toBe(3);
    const dest = useBrioStore.getState().days[to];
    expect(dest.meals.desayuno).toHaveLength(1);
    expect(dest.meals.comida).toHaveLength(2);
    expect(dest.meals.desayuno[0].name).toBe("Avena");
    expect(dest.meals.desayuno[0].id).not.toBe("e-avena");
    expect(useBrioStore.getState().days[from].meals.desayuno[0].id).toBe("e-avena");
  });

  it("appends onto existing target meals and returns 0 when the source is empty", () => {
    const to = todayKey();
    const from = addDays(to, -3);
    const dest = emptyDay();
    dest.meals.snack = [entry("yogur", "Yogur")];
    const src = emptyDay();
    src.meals.cena = [entry("sopa", "Sopa")];
    useBrioStore.setState({ days: { [to]: dest, [from]: src } });
    expect(useBrioStore.getState().copyDayMeals(from, to)).toBe(1);
    expect(useBrioStore.getState().days[to].meals.snack).toHaveLength(1);
    expect(useBrioStore.getState().days[to].meals.cena[0].name).toBe("Sopa");
    expect(useBrioStore.getState().copyDayMeals(addDays(to, -9), to)).toBe(0);
  });
});
