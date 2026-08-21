import { BASE_RECIPES, defaultServing, getFood, isPantryBasic } from "./catalog";
import { addDays, dateOf, mealForHour, nowMinutes, rangeKeys, sleepDuration, todayKey } from "./dates";
import { kcalFromSteps } from "./domain";
import { emptyDay } from "./persist";
import type { DayLog, FastingId, MealEntry, MealId, PersistedState, Recipe } from "./types";
import { FASTING_PRESETS, MEALS } from "./types";

export function dayOf(s: PersistedState, key: string): DayLog {
  return s.days[key] ?? emptyDay();
}

export function sumEntries(entries: MealEntry[]) {
  const t = { kcal: 0, prot: 0, carb: 0, fat: 0, fib: 0 };
  for (const e of entries) {
    t.kcal += e.kcal;
    t.prot += e.prot;
    t.carb += e.carb;
    t.fat += e.fat;
    t.fib += e.fib;
  }
  return t;
}

export function dayFoodTotals(s: PersistedState, key: string) {
  const d = dayOf(s, key);
  const t = { kcal: 0, prot: 0, carb: 0, fat: 0, fib: 0 };
  for (const m of MEALS) {
    const part = sumEntries(d.meals[m.id]);
    t.kcal += part.kcal;
    t.prot += part.prot;
    t.carb += part.carb;
    t.fat += part.fat;
    t.fib += part.fib;
  }
  return t;
}

export function waterTotal(s: PersistedState, key: string): number {
  return dayOf(s, key).water.reduce((a, w) => a + w.ml, 0);
}

export function workoutMinTotal(s: PersistedState, key: string): number {
  return dayOf(s, key).workouts.reduce((a, w) => a + w.min, 0);
}

export function workoutKcalTotal(s: PersistedState, key: string): number {
  return dayOf(s, key).workouts.reduce((a, w) => a + w.kcal, 0);
}

export function stepsKcal(s: PersistedState, key: string): number {
  const d = dayOf(s, key);
  const w = latestWeight(s, key)?.kg ?? s.profile.weight;
  return kcalFromSteps(d.steps || 0, s.profile.sex, s.profile.height, w);
}

export function activityKcal(s: PersistedState, key: string): number {
  return workoutKcalTotal(s, key) + stepsKcal(s, key);
}

export function kcalGoalFor(s: PersistedState, key: string): number {
  let k = s.goals.kcal;
  if (s.settings.activityAdjust) k += activityKcal(s, key);
  return k;
}

export function latestWeight(s: PersistedState, beforeKey?: string) {
  const ws = beforeKey ? s.weights.filter((w) => w.date <= beforeKey) : s.weights;
  return ws.length ? ws[ws.length - 1] : null;
}

export function currentWeightKg(s: PersistedState): number {
  return latestWeight(s)?.kg ?? s.profile.weight;
}

export function moveGoal(s: PersistedState): number {
  return Math.max(10, Math.round(s.goals.activityMin / 7));
}

export type GoalFlags = {
  kcal: boolean;
  steps: boolean;
  water: boolean;
  sleep: boolean;
  move: boolean;
  count: number;
  total: number;
};

export function goalsMet(s: PersistedState, key: string): GoalFlags {
  const d = dayOf(s, key);
  const food = dayFoodTotals(s, key);
  const kg = kcalGoalFor(s, key);
  const ratio = kg ? food.kcal / kg : 0;
  const kcal = ratio >= 0.85 && ratio <= 1.15 && food.kcal > 0;
  const steps = s.goals.steps > 0 && d.steps >= s.goals.steps;
  const water = s.goals.water > 0 && waterTotal(s, key) >= s.goals.water;
  const sleep =
    !!d.sleep && s.goals.sleep > 0 && sleepDuration(d.sleep.bed, d.sleep.wake) >= s.goals.sleep * 0.9;
  const move = workoutMinTotal(s, key) >= moveGoal(s);
  const flags = { kcal, steps, water, sleep, move };
  const count = Object.values(flags).filter(Boolean).length;
  return { ...flags, count, total: 5 };
}

export function currentStreak(s: PersistedState): number {
  const today = todayKey();
  let n = 0;
  let k = today;
  if (goalsMet(s, today).count < 3) k = addDays(today, -1);
  while (goalsMet(s, k).count >= 3) {
    n += 1;
    k = addDays(k, -1);
    if (n > 400) break;
  }
  return n;
}

export function suggestRecipes(s: PersistedState, key: string, limit = 3) {
  const food = dayFoodTotals(s, key);
  const remKcal = kcalGoalFor(s, key) - food.kcal;
  const remProt = s.goals.prot - food.prot;
  if (remKcal < 120) return { remKcal, remProt, list: [] as Recipe[] };
  const list = BASE_RECIPES.filter((r) => {
    const k = r.perServing.kcal;
    if (k < 80 || k > remKcal + 80) return false;
    if (remProt > 15 && r.perServing.prot < 12) return false;
    return true;
  })
    .sort((a, b) => b.perServing.prot - a.perServing.prot)
    .slice(0, limit);
  return { remKcal, remProt, list };
}

export function missingIngredients(s: PersistedState, recipe: Recipe): string[] {
  return recipe.ing
    .filter((i) => {
      if (s.pantry.includes(i.id)) return false;
      if (!s.settings.pantryBasics) return true;
      return !isPantryBasic(getFood(i.id, { customFoods: s.customFoods, recipes: s.recipes }));
    })
    .map((i) => i.name);
}

export function habitualFoodIds(s: PersistedState, limit = 12): string[] {
  const counts = new Map<string, number>();
  for (const k of rangeKeys(todayKey(), 21)) {
    const d = s.days[k];
    if (!d) continue;
    for (const m of MEALS) {
      for (const e of d.meals[m.id]) counts.set(e.foodId, (counts.get(e.foodId) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)
    .slice(0, limit);
}

export type LastPortion = { grams: number; qty: number; unitName: string; meal: MealId; kcal: number };

export function lastPortion(s: PersistedState, foodId: string): LastPortion | null {
  const keys = rangeKeys(todayKey(), 60).reverse();
  for (const k of keys) {
    const d = s.days[k];
    if (!d) continue;
    for (const m of [...MEALS].reverse()) {
      const found = [...d.meals[m.id]].reverse().find((e) => e.foodId === foodId);
      if (found) {
        return { grams: found.grams, qty: found.qty, unitName: found.unitName, meal: m.id, kcal: found.kcal };
      }
    }
  }
  const food = getFood(foodId, { customFoods: s.customFoods, recipes: s.recipes });
  if (!food) return null;
  const serve = defaultServing(food);
  return {
    grams: serve.grams,
    qty: serve.qty,
    unitName: serve.unitName,
    meal: mealForHour(),
    kcal: Math.round((food.kcal * serve.grams) / 100),
  };
}

export function slotForQuickAdd(viewDate: string): MealId {
  if (viewDate === todayKey()) return mealForHour();
  return "comida";
}

export type FastingStatus = {
  label: string;
  eating: boolean;
  start: number;
  end: number;
  remaining: number;
  elapsed: number;
  progress: number;
};

export function fastingStatus(id: FastingId): FastingStatus | null {
  const preset = FASTING_PRESETS.find((p) => p.id === id);
  if (!preset || preset.id === "off") return null;
  const now = nowMinutes();
  const eating = now >= preset.start && now < preset.end;
  const windowLen = Math.max(1, preset.end - preset.start);
  const fastLen = 1440 - windowLen;
  if (eating) {
    return {
      label: preset.n,
      eating: true,
      start: preset.start,
      end: preset.end,
      remaining: preset.end - now,
      elapsed: now - preset.start,
      progress: (now - preset.start) / windowLen,
    };
  }
  const elapsed = now >= preset.end ? now - preset.end : now + (1440 - preset.end);
  return {
    label: preset.n,
    eating: false,
    start: preset.start,
    end: preset.end,
    remaining: Math.max(0, now < preset.start ? preset.start - now : preset.start + 1440 - now),
    elapsed,
    progress: elapsed / fastLen,
  };
}

export function weightTrend(s: PersistedState) {
  const ws = s.weights.slice(-21);
  if (ws.length < 2) return null;
  const first = ws[0];
  const last = ws[ws.length - 1];
  const days = Math.max(1, (dateOf(last.date).getTime() - dateOf(first.date).getTime()) / 86400000);
  const rate = (last.kg - first.kg) / days;
  const current = last.kg;
  const goal = s.goals.weight;
  const remaining = goal - current;
  const toward = remaining === 0 || remaining * rate < 0 || Math.abs(remaining) < 0.15;
  const daysNeeded = Math.abs(rate) < 0.004 ? null : remaining / rate;
  const eta =
    daysNeeded != null && daysNeeded > 0 && toward && daysNeeded < 400 ? Math.round(daysNeeded) : null;
  return { rate, current, goal, remaining, eta, weeks: eta != null ? eta / 7 : null };
}

export function weeklyInsights(s: PersistedState): string[] {
  const keys = rangeKeys(todayKey(), 7);
  const insights: string[] = [];
  let kcal = 0,
    prot = 0,
    water = 0,
    daysLogged = 0,
    sleepN = 0,
    sleepMin = 0,
    steps = 0,
    stepDays = 0,
    move = 0;
  for (const k of keys) {
    const t = dayFoodTotals(s, k);
    if (t.kcal > 0) {
      daysLogged += 1;
      kcal += t.kcal;
      prot += t.prot;
    }
    water += waterTotal(s, k);
    const sl = dayOf(s, k).sleep;
    if (sl) {
      sleepN += 1;
      sleepMin += sleepDuration(sl.bed, sl.wake);
    }
    const st = dayOf(s, k).steps;
    if (st > 0) {
      steps += st;
      stepDays += 1;
    }
    move += workoutMinTotal(s, k);
  }
  if (daysLogged) {
    const avg = Math.round(kcal / daysLogged);
    const delta = avg - s.goals.kcal;
    if (Math.abs(delta) < 80) insights.push(`Has rondado tu objetivo: ${avg} kcal de media.`);
    else if (delta > 0) insights.push(`Esta semana has comido unas ${delta} kcal más de las previstas al día.`);
    else insights.push(`Has quedado unas ${-delta} kcal por debajo del objetivo al día.`);
    const p = Math.round(prot / daysLogged);
    if (p < s.goals.prot * 0.85) insights.push(`La proteína media (${p} g) está por debajo de tu meta.`);
    else insights.push(`Proteína media en ${p} g: vas bien.`);
  } else {
    insights.push("Registra comidas unos días para ver el recap semanal.");
  }
  if (sleepN) {
    const h = sleepMin / sleepN / 60;
    insights.push(`Has dormido de media ${h.toFixed(1)} h.`);
  }
  if (water > 0) {
    const avgW = Math.round(water / 7);
    insights.push(
      avgW >= s.goals.water
        ? `Agua media ${avgW} ml, por encima de la meta.`
        : `Agua media ${avgW} ml al día.`,
    );
  }
  if (stepDays) {
    const avgS = Math.round(steps / stepDays);
    insights.push(
      avgS >= s.goals.steps
        ? `Pasos: ${avgS.toLocaleString("es-ES")} de media, por encima de la meta.`
        : `Pasos medios: ${avgS.toLocaleString("es-ES")}.`,
    );
  }
  if (move > 0) {
    const goal = s.goals.activityMin;
    insights.push(
      move >= goal
        ? `Has cubierto los ${goal} min de ejercicio de la semana.`
        : `Llevas ${move} de ${goal} min de ejercicio esta semana.`,
    );
  }
  const streak = currentStreak(s);
  if (streak >= 3) insights.push(`Llevas ${streak} días seguidos cumpliendo objetivos.`);
  return insights.slice(0, 5);
}
