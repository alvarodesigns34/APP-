import type { ActivityId, IntensityId, MacroPct, MacroPresetId, PurposeId, Sex } from "./types";
import { ageFrom, clamp, round } from "./format";
import activitiesJson from "@/data/activities.json";

export const ACTIVITY_FACTORS: { id: ActivityId; n: string; f: number; d: string }[] = [
  { id: "sed", n: "Sedentario", f: 1.2, d: "Trabajo sentado, sin ejercicio" },
  { id: "lig", n: "Ligero", f: 1.375, d: "Ejercicio suave 1–3 días/semana" },
  { id: "mod", n: "Moderado", f: 1.55, d: "Ejercicio 3–5 días/semana" },
  { id: "alto", n: "Alto", f: 1.725, d: "Ejercicio intenso 6–7 días/semana" },
  { id: "muy", n: "Muy alto", f: 1.9, d: "Trabajo físico o doble sesión" },
];

export const PURPOSES: { id: PurposeId; n: string; adj: number }[] = [
  { id: "perder", n: "Perder grasa", adj: -0.18 },
  { id: "recomp", n: "Recomposición", adj: -0.05 },
  { id: "mantener", n: "Mantener peso", adj: 0 },
  { id: "ganar", n: "Ganar masa", adj: 0.15 },
];

export const INTENSITIES: { id: IntensityId; n: string; f: number }[] = [
  { id: "suave", n: "Suave", f: 0.85 },
  { id: "media", n: "Media", f: 1 },
  { id: "alta", n: "Alta", f: 1.2 },
];

export const DEFAULT_MACRO_PCT: MacroPct = { prot: 25, carb: 45, fat: 30 };

export const MACRO_PRESETS: { id: MacroPresetId; n: string; pct: MacroPct }[] = [
  { id: "equilibrado", n: "Equilibrado", pct: { prot: 25, carb: 45, fat: 30 } },
  { id: "alto-prot", n: "Alta proteína", pct: { prot: 40, carb: 35, fat: 25 } },
  { id: "keto", n: "Keto", pct: { prot: 20, carb: 5, fat: 75 } },
  { id: "custom", n: "Personalizado", pct: { prot: 25, carb: 45, fat: 30 } },
];

export function isMacroPresetId(v: unknown): v is MacroPresetId {
  return v === "equilibrado" || v === "alto-prot" || v === "keto" || v === "custom";
}

export function pctForPreset(id: MacroPresetId): MacroPct {
  const found = MACRO_PRESETS.find((p) => p.id === id);
  return { ...(found?.pct ?? DEFAULT_MACRO_PCT) };
}

/** Clamp each % to 0–100 and make them sum to 100. Carbs absorb the remainder unless `edited` is carb. */
export function clampMacroPct(
  pct: { prot: number; carb: number; fat: number },
  edited: "prot" | "carb" | "fat" = "prot",
): MacroPct {
  let prot = clamp(Math.round(Number(pct.prot) || 0), 0, 100);
  let carb = clamp(Math.round(Number(pct.carb) || 0), 0, 100);
  let fat = clamp(Math.round(Number(pct.fat) || 0), 0, 100);
  if (edited === "prot") {
    fat = clamp(fat, 0, 100 - prot);
    carb = 100 - prot - fat;
  } else if (edited === "fat") {
    prot = clamp(prot, 0, 100 - fat);
    carb = 100 - prot - fat;
  } else {
    prot = clamp(prot, 0, 100 - carb);
    fat = 100 - prot - carb;
  }
  return { prot, carb, fat };
}

export const ACTIVITY_GROUPS = [
  { id: "fuerza", n: "Fuerza y gimnasio" },
  { id: "cardio", n: "Cardio" },
  { id: "deporte", n: "Deportes" },
  { id: "mente", n: "Cuerpo y mente" },
] as const;

export type Sport = {
  id: string;
  n: string;
  met: number;
  ico: string;
  g: string;
};

export const ACTIVITIES = activitiesJson as Sport[];

export function factorOf(id: ActivityId): number {
  return ACTIVITY_FACTORS.find((x) => x.id === id)?.f ?? 1.375;
}

export function purposeOf(id: PurposeId) {
  return PURPOSES.find((x) => x.id === id) ?? PURPOSES[2];
}

export function activityOf(id: string): Sport {
  return ACTIVITIES.find((a) => a.id === id) ?? ACTIVITIES[0];
}

export function intensityOf(id: IntensityId) {
  return INTENSITIES.find((x) => x.id === id) ?? INTENSITIES[1];
}

/** Mifflin-St Jeor. Non-binary uses the mean of the two adult offsets. */
export function bmr(sex: Sex, kg: number, cm: number, age: number): number {
  if (!kg || !cm || age == null) return 0;
  const a = clamp(age, 10, 110);
  const base = 10 * kg + 6.25 * cm - 5 * a;
  const offset = sex === "h" ? 5 : sex === "m" ? -161 : (5 - 161) / 2;
  return Math.round(base + offset);
}

export function tdee(bmrVal: number, actId: ActivityId): number {
  return Math.round(bmrVal * factorOf(actId));
}

export function kcalFloor(sex: Sex): number {
  if (sex === "h") return 1500;
  if (sex === "m") return 1200;
  return 1350;
}

export function targetKcal(tdeeVal: number, purpose: PurposeId, sex: Sex) {
  const p = purposeOf(purpose);
  const raw = Math.round(tdeeVal * (1 + p.adj));
  const floor = kcalFloor(sex);
  return { kcal: Math.max(raw, floor), raw, floored: raw < floor, floor };
}

export function macrosFromKcal(kcal: number, pct: MacroPct = DEFAULT_MACRO_PCT) {
  return {
    prot: Math.round((kcal * (pct.prot / 100)) / 4),
    carb: Math.round((kcal * (pct.carb / 100)) / 4),
    fat: Math.round((kcal * (pct.fat / 100)) / 9),
  };
}

/**
 * The common "14 g fibre per 1000 kcal" adequate-intake rule, floored at the
 * general adult recommendation of 25 g/day. Fibre doesn't scale with
 * TDEE/purpose the way the other macros do, so this is a simple food-volume
 * estimate rather than another energy-split formula.
 */
export function fiberGoalFor(kcal: number): number {
  return Math.max(25, Math.round((kcal / 1000) * 14));
}

export function bmi(kg: number, cm: number): number {
  if (!kg || !cm) return 0;
  const m = cm / 100;
  return round(kg / (m * m), 1);
}

export function bmiCategory(b: number): { n: string; tone: "ok" | "warn" | "bad" | "muted" } {
  if (!b) return { n: "—", tone: "muted" };
  if (b < 18.5) return { n: "Bajo peso", tone: "warn" };
  if (b < 25) return { n: "Normopeso", tone: "ok" };
  if (b < 30) return { n: "Sobrepeso", tone: "warn" };
  return { n: "Obesidad", tone: "bad" };
}

export function strideCm(sex: Sex, cm: number): number {
  const h = cm || 170;
  if (sex === "h") return 0.415 * h;
  if (sex === "m") return 0.413 * h;
  return 0.414 * h;
}

export function distanceFromSteps(steps: number, sex: Sex, cm: number): number {
  return round(((steps || 0) * strideCm(sex, cm)) / 100000, 2);
}

export function kcalFromSteps(steps: number, sex: Sex, cm: number, kg: number): number {
  const km = distanceFromSteps(steps, sex, cm);
  return Math.round(0.53 * (kg || 70) * km);
}

export function kcalFromWorkout(type: string, min: number, intensity: IntensityId, kg: number): number {
  const act = activityOf(type);
  const inten = intensityOf(intensity);
  return Math.round(act.met * inten.f * (kg || 70) * (min / 60));
}

export function computeGoals(input: {
  sex: Sex;
  birth: string;
  height: number;
  weight: number;
  activity: ActivityId;
  purpose: PurposeId;
  pct?: MacroPct;
}) {
  const age = input.birth ? ageFrom(input.birth) : 30;
  const b = bmr(input.sex, input.weight, input.height, age);
  const t = tdee(b, input.activity);
  const k = targetKcal(t, input.purpose, input.sex);
  const macros = macrosFromKcal(k.kcal, input.pct);
  const water = Math.round(clamp(input.weight * 35, 1500, 4000) / 50) * 50;
  let weightGoal = input.weight;
  if (input.purpose === "perder") weightGoal = round(input.weight * 0.95, 1);
  if (input.purpose === "ganar") weightGoal = round(input.weight * 1.05, 1);
  return {
    bmr: b,
    tdee: t,
    ...k,
    ...macros,
    fib: fiberGoalFor(k.kcal),
    steps: 8000,
    water,
    sleep: 480,
    weight: weightGoal,
    activityMin: 150,
  };
}
