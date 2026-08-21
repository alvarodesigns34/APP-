import { addDays, dateOf } from "./dates";
import type { WeightEntry } from "./types";

/** Calendar days of weigh-ins to plot (one point per day in that span). */
const CHART_WEIGH_INS = 30;
/** Same window as `weightTrend` in selectors.ts. */
const TREND_WEIGH_INS = 21;
/** Floor for the uncertainty half-width, in kg. */
const MIN_BAND_KG = 0.3;

export type WeightChartPoint = {
  date: string;
  label: string;
  kg: number | null;
  trend: number;
  goal: number;
  bandLow: number;
  bandHigh: number;
  /** Arithmetic mean of weigh-ins in [D-6, D]; null if fewer than 2. */
  ma7: number | null;
};

function shortDate(key: string): string {
  const parts = key.split("-");
  return `${Number(parts[2])}/${Number(parts[1])}`;
}

/** Same day-count rule as `weightTrend`: ms delta / 86400000. */
function daysBetween(a: string, b: string): number {
  return (dateOf(b).getTime() - dateOf(a).getTime()) / 86400000;
}

function sampleStdev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((acc, v) => acc + v, 0) / values.length;
  const sumSq = values.reduce((acc, v) => acc + (v - mean) ** 2, 0);
  return Math.sqrt(sumSq / (values.length - 1));
}

function keysInclusive(start: string, end: string): string[] {
  const out: string[] = [];
  let k = start;
  while (k <= end) {
    out.push(k);
    const next = addDays(k, 1);
    if (next === k) break;
    k = next;
    if (out.length > 4000) break;
  }
  return out;
}

/** Mean of kg values whose date falls in [start, end] inclusive; null if < 2. */
function meanInWindow(weights: WeightEntry[], start: string, end: string): number | null {
  let sum = 0;
  let n = 0;
  for (const w of weights) {
    if (w.date >= start && w.date <= end) {
      sum += w.kg;
      n += 1;
    }
  }
  if (n < 2) return null;
  return sum / n;
}

/**
 * One point per calendar day covering the last ~30 weigh-ins.
 * Trend uses the first–last line of the last 21 weigh-ins (same rate as `weightTrend`).
 */
export function buildWeightChart(weights: WeightEntry[], goalKg: number): WeightChartPoint[] {
  if (weights.length < 2) return [];

  const window = weights.slice(-CHART_WEIGH_INS);
  const trendWs = weights.slice(-TREND_WEIGH_INS);
  const first = trendWs[0];
  const last = trendWs[trendWs.length - 1];
  const span = Math.max(1, daysBetween(first.date, last.date));
  const rate = (last.kg - first.kg) / span;

  const residuals = trendWs.map((w) => {
    const t = daysBetween(first.date, w.date);
    return w.kg - (first.kg + rate * t);
  });
  const half = Math.max(MIN_BAND_KG, sampleStdev(residuals));

  const byDate = new Map<string, number>();
  for (const w of window) byDate.set(w.date, w.kg);

  return keysInclusive(window[0].date, window[window.length - 1].date).map((date) => {
    const trend = first.kg + rate * daysBetween(first.date, date);
    return {
      date,
      label: shortDate(date),
      kg: byDate.has(date) ? (byDate.get(date) as number) : null,
      trend,
      goal: goalKg,
      bandLow: trend - half,
      bandHigh: trend + half,
      ma7: meanInWindow(weights, addDays(date, -6), date),
    };
  });
}
