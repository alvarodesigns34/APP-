import { describe, expect, it } from "vitest";
import { monthKeys, monthRecap, monthWeightDelta } from "./month-recap";
import { defaultState, emptyDay } from "./persist";
import type { DayLog, MealEntry, SelectorState } from "./types";

function meal(kcal: number, prot: number): MealEntry {
  return {
    id: "e1",
    foodId: "f1",
    name: "X",
    qty: 1,
    unitName: "g",
    grams: 100,
    kcal,
    prot,
    carb: 0,
    fat: 0,
    fib: 0,
    sug: null,
    sat: null,
    sod: null,
  };
}

function dayWith(kcal: number, steps = 0, workoutMin = 0): DayLog {
  const d = emptyDay();
  d.meals.desayuno = [meal(kcal, 50)];
  d.steps = steps;
  if (workoutMin > 0) {
    d.workouts = [{ id: "w", type: "pesas", min: workoutMin, intensity: "media", kcal: 200 }];
  }
  return d;
}

function state(days: Record<string, DayLog>, over: Partial<SelectorState> = {}): SelectorState {
  const { shopping: _shopping, ...base } = defaultState();
  return { ...base, days, ...over };
}

describe("monthKeys", () => {
  it("da todos los días del mes natural, no una ventana de 30", () => {
    expect(monthKeys("2026-02-14")).toHaveLength(28);
    expect(monthKeys("2026-08-01")).toHaveLength(31);
    expect(monthKeys("2026-04-30")).toHaveLength(30);
  });

  it("cuenta el 29 de febrero en año bisiesto", () => {
    const feb = monthKeys("2028-02-10");
    expect(feb).toHaveLength(29);
    expect(feb[feb.length - 1]).toBe("2028-02-29");
  });

  it("empieza el 1 sea cual sea el día que le pases", () => {
    expect(monthKeys("2026-08-23")[0]).toBe("2026-08-01");
  });
});

describe("monthWeightDelta", () => {
  const keys = monthKeys("2026-08-01");

  it("usa el primer y el último pesaje del propio mes", () => {
    const d = monthWeightDelta(
      [
        { date: "2026-08-03", kg: 80 },
        { date: "2026-08-20", kg: 78.4 },
      ],
      keys,
    );
    expect(d).toBe(-1.6);
  });

  it("ignora los pesajes de otros meses", () => {
    // Si contase el último de julio, un agosto sin pesarse heredaría la bajada
    // del mes anterior y parecería un progreso que no ha ocurrido.
    const d = monthWeightDelta(
      [
        { date: "2026-07-01", kg: 85 },
        { date: "2026-08-15", kg: 80 },
      ],
      keys,
    );
    expect(d).toBeNull();
  });

  it("es null con un solo pesaje: no hay cambio que medir", () => {
    expect(monthWeightDelta([{ date: "2026-08-15", kg: 80 }], keys)).toBeNull();
    expect(monthWeightDelta([], keys)).toBeNull();
  });
});

describe("monthRecap", () => {
  it("compara medias por día, así que un mes corto no sale perjudicado", () => {
    // Febrero (28 días) y marzo (31) con las mismas kcal por día tienen que
    // salir iguales; con totales, marzo parecería un 11 % «peor».
    const days: Record<string, DayLog> = {};
    for (const k of monthKeys("2026-02-01")) days[k] = dayWith(2000);
    for (const k of monthKeys("2026-03-01")) days[k] = dayWith(2000);
    const r = monthRecap(state(days), "2026-03-15");
    expect(r.curr.kcalAvg).toBe(2000);
    expect(r.prev.kcalAvg).toBe(2000);
    expect(r.deltas.kcal.dir).toBe("flat");
  });

  it("cuenta los días entrenados, no las sesiones", () => {
    const days: Record<string, DayLog> = {
      "2026-08-01": dayWith(2000, 0, 40),
      "2026-08-02": dayWith(2000, 0, 60),
      "2026-08-03": dayWith(2000),
    };
    const r = monthRecap(state(days), "2026-08-10");
    expect(r.trainedDays).toBe(2);
    expect(r.curr.moveMin).toBe(100);
  });

  it("marca el mes anterior vacío cuando no hay nada con lo que comparar", () => {
    const days = { "2026-08-05": dayWith(2000) };
    expect(monthRecap(state(days), "2026-08-10").prevEmpty).toBe(true);
  });

  it("apunta al mes anterior correcto al cruzar el año", () => {
    const r = monthRecap(state({}), "2026-01-15");
    expect(r.key).toBe("2026-01-01");
    expect(r.prevKey).toBe("2025-12-01");
  });
});
