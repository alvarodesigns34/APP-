import { describe, expect, it } from "vitest";
import { achievements, achievementsDone, daysLogged, nextAchievements } from "./achievements";
import { defaultState } from "./persist";
import type { DayLog, MealEntry, SelectorState, WeightEntry } from "./types";

function day(withMeal: boolean, workouts = 0): DayLog {
  const entry = {
    id: "e1",
    foodId: "f1",
    name: "X",
    qty: 1,
    unitName: "g",
    grams: 100,
    kcal: 100,
    prot: 5,
    carb: 10,
    fat: 2,
    fib: 1,
    sug: null,
    sat: null,
    sod: null,
  } as MealEntry;
  return {
    meals: { desayuno: withMeal ? [entry] : [], comida: [], cena: [], snack: [] },
    water: [],
    steps: 0,
    workouts: Array.from({ length: workouts }, (_, i) => ({
      id: `w${i}`,
      type: "pesas",
      min: 40,
      intensity: "media" as const,
      kcal: 250,
    })),
    sleep: null,
    note: "",
  };
}

function state(over: Partial<SelectorState> = {}): SelectorState {
  const { shopping: _shopping, ...base } = defaultState();
  return { ...base, ...over };
}

describe("daysLogged", () => {
  it("cuenta días con alguna comida, no comidas", () => {
    const days = { "2026-01-01": day(true), "2026-01-02": day(false), "2026-01-03": day(true) };
    expect(daysLogged({ days })).toBe(2);
  });

  it("un día creado pero vacío no cuenta", () => {
    // Abrir un día para apuntar el peso crea la entrada; eso no es registrar
    // comida y no debería acercarte a un logro de constancia.
    expect(daysLogged({ days: { "2026-01-01": day(false) } })).toBe(0);
  });
});

describe("achievements", () => {
  it("marca hecho al alcanzar el umbral, no al pasarlo", () => {
    const list = achievements(state(), 3);
    const tres = list.find((a) => a.id === "racha-3")!;
    expect(tres.done).toBe(true);
    expect(tres.at).toBe(3);
    expect(list.find((a) => a.id === "racha-7")!.done).toBe(false);
  });

  it("cuenta los entrenos de todos los días", () => {
    const days = { "2026-01-01": day(true, 6), "2026-01-02": day(true, 5) };
    const list = achievements(state({ days }), 0);
    expect(list.find((a) => a.id === "entrenos-10")!.at).toBe(11);
    expect(list.find((a) => a.id === "entrenos-10")!.done).toBe(true);
  });

  it("mide el avance hacia la meta de peso también al ganar", () => {
    // Meta 80 partiendo de 70: acercarse son kilos ganados, no perdidos.
    const weights: WeightEntry[] = [
      { date: "2026-01-01", kg: 70 },
      { date: "2026-03-01", kg: 73 },
    ];
    const s = state({ weights, goals: { ...defaultState().goals, weight: 80 } });
    expect(achievements(s, 0).find((a) => a.id === "peso-1")!.done).toBe(true);
    expect(achievements(s, 0).find((a) => a.id === "peso-5")!.at).toBe(3);
  });

  it("no cuenta como avance alejarse de la meta", () => {
    const weights: WeightEntry[] = [
      { date: "2026-01-01", kg: 80 },
      { date: "2026-03-01", kg: 84 },
    ];
    const s = state({ weights, goals: { ...defaultState().goals, weight: 75 } });
    expect(achievements(s, 0).find((a) => a.id === "peso-1")!.at).toBe(0);
  });

  it("el logro de medidas depende de haberse medido, no de haberse pesado", () => {
    const solo = state({ weights: [{ date: "2026-01-01", kg: 80 }] });
    expect(achievements(solo, 0).find((a) => a.id === "medidas-1")!.done).toBe(false);
    const con = state({ weights: [{ date: "2026-01-01", kg: 80, waist: 90 }] });
    expect(achievements(con, 0).find((a) => a.id === "medidas-1")!.done).toBe(true);
  });

  it("un estado recién estrenado no trae ningún logro hecho", () => {
    expect(achievementsDone(achievements(state(), 0))).toBe(0);
  });

  it("da ids únicos", () => {
    const ids = achievements(state(), 0).map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("nextAchievements", () => {
  it("ordena por fracción completada, no por lo que falta en bruto", () => {
    // Con racha 2 faltan 1 para «3 seguidos» y 28 para «30». Pero con 90 días
    // registrados, a «cien días» le faltan 10 y va al 90 %: está más cerca de
    // caer que «un mes entero» al 6 %.
    const days: Record<string, DayLog> = {};
    for (let i = 0; i < 90; i++) days[`2026-01-${String(i + 1).padStart(3, "0")}`] = day(true);
    const list = achievements(state({ days }), 2);
    const next = nextAchievements(list, 2).map((a) => a.id);
    expect(next[0]).toBe("dias-100"); // 90/100 = 90 %
    expect(next[1]).toBe("racha-3"); // 2/3 = 67 %
    expect(next).not.toContain("racha-30"); // 2/30 = 6 %
  });

  it("nunca devuelve uno ya conseguido", () => {
    const list = achievements(state(), 30);
    expect(nextAchievements(list, 5).every((a) => !a.done)).toBe(true);
  });

  it("respeta el límite", () => {
    expect(nextAchievements(achievements(state(), 0), 3)).toHaveLength(3);
  });
});
