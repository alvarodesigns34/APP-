import type { WeekdayPlan } from "./types";

export const DEFAULT_WEEKDAY_PLAN: WeekdayPlan = {
  enabled: false,
  /** index 0 = Sunday … 6 = Saturday, matching Date.getDay() */
  training: [false, true, true, true, true, true, false],
};

export function parseWeekdayPlan(raw: unknown): WeekdayPlan {
  const d = DEFAULT_WEEKDAY_PLAN;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { enabled: d.enabled, training: [...d.training] };
  }
  const o = raw as Record<string, unknown>;
  const training =
    Array.isArray(o.training) && o.training.length === 7 ? o.training.map((x) => !!x) : [...d.training];
  return { enabled: !!o.enabled, training };
}

/**
 * Daily kcal such that the 7-day sum equals `7 * baseKcal`.
 * Training days get round(base * 1.12); rest days share the remainder.
 */
export function kcalForWeekday(baseKcal: number, training: boolean[], jsWeekday: number): number {
  if (!Array.isArray(training) || training.length !== 7) return baseKcal;
  const flags = training.map((d) => !!d);
  let tCount = 0;
  for (const f of flags) if (f) tCount += 1;
  if (tCount === 0 || tCount === 7) return baseKcal;
  if (!Number.isInteger(jsWeekday) || jsWeekday < 0 || jsWeekday > 6) return baseKcal;

  const trainingKcal = Math.round(baseKcal * 1.12);
  const rCount = 7 - tCount;
  const weekly = 7 * baseKcal;
  const restTotal = weekly - tCount * trainingKcal;
  const restKcal = Math.round(restTotal / rCount);

  const days = new Array<number>(7);
  let lastRest = -1;
  for (let i = 0; i < 7; i++) {
    if (flags[i]) {
      days[i] = trainingKcal;
    } else {
      days[i] = restKcal;
      lastRest = i;
    }
  }
  if (lastRest >= 0) days[lastRest] = restTotal - restKcal * (rCount - 1);

  const clamped = days.map((n) => Math.max(1000, n));
  let clampSum = 0;
  for (const n of clamped) clampSum += n;
  const out = clampSum === weekly ? clamped : days;
  return out[jsWeekday];
}
