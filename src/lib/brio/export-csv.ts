import { MEALS, type MealEntry, type MealId, type PersistedState, type WeightEntry, type WorkoutEntry } from "./types";

/**
 * CSV export for Brío logs (spreadsheet-friendly).
 *
 * Format:
 * - UTF-8 with BOM (`\uFEFF`) so Excel (es-ES) keeps accents
 * - Semicolon `;` as field separator (Spanish Excel default)
 * - Decimal comma (e.g. `12,5`) so cells parse as numbers in es-ES
 * - RFC4180 quoting: fields with `;`, `"`, CR or LF are quoted; quotes doubled
 * - Header row in Spanish
 * - Rows sorted by date ascending
 *
 * Combined file (`combinedCsv`): first column `tipo` = comida | peso | entreno.
 * Unused columns are empty. Workout activity id is written in `alimento`.
 */

export const CSV_BOM = "\uFEFF";
export const CSV_SEP = ";";

const MEAL_HEADERS = [
  "fecha",
  "comida",
  "alimento",
  "cantidad",
  "unidad",
  "gramos",
  "kcal",
  "prot",
  "carb",
  "fat",
  "fib",
] as const;
const WEIGHT_HEADERS = ["fecha", "kg", "grasa", "musculo"] as const;
const WORKOUT_HEADERS = ["fecha", "tipo", "minutos", "intensidad", "kcal"] as const;
const COMBINED_HEADERS = [
  "tipo",
  "fecha",
  "comida",
  "alimento",
  "cantidad",
  "unidad",
  "gramos",
  "kcal",
  "prot",
  "carb",
  "fat",
  "fib",
  "kg",
  "grasa",
  "musculo",
  "minutos",
  "intensidad",
] as const;

const MEAL_RANK: Record<MealId, number> = { desayuno: 0, comida: 1, cena: 2, snack: 3 };

function mealLabel(id: MealId): string {
  return MEALS.find((m) => m.id === id)?.n ?? id;
}

function csvNumber(v: number): string {
  return String(v).replace(".", ",");
}

/** RFC4180 field quoting for semicolon-separated CSV. */
export function csvEscape(field: string): string {
  if (/[;"\r\n]/.test(field)) return `"${field.replace(/"/g, '""')}"`;
  return field;
}

// A cell opening with any of these is a live formula to Excel/Sheets/LibreOffice
// once the file is opened — a food name or unit typed (or barcode-scanned) as
// e.g. `=HYPERLINK(...)` would otherwise execute on open. Prefixing with an
// apostrophe forces it to be read as text; the apostrophe itself isn't shown.
const CSV_FORMULA_LEAD = /^[=+\-@\t\r]/;

/** Only for user-controlled text fields — never numbers, since a negative number legitimately starts with "-". */
function csvSanitizeText(field: string): string {
  return CSV_FORMULA_LEAD.test(field) ? `'${field}` : field;
}

function cell(v: string | number | null | undefined): string {
  if (v == null || v === "") return "";
  if (typeof v === "number") return Number.isFinite(v) ? csvEscape(csvNumber(v)) : "";
  return csvEscape(csvSanitizeText(v));
}

function csvRow(fields: ReadonlyArray<string | number | null | undefined>): string {
  return fields.map(cell).join(CSV_SEP);
}

function csvDocument(rows: string[]): string {
  return CSV_BOM + rows.join("\r\n") + "\r\n";
}

type MealRow = { fecha: string; meal: MealId; index: number; entry: MealEntry };
type WorkoutRow = { fecha: string; index: number; entry: WorkoutEntry };

function collectMeals(state: PersistedState): MealRow[] {
  const out: MealRow[] = [];
  for (const fecha of Object.keys(state.days).sort()) {
    const day = state.days[fecha];
    if (!day) continue;
    for (const m of MEALS) {
      const entries = day.meals[m.id] ?? [];
      entries.forEach((entry, index) => {
        out.push({ fecha, meal: m.id, index, entry });
      });
    }
  }
  return out;
}

function collectWeights(state: PersistedState): WeightEntry[] {
  return [...state.weights].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function collectWorkouts(state: PersistedState): WorkoutRow[] {
  const out: WorkoutRow[] = [];
  for (const fecha of Object.keys(state.days).sort()) {
    const day = state.days[fecha];
    if (!day) continue;
    day.workouts.forEach((entry, index) => {
      out.push({ fecha, index, entry });
    });
  }
  return out;
}

function mealFields(fecha: string, meal: MealId, entry: MealEntry): Array<string | number> {
  return [
    fecha,
    mealLabel(meal),
    entry.name,
    entry.qty,
    entry.unitName,
    entry.grams,
    entry.kcal,
    entry.prot,
    entry.carb,
    entry.fat,
    entry.fib,
  ];
}

function weightFields(w: WeightEntry): Array<string | number | undefined> {
  return [w.date, w.kg, w.fat, w.muscle];
}

function workoutFields(fecha: string, w: WorkoutEntry): Array<string | number> {
  return [fecha, w.type, w.min, w.intensity, w.kcal];
}

export function mealsCsv(state: PersistedState): string {
  const rows = [csvRow(MEAL_HEADERS)];
  for (const r of collectMeals(state)) rows.push(csvRow(mealFields(r.fecha, r.meal, r.entry)));
  return csvDocument(rows);
}

export function weightsCsv(state: PersistedState): string {
  const rows = [csvRow(WEIGHT_HEADERS)];
  for (const w of collectWeights(state)) rows.push(csvRow(weightFields(w)));
  return csvDocument(rows);
}

export function workoutsCsv(state: PersistedState): string {
  const rows = [csvRow(WORKOUT_HEADERS)];
  for (const r of collectWorkouts(state)) rows.push(csvRow(workoutFields(r.fecha, r.entry)));
  return csvDocument(rows);
}

/**
 * One-sheet export: `tipo` (comida|peso|entreno) plus the union of meal, weight
 * and workout columns. Unused cells are left empty.
 */
export function combinedCsv(state: PersistedState): string {
  type Kind = "comida" | "peso" | "entreno";
  const kindRank: Record<Kind, number> = { comida: 0, peso: 1, entreno: 2 };
  const rows: {
    fecha: string;
    kind: Kind;
    rank: number;
    index: number;
    cells: Array<string | number | null | undefined>;
  }[] = [];

  for (const r of collectMeals(state)) {
    const e = r.entry;
    rows.push({
      fecha: r.fecha,
      kind: "comida",
      rank: MEAL_RANK[r.meal],
      index: r.index,
      cells: [
        "comida",
        r.fecha,
        mealLabel(r.meal),
        e.name,
        e.qty,
        e.unitName,
        e.grams,
        e.kcal,
        e.prot,
        e.carb,
        e.fat,
        e.fib,
        null,
        null,
        null,
        null,
        null,
      ],
    });
  }
  collectWeights(state).forEach((w, index) => {
    rows.push({
      fecha: w.date,
      kind: "peso",
      rank: 0,
      index,
      cells: [
        "peso",
        w.date,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        w.kg,
        w.fat,
        w.muscle,
        null,
        null,
      ],
    });
  });
  for (const r of collectWorkouts(state)) {
    const w = r.entry;
    rows.push({
      fecha: r.fecha,
      kind: "entreno",
      rank: 0,
      index: r.index,
      cells: [
        "entreno",
        r.fecha,
        null,
        w.type,
        null,
        null,
        null,
        w.kcal,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        w.min,
        w.intensity,
      ],
    });
  }

  rows.sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1;
    const ka = kindRank[a.kind];
    const kb = kindRank[b.kind];
    if (ka !== kb) return ka - kb;
    if (a.rank !== b.rank) return a.rank - b.rank;
    return a.index - b.index;
  });

  return csvDocument([csvRow(COMBINED_HEADERS), ...rows.map((r) => csvRow(r.cells))]);
}

export function exportCsvBundle(state: PersistedState): { filename: string; content: string }[] {
  return [
    { filename: "brio-comidas.csv", content: mealsCsv(state) },
    { filename: "brio-pesos.csv", content: weightsCsv(state) },
    { filename: "brio-entrenos.csv", content: workoutsCsv(state) },
  ];
}
