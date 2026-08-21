import type { Food, Macros } from "./types";

/** Linear per-100g scale. No catalog / JSON. Safe to import from the start chunk. */
export function scaleMacros(m: Pick<Food, keyof Macros>, grams: number): Macros {
  const k = grams / 100;
  const mul = (v: number | null) => (v == null ? null : v * k);
  return {
    kcal: m.kcal * k,
    prot: m.prot * k,
    carb: m.carb * k,
    fat: m.fat * k,
    fib: m.fib * k,
    sug: mul(m.sug),
    sat: mul(m.sat),
    sod: mul(m.sod),
  };
}
