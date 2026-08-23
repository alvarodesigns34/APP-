import { addMonths, dateOf, keyOf, monthStart } from "./dates";
import { compareWeeks, weekTotals, type WeekDelta, type WeekTotals } from "./week-compare";
import { dayFoodTotals, workoutMinTotal } from "./selectors";
import type { SelectorState, WeightEntry } from "./types";

/**
 * Todas las fechas de un mes natural, de la 1 al último día.
 *
 * Mes natural y no «últimos 30 días» a propósito: cuando alguien dice «qué tal
 * me ha ido el mes» piensa en agosto, no en una ventana móvil, y así dos meses
 * seguidos se comparan por su nombre. El coste es que febrero tiene 28 y
 * agosto 31, que es justamente por lo que el resumen usa medias por día y no
 * totales donde importa.
 */
export function monthKeys(anyKeyInMonth: string): string[] {
  const first = dateOf(monthStart(anyKeyInMonth));
  const n = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const out: string[] = [];
  for (let d = 1; d <= n; d++) out.push(keyOf(new Date(first.getFullYear(), first.getMonth(), d)));
  return out;
}

export type MonthRecap = {
  /** Cualquier fecha del mes, para titularlo con `fmtMonthYear`. */
  key: string;
  prevKey: string;
  curr: WeekTotals;
  prev: WeekTotals;
  deltas: { kcal: WeekDelta; prot: WeekDelta; steps: WeekDelta; move: WeekDelta };
  /** Días del mes con algún entreno registrado. */
  trainedDays: number;
  /** Cambio de peso dentro del mes, o null si no hay dos pesajes. */
  weightDelta: number | null;
  /** true cuando el mes anterior no tiene nada con lo que comparar. */
  prevEmpty: boolean;
};

/**
 * Cuánto se movió el peso dentro del mes.
 *
 * Se toma el primer y el último pesaje *del propio mes*, no el último de antes:
 * mezclar meses haría que un mes sin pesarte heredara la bajada del anterior y
 * pareciera un progreso que no ha pasado.
 */
export function monthWeightDelta(weights: WeightEntry[], keys: string[]): number | null {
  const from = keys[0];
  const to = keys[keys.length - 1];
  const inside = weights
    .filter((w) => w.date >= from && w.date <= to)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  if (inside.length < 2) return null;
  return Math.round((inside[inside.length - 1].kg - inside[0].kg) * 10) / 10;
}

export function monthRecap(s: SelectorState, anyKeyInMonth: string): MonthRecap {
  const keys = monthKeys(anyKeyInMonth);
  const prevKey = addMonths(anyKeyInMonth, -1);
  const prevKeys = monthKeys(prevKey);

  const food = (k: string) => dayFoodTotals(s, k);
  const steps = (k: string) => s.days[k]?.steps ?? 0;
  const move = (k: string) => workoutMinTotal(s, k);

  const curr = weekTotals(keys, food, steps, move);
  const prev = weekTotals(prevKeys, food, steps, move);

  let trainedDays = 0;
  for (const k of keys) if ((s.days[k]?.workouts.length ?? 0) > 0) trainedDays += 1;

  return {
    key: keys[0],
    prevKey: prevKeys[0],
    curr,
    prev,
    deltas: compareWeeks(curr, prev),
    trainedDays,
    weightDelta: monthWeightDelta(s.weights, keys),
    prevEmpty: prev.foodDays === 0 && prev.stepsAvg === 0 && prev.moveMin === 0,
  };
}
