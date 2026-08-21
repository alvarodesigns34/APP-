import { describe, expect, it } from "vitest";
import { defaultState, emptyDay } from "./persist";
import { CSV_BOM, combinedCsv, csvEscape, exportCsvBundle, mealsCsv, weightsCsv, workoutsCsv } from "./export-csv";
import type { MealEntry, PersistedState, WorkoutEntry } from "./types";

function meal(over: Partial<MealEntry> = {}): MealEntry {
  return {
    id: "m1",
    foodId: "manzana",
    name: "Manzana",
    qty: 1,
    unitName: "unidad",
    grams: 150,
    kcal: 78,
    prot: 0.4,
    carb: 21,
    fat: 0.2,
    fib: 2.4,
    sug: null,
    sat: null,
    sod: null,
    ...over,
  };
}

function workout(over: Partial<WorkoutEntry> = {}): WorkoutEntry {
  return { id: "w1", type: "fuerza", min: 45, intensity: "media", kcal: 220, ...over };
}

function withLogs(patch: (s: PersistedState) => void): PersistedState {
  const s = defaultState();
  patch(s);
  return s;
}

function rows(csv: string): string[] {
  expect(csv.startsWith(CSV_BOM)).toBe(true);
  const body = csv.slice(CSV_BOM.length).replace(/\r\n/g, "\n");
  return body.replace(/\n$/, "").split("\n");
}

describe("csvEscape", () => {
  it("quotes and doubles quotes; quotes fields that contain semicolons or newlines", () => {
    expect(csvEscape("Manzana")).toBe("Manzana");
    expect(csvEscape('Yogur "griego"; 0%')).toBe('"Yogur ""griego""; 0%"');
    expect(csvEscape("línea\nnueva")).toBe('"línea\nnueva"');
  });
});

describe("empty state", () => {
  it("still has a Spanish header and a BOM", () => {
    const s = defaultState();
    expect(mealsCsv(s).startsWith(CSV_BOM)).toBe(true);
    expect(rows(mealsCsv(s))).toEqual(["fecha;comida;alimento;cantidad;unidad;gramos;kcal;prot;carb;fat;fib"]);
    expect(rows(weightsCsv(s))).toEqual(["fecha;kg;grasa;musculo"]);
    expect(rows(workoutsCsv(s))).toEqual(["fecha;tipo;minutos;intensidad;kcal"]);
    expect(rows(combinedCsv(s))[0]).toBe(
      "tipo;fecha;comida;alimento;cantidad;unidad;gramos;kcal;prot;carb;fat;fib;kg;grasa;musculo;minutos;intensidad",
    );
  });
});

describe("fixture: 1 meal + 1 weight", () => {
  it("produces the expected rows with Spanish decimals", () => {
    const s = withLogs((st) => {
      const d = emptyDay();
      d.meals.desayuno = [meal()];
      st.days["2026-01-15"] = d;
      st.weights = [{ date: "2026-01-15", kg: 72.5 }];
    });

    expect(rows(mealsCsv(s))).toEqual([
      "fecha;comida;alimento;cantidad;unidad;gramos;kcal;prot;carb;fat;fib",
      "2026-01-15;Desayuno;Manzana;1;unidad;150;78;0,4;21;0,2;2,4",
    ]);
    expect(rows(weightsCsv(s))).toEqual(["fecha;kg;grasa;musculo", "2026-01-15;72,5;;"]);

    const combined = rows(combinedCsv(s));
    expect(combined).toHaveLength(3);
    expect(combined[1]).toBe("comida;2026-01-15;Desayuno;Manzana;1;unidad;150;78;0,4;21;0,2;2,4;;;;;");
    expect(combined[2]).toBe("peso;2026-01-15;;;;;;;;;;;72,5;;;;");
  });
});

describe("quoting inside food names", () => {
  it("escapes quotes and semicolons in the alimento column", () => {
    const s = withLogs((st) => {
      const d = emptyDay();
      d.meals.comida = [meal({ name: 'Yogur "griego"; 0%', qty: 1, unitName: "unidad" })];
      st.days["2026-02-01"] = d;
    });
    const line = rows(mealsCsv(s))[1];
    expect(line).toContain('"Yogur ""griego""; 0%"');
    expect(line.startsWith("2026-02-01;Comida;")).toBe(true);
  });
});

describe("sort and workouts", () => {
  it("sorts meals and weights by date ascending", () => {
    const s = withLogs((st) => {
      const later = emptyDay();
      later.meals.cena = [meal({ name: "Arroz" })];
      st.days["2026-03-10"] = later;
      const earlier = emptyDay();
      earlier.meals.desayuno = [meal({ name: "Avena" })];
      st.days["2026-03-01"] = earlier;
      st.weights = [
        { date: "2026-03-10", kg: 71, fat: 18.2, muscle: 40 },
        { date: "2026-03-01", kg: 72 },
      ];
    });
    const mealDates = rows(mealsCsv(s))
      .slice(1)
      .map((l) => l.split(";")[0]);
    expect(mealDates).toEqual(["2026-03-01", "2026-03-10"]);
    const weightDates = rows(weightsCsv(s))
      .slice(1)
      .map((l) => l.split(";")[0]);
    expect(weightDates).toEqual(["2026-03-01", "2026-03-10"]);
    expect(rows(weightsCsv(s))[2]).toBe("2026-03-10;71;18,2;40");
  });

  it("exports workouts and places entreno after comida/peso on the same date", () => {
    const s = withLogs((st) => {
      const d = emptyDay();
      d.meals.snack = [meal({ name: "Plátano" })];
      d.workouts = [workout()];
      st.days["2026-04-02"] = d;
      st.weights = [{ date: "2026-04-02", kg: 70 }];
    });
    expect(rows(workoutsCsv(s))).toEqual(["fecha;tipo;minutos;intensidad;kcal", "2026-04-02;fuerza;45;media;220"]);
    const kinds = rows(combinedCsv(s))
      .slice(1)
      .map((l) => l.split(";")[0]);
    expect(kinds).toEqual(["comida", "peso", "entreno"]);
    expect(rows(combinedCsv(s))[3]).toBe("entreno;2026-04-02;;fuerza;;;;220;;;;;;;;45;media");
  });
});

describe("exportCsvBundle", () => {
  it("returns three UTF-8-BOM files", () => {
    const bundle = exportCsvBundle(defaultState());
    expect(bundle.map((f) => f.filename)).toEqual(["brio-comidas.csv", "brio-pesos.csv", "brio-entrenos.csv"]);
    for (const f of bundle) expect(f.content.startsWith(CSV_BOM)).toBe(true);
  });
});
