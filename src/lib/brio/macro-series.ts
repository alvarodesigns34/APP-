/** Calendar-day window, same length as weight `ma7`. */
export const MACRO_MA_WINDOW = 7;
/** Same floor as weight `ma7`: need ≥2 logged days in the window. */
export const MACRO_MA_MIN_POINTS = 2;

export type MacroDayIn = {
  d: string;
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
};

export type MacroGoals = {
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
};

export type MacroSeriesPoint<T extends MacroDayIn = MacroDayIn> = T & {
  kcalMa: number | null;
  protMa: number | null;
  carbMa: number | null;
  fatMa: number | null;
  kcalGoal: number;
  protGoal: number;
  carbGoal: number;
  fatGoal: number;
};

/**
 * Mean of `pick` over days with kcal > 0 in (endIndex - 6 .. endIndex).
 *
 * Empty days stay 0 on the bar chart; they are excluded from the average so
 * zeros don't pull it down (same idea as `weeklyInsights` water: divide by
 * days with a log, not by 7). Null unless the window has ≥ 2 logged days
 * (same floor as weight `ma7`).
 */
export function loggedDayMean<T extends MacroDayIn>(
  days: T[],
  endIndex: number,
  pick: (d: T) => number,
  window = MACRO_MA_WINDOW,
  minPoints = MACRO_MA_MIN_POINTS,
): number | null {
  if (endIndex < 0 || endIndex >= days.length) return null;
  const start = Math.max(0, endIndex - window + 1);
  let sum = 0;
  let n = 0;
  for (let i = start; i <= endIndex; i++) {
    const day = days[i];
    if (day.kcal > 0) {
      sum += pick(day);
      n += 1;
    }
  }
  if (n < minPoints) return null;
  return sum / n;
}

/** Attach 7-day logged-day MA and a constant goal line for kcal / prot / carb / fat. */
export function buildMacroSeries<T extends MacroDayIn>(days: T[], goals: MacroGoals): MacroSeriesPoint<T>[] {
  return days.map((day, i) => ({
    ...day,
    kcalMa: loggedDayMean(days, i, (d) => d.kcal),
    protMa: loggedDayMean(days, i, (d) => d.prot),
    carbMa: loggedDayMean(days, i, (d) => d.carb),
    fatMa: loggedDayMean(days, i, (d) => d.fat),
    kcalGoal: goals.kcal,
    protGoal: goals.prot,
    carbGoal: goals.carb,
    fatGoal: goals.fat,
  }));
}
