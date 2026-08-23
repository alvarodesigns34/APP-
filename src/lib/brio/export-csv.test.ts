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
    expect(rows(weightsCsv(s))).toEqual(["fecha;kg;grasa;musculo;cintura;pecho;cadera;brazo;muslo"]);
    expect(rows(workoutsCsv(s))).toEqual(["fecha;tipo;minutos;intensidad;kcal"]);
    expect(rows(combinedCsv(s))[0]).toBe(
      "tipo;fecha;comida;alimento;cantidad;unidad;gramos;kcal;prot;carb;fat;fib;kg;grasa;musculo;minutos;intensidad;azucar;saturada;sodio;cintura;pecho;cadera;brazo;muslo",
    );
  });
});

describe("medidas corporales", () => {
  it("exporta cada medida en su columna, dejando vacías las que falten", () => {
    // Se dejan huecos a propósito (cintura sí, pecho y cadera no, brazo sí):
    // comprobar que las columnas aparecen vacías no probaría nada, lo que
    // importa es que cada valor cae en la suya y no en la de al lado.
    const s = withLogs((st) => {
      st.weights = [{ date: "2026-02-01", kg: 80, waist: 92, arm: 34.5 }];
    });
    expect(rows(weightsCsv(s))[1]).toBe("2026-02-01;80;;;92;;;34,5;");
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
    expect(rows(weightsCsv(s))).toEqual([
      "fecha;kg;grasa;musculo;cintura;pecho;cadera;brazo;muslo",
      "2026-01-15;72,5;;;;;;;",
    ]);

    const combined = rows(combinedCsv(s));
    expect(combined).toHaveLength(3);
    expect(combined[1]).toBe("comida;2026-01-15;Desayuno;Manzana;1;unidad;150;78;0,4;21;0,2;2,4;;;;;;;;;;;;;");
    expect(combined[2]).toBe("peso;2026-01-15;;;;;;;;;;;72,5;;;;;;;;;;;;");
  });
});

describe("CSV formula injection", () => {
  it("prefixes a leading =, +, -, @ or tab with an apostrophe so it isn't read as a formula", () => {
    const s = withLogs((st) => {
      const d = emptyDay();
      d.meals.comida = [
        meal({ id: "m1", name: "=cmd|calc", unitName: "unidad" }),
        meal({ id: "m2", name: "+1 huevo", unitName: "unidad" }),
        meal({ id: "m3", name: "@mention", unitName: "unidad" }),
      ];
      st.days["2026-05-01"] = d;
    });
    const lines = rows(mealsCsv(s)).slice(1);
    expect(lines[0]).toContain(";'=cmd|calc;");
    expect(lines[1]).toContain(";'+1 huevo;");
    expect(lines[2]).toContain(";'@mention;");
  });

  it("composes with quote-escaping when the payload also contains a quote", () => {
    const s = withLogs((st) => {
      const d = emptyDay();
      d.meals.comida = [meal({ name: '=HYPERLINK("http://evil")', unitName: "unidad" })];
      st.days["2026-05-01"] = d;
    });
    const line = rows(mealsCsv(s))[1];
    // Neutralized (leading apostrophe) AND RFC4180-quoted (embedded quotes doubled).
    expect(line).toContain('"\'=HYPERLINK(""http://evil"")"');
  });

  it("does not touch a legitimate negative number", () => {
    const s = withLogs((st) => {
      st.weights = [{ date: "2026-05-01", kg: 70, fat: -1 }];
    });
    // fat is invalid as a negative percentage but the point stands: numeric
    // cells must never gain a leading apostrophe just for starting with "-".
    expect(rows(weightsCsv(s))[1]).toBe("2026-05-01;70;-1;;;;;;");
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
    expect(rows(weightsCsv(s))[2]).toBe("2026-03-10;71;18,2;40;;;;;");
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
    expect(rows(combinedCsv(s))[3]).toBe("entreno;2026-04-02;;fuerza;;;;220;;;;;;;;45;media;;;;;;;;");
  });
});

describe("exportCsvBundle", () => {
  it("returns three UTF-8-BOM files", () => {
    const bundle = exportCsvBundle(defaultState());
    expect(bundle.map((f) => f.filename)).toEqual(["brio-comidas.csv", "brio-pesos.csv", "brio-entrenos.csv"]);
    for (const f of bundle) expect(f.content.startsWith(CSV_BOM)).toBe(true);
  });
});

describe("combinedCsv: ninguna fila se descuadra de la cabecera", () => {
  /**
   * Las filas del combinado se construyen por posición, con `null` en los
   * huecos, así que añadir una columna y olvidarse de un tipo de fila desplaza
   * los datos en silencio. Esto lo caza. Es además cómo se colaron las ocho
   * columnas que faltaban: azúcar, saturada, sodio y las cinco medidas se
   * registraban en la app y se perdían al exportar, porque el único botón de
   * Ajustes es este y no las llevaba.
   */
  function rowsOf(csv: string): string[][] {
    return csv
      .replace(/^\uFEFF/, "")
      .trim()
      .split(/\r?\n/)
      .map((line) => line.split(";"));
  }

  it("cada fila tiene tantas celdas como la cabecera", () => {
    const s = defaultState();
    s.days["2026-08-22"] = {
      ...emptyDay(),
      meals: {
        desayuno: [
          {
            id: "e1", foodId: "f1", name: "Avena", qty: 1, unitName: "g", grams: 60,
            kcal: 228, prot: 8.4, carb: 39, fat: 4.2, fib: 6, sug: 0.5, sat: 0.7, sod: 3,
          },
        ],
        comida: [], cena: [], snack: [],
      },
      workouts: [{ id: "w1", type: "fuerza", min: 55, intensity: "media", kcal: 330 }],
    };
    s.weights = [{ date: "2026-08-22", kg: 78, fat: 19.8, muscle: 41, waist: 84, chest: 102 }];

    const rows = rowsOf(combinedCsv(s));
    expect(rows.length).toBeGreaterThan(3); // cabecera + las tres clases de fila
    const width = rows[0].length;
    for (const [i, r] of rows.entries()) {
      expect(r.length, `fila ${i}: ${r.join(";")}`).toBe(width);
    }
  });

  it("lleva los micros de la comida y las medidas del pesaje", () => {
    const s = defaultState();
    s.weights = [{ date: "2026-08-22", kg: 78, waist: 84 }];
    const rows = rowsOf(combinedCsv(s));
    const head = rows[0];
    for (const col of ["azucar", "saturada", "sodio", "cintura", "pecho", "cadera", "brazo", "muslo"]) {
      expect(head, `falta la columna ${col}`).toContain(col);
    }
    const peso = rows.find((r) => r[0] === "peso")!;
    expect(peso[head.indexOf("cintura")]).toBe("84");
  });
});
