import { describe, expect, it } from "vitest";
import { addDays } from "./dates";
import type { WeightEntry } from "./types";
import { buildWeightChart } from "./weight-chart";

describe("buildWeightChart", () => {
  it("returns [] when there are fewer than 2 weigh-ins", () => {
    expect(buildWeightChart([], 70)).toEqual([]);
    expect(buildWeightChart([{ date: "2026-01-01", kg: 80 }], 70)).toEqual([]);
  });

  it("two points produce a trend matching (last-first)/days", () => {
    const weights: WeightEntry[] = [
      { date: "2026-01-01", kg: 80 },
      { date: "2026-01-11", kg: 79 },
    ];
    const pts = buildWeightChart(weights, 75);
    expect(pts).toHaveLength(11);
    const rate = (79 - 80) / 10;
    expect(pts[0].date).toBe("2026-01-01");
    expect(pts[0].label).toBe("1/1");
    expect(pts[0].trend).toBeCloseTo(80, 10);
    expect(pts[5].date).toBe("2026-01-06");
    expect(pts[5].trend).toBeCloseTo(80 + rate * 5, 10);
    expect(pts[pts.length - 1].date).toBe("2026-01-11");
    expect(pts[pts.length - 1].label).toBe("11/1");
    expect(pts[pts.length - 1].trend).toBeCloseTo(79, 10);
  });

  it("goal is constant on every day", () => {
    const pts = buildWeightChart(
      [
        { date: "2026-01-01", kg: 80 },
        { date: "2026-01-03", kg: 79.5 },
      ],
      72.5,
    );
    expect(pts.length).toBeGreaterThan(0);
    expect(pts.every((p) => p.goal === 72.5)).toBe(true);
  });

  it("band contains the trend line and is at least ±0.3 kg when residuals are 0", () => {
    const pts = buildWeightChart(
      [
        { date: "2026-01-01", kg: 70 },
        { date: "2026-01-11", kg: 69 },
      ],
      65,
    );
    expect(pts.length).toBeGreaterThan(0);
    for (const p of pts) {
      expect(p.bandLow).toBeLessThanOrEqual(p.trend);
      expect(p.bandHigh).toBeGreaterThanOrEqual(p.trend);
      expect(p.trend - p.bandLow).toBeCloseTo(0.3, 10);
      expect(p.bandHigh - p.trend).toBeCloseTo(0.3, 10);
    }
  });

  it("a mid-span day without a weigh-in has kg=null but trend filled", () => {
    const pts = buildWeightChart(
      [
        { date: "2026-01-01", kg: 80 },
        { date: "2026-01-04", kg: 79 },
      ],
      75,
    );
    expect(pts.map((p) => p.date)).toEqual(["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04"]);
    expect(pts[0].kg).toBe(80);
    expect(pts[1].kg).toBeNull();
    expect(pts[2].kg).toBeNull();
    expect(pts[3].kg).toBe(79);
    expect(Number.isFinite(pts[1].trend)).toBe(true);
    expect(pts[1].trend).toBeCloseTo(80 + ((79 - 80) / 3) * 1, 10);
  });

  it("widens the band when residuals vs the first-last line exceed 0.3 kg", () => {
    const pts = buildWeightChart(
      [
        { date: "2026-01-01", kg: 70 },
        { date: "2026-01-06", kg: 80 },
        { date: "2026-01-11", kg: 70 },
      ],
      70,
    );
    const half = pts[0].trend - pts[0].bandLow;
    expect(half).toBeGreaterThan(0.3);
    expect(pts.every((p) => p.bandLow <= p.trend && p.trend <= p.bandHigh)).toBe(true);
  });

  it("covers the last 30 weigh-ins and uses the last 21 for the trend rate", () => {
    const weights: WeightEntry[] = [];
    for (let i = 0; i < 35; i++) {
      weights.push({ date: addDays("2026-01-01", i), kg: 90 - i * 0.1 });
    }
    const pts = buildWeightChart(weights, 70);
    expect(pts[0].date).toBe(addDays("2026-01-01", 5));
    expect(pts[pts.length - 1].date).toBe(addDays("2026-01-01", 34));

    const trendWs = weights.slice(-21);
    const first = trendWs[0];
    const last = trendWs[trendWs.length - 1];
    const days = (new Date(2026, 0, 1 + 34).getTime() - new Date(2026, 0, 1 + 14).getTime()) / 86400000;
    const rate = (last.kg - first.kg) / Math.max(1, days);
    const start = pts.find((p) => p.date === first.date);
    expect(start).toBeDefined();
    expect(start!.kg).toBe(first.kg);
    expect(start!.trend).toBeCloseTo(first.kg, 10);
    const end = pts[pts.length - 1];
    expect(end.kg).toBe(last.kg);
    expect(end.trend).toBeCloseTo(last.kg, 10);
    expect(end.trend).toBeCloseTo(first.kg + rate * days, 8);
  });
});
