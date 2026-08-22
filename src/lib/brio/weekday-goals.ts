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
  const training = Array.isArray(o.training) && o.training.length === 7 ? o.training.map((x) => !!x) : [...d.training];
  return { enabled: !!o.enabled, training };
}

/**
 * Legacy algorithm floor used when callers omit `minKcal`. Production callers
 * pass `kcalFloor(sex)` (1200/1350/1500) so a rest day never undercuts
 * `computeGoals`.
 */
export const MIN_DAY_KCAL = 1000;

/**
 * Daily kcal such that the 7-day sum equals `7 * baseKcal`.
 *
 * Training days get round(base * 1.12) and rest days share the remainder, but no
 * day may fall under `minKcal`: when the plain split would push rest days
 * below it, the training bonus shrinks until it fits. A base already under the
 * floor cannot be redistributed without going lower still, so the plan flattens
 * to `baseKcal` every day instead of amplifying it.
 */
export function kcalForWeekday(
  baseKcal: number,
  training: boolean[],
  jsWeekday: number,
  minKcal: number = MIN_DAY_KCAL,
): number {
  if (!Array.isArray(training) || training.length !== 7) return baseKcal;
  const flags = training.map((d) => !!d);
  let tCount = 0;
  for (const f of flags) if (f) tCount += 1;
  if (tCount === 0 || tCount === 7) return baseKcal;
  if (!Number.isInteger(jsWeekday) || jsWeekday < 0 || jsWeekday > 6) return baseKcal;
  const floor = Number.isFinite(minKcal) && minKcal > 0 ? minKcal : MIN_DAY_KCAL;
  if (!Number.isFinite(baseKcal) || baseKcal < floor) return baseKcal;

  const rCount = 7 - tCount;
  const weekly = 7 * baseKcal;

  let trainingKcal = Math.round(baseKcal * 1.12);
  let restTotal = weekly - tCount * trainingKcal;
  let restKcal = Math.floor(restTotal / rCount);

  if (restKcal < floor) {
    // Pin rest days at the floor and give training days whatever is left. With
    // baseKcal >= floor this keeps training days at or above the floor too.
    trainingKcal = Math.floor((weekly - rCount * floor) / tCount);
    restTotal = weekly - tCount * trainingKcal;
    restKcal = Math.floor(restTotal / rCount);
  }

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
  // Flooring leaves a remainder; the last rest day absorbs it, so it is the
  // largest rest day and never dips under the floor.
  if (lastRest >= 0) days[lastRest] = restTotal - restKcal * (rCount - 1);

  return days[jsWeekday];
}
