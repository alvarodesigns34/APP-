import { addDays, rangeKeys } from "./dates";
import { MEALS, type Food, type MealId, type PersistedState } from "./types";

const LOOKBACK_DAYS = 90;

/** Percents of energy from Atwater factors (prot×4, carb×4, fat×9). */
export function energySplit(food: Pick<Food, "kcal" | "prot" | "carb" | "fat">): {
  prot: number;
  carb: number;
  fat: number;
} {
  if (!food.kcal) return { prot: 0, carb: 0, fat: 0 };
  const pk = food.prot * 4;
  const ck = food.carb * 4;
  const fk = food.fat * 9;
  const total = pk + ck + fk;
  if (total <= 0) return { prot: 0, carb: 0, fat: 0 };

  const shares = [pk, ck, fk];
  const raw = shares.map((v) => (v / total) * 100);
  const out = raw.map((n) => Math.round(n));
  const diff = 100 - (out[0] + out[1] + out[2]);
  if (diff !== 0) {
    let idx = 0;
    let best = diff > 0 ? raw[0] - out[0] : out[0] - raw[0];
    for (let i = 1; i < 3; i++) {
      const score = diff > 0 ? raw[i] - out[i] : out[i] - raw[i];
      if (score > best || (score === best && shares[i] > shares[idx])) {
        best = score;
        idx = i;
      }
    }
    out[idx] += diff;
  }
  return { prot: out[0], carb: out[1], fat: out[2] };
}

export function recipesUsingFood(
  foodId: string,
  recipes: Array<{ id: string; name: string; items: { foodId: string }[] }>,
): Array<{ id: string; name: string }> {
  const out: Array<{ id: string; name: string }> = [];
  const seen = new Set<string>();
  for (const r of recipes) {
    if (seen.has(r.id)) continue;
    if (!r.items.some((it) => it.foodId === foodId)) continue;
    seen.add(r.id);
    out.push({ id: r.id, name: r.name });
  }
  return out;
}

export function lastLogged(
  days: PersistedState["days"],
  foodId: string,
  today: string,
): { date: string; meal: MealId; grams: number; kcal: number } | null {
  const span = rangeKeys(today, LOOKBACK_DAYS).length;
  for (let n = 0; n < span; n++) {
    const date = addDays(today, -n);
    const day = days[date];
    if (!day) continue;
    for (const m of MEALS) {
      const entries = day.meals[m.id];
      if (!entries) continue;
      for (const e of entries) {
        if (e.foodId === foodId) {
          return { date, meal: m.id, grams: e.grams, kcal: e.kcal };
        }
      }
    }
  }
  return null;
}
