import { rangeKeys, todayKey, addDays } from "./dates";
import { sumEntries } from "./selectors";
import type { DayLog, MealEntry, MealId, PersistedState } from "./types";
import { MEALS } from "./types";

export type MealHabit = {
  sig: string;
  meal: MealId;
  count: number;
  lastKey: string;
  entries: MealEntry[];
  kcal: number;
  names: string[];
};

export function mealSignature(meal: MealId, entries: MealEntry[]): string {
  return `${meal}:${[...new Set(entries.map((e) => e.foodId))].sort().join("|")}`;
}

export function habitTitle(names: string[]): string {
  if (names.length === 0) return "Comida";
  if (names.length === 1) return names[0];
  if (names.length <= 3) return names.join(" · ");
  return `${names[0]} · ${names[1]} y más`;
}

export function dayHasMeals(day: DayLog | undefined | null): boolean {
  if (!day) return false;
  return MEALS.some((m) => (day.meals[m.id]?.length ?? 0) > 0);
}

export function mealEntryCount(day: DayLog | undefined | null): number {
  if (!day) return 0;
  let n = 0;
  for (const m of MEALS) n += day.meals[m.id]?.length ?? 0;
  return n;
}

/** Calendar days in `(endKey − n, endKey]` that have meals, newest first. */
export function recentDaysWithMeals(
  days: Record<string, DayLog>,
  endKey: string,
  n = 14,
  excludeKey?: string,
): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const k = addDays(endKey, -i);
    if (excludeKey && k === excludeKey) continue;
    if (dayHasMeals(days[k])) out.push(k);
  }
  return out;
}

export function habitualMeals(s: PersistedState, limit = 6): MealHabit[] {
  const keys = rangeKeys(todayKey(), 28);
  const yesterday = addDays(todayKey(), -1);
  const groups = new Map<
    string,
    { meal: MealId; count: number; lastKey: string; entries: MealEntry[]; names: string[] }
  >();

  for (const k of keys) {
    const d = s.days[k];
    if (!d) continue;
    for (const m of MEALS) {
      const entries = d.meals[m.id];
      if (!entries.length) continue;
      const sig = mealSignature(m.id, entries);
      const prev = groups.get(sig);
      if (!prev) {
        groups.set(sig, {
          meal: m.id,
          count: 1,
          lastKey: k,
          entries,
          names: [...new Set(entries.map((e) => e.name))],
        });
      } else {
        prev.count += 1;
        if (k >= prev.lastKey) {
          prev.lastKey = k;
          prev.entries = entries;
          prev.meal = m.id;
          prev.names = [...new Set(entries.map((e) => e.name))];
        }
      }
    }
  }

  return [...groups.entries()]
    .map(([sig, g]) => ({
      sig,
      meal: g.meal,
      count: g.count,
      lastKey: g.lastKey,
      entries: g.entries,
      kcal: sumEntries(g.entries).kcal,
      names: g.names,
    }))
    .filter((h) => h.count >= 2 || h.lastKey === yesterday)
    .sort((a, b) => b.count - a.count || (a.lastKey < b.lastKey ? 1 : -1))
    .slice(0, limit);
}
