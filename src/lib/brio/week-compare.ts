export type WeekTotals = {
  kcalAvg: number; // mean of days with kcal>0; 0 if none
  protAvg: number; // same days
  stepsAvg: number; // mean of all 7 days (0-filled)
  moveMin: number; // SUM of workout minutes over 7 days
  foodDays: number;
};

export type WeekDelta = {
  abs: number;
  pct: number | null; // null if prev === 0
  dir: "up" | "down" | "flat";
};

export function weekTotals(
  keys: string[],
  foodTotals: (key: string) => { kcal: number; prot: number },
  stepsOf: (key: string) => number,
  moveOf: (key: string) => number,
): WeekTotals {
  let kcalSum = 0;
  let protSum = 0;
  let foodDays = 0;
  let stepsSum = 0;
  let moveMin = 0;
  for (const k of keys) {
    const f = foodTotals(k);
    if (f.kcal > 0) {
      foodDays += 1;
      kcalSum += f.kcal;
      protSum += f.prot;
    }
    stepsSum += stepsOf(k);
    moveMin += moveOf(k);
  }
  return {
    kcalAvg: foodDays ? kcalSum / foodDays : 0,
    protAvg: foodDays ? protSum / foodDays : 0,
    stepsAvg: keys.length ? stepsSum / keys.length : 0,
    moveMin,
    foodDays,
  };
}

/** True when a week has no logged data at all — nothing to compare against. */
export function isWeekEmpty(w: WeekTotals): boolean {
  return w.foodDays === 0 && w.stepsAvg === 0 && w.moveMin === 0;
}

export function delta(curr: number, prev: number): WeekDelta {
  const abs = curr - prev;
  const pct = prev === 0 ? null : Math.round((abs / prev) * 100);
  const dir: WeekDelta["dir"] = Math.round(abs) === 0 ? "flat" : abs > 0 ? "up" : "down";
  return { abs, pct, dir };
}

export function compareWeeks(
  curr: WeekTotals,
  prev: WeekTotals,
): {
  kcal: WeekDelta;
  prot: WeekDelta;
  steps: WeekDelta;
  move: WeekDelta;
} {
  return {
    kcal: delta(curr.kcalAvg, prev.kcalAvg),
    prot: delta(curr.protAvg, prev.protAvg),
    steps: delta(curr.stepsAvg, prev.stepsAvg),
    move: delta(curr.moveMin, prev.moveMin),
  };
}
