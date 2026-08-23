import { describe, expect, it } from "vitest";
import { defaultState } from "./persist";
import { weightTrend } from "./selectors";
import type { PersistedState, WeightEntry } from "./types";

function withWeights(weights: WeightEntry[], goal: number): PersistedState {
  const s = defaultState();
  s.goals.weight = goal;
  s.weights = weights;
  return s;
}

describe("weightTrend", () => {
  it("eta when remaining and rate are both positive (gaining toward a higher goal)", () => {
    const t = weightTrend(
      withWeights(
        [
          { date: "2026-01-01", kg: 70 },
          { date: "2026-01-11", kg: 71 },
        ],
        75,
      ),
    );
    expect(t).not.toBeNull();
    expect(t!.remaining).toBeGreaterThan(0);
    expect(t!.rate).toBeGreaterThan(0);
    expect(t!.eta).toBe(40);
  });

  it("no eta when remaining is positive and rate is negative (losing away from a higher goal)", () => {
    const t = weightTrend(
      withWeights(
        [
          { date: "2026-01-01", kg: 71 },
          { date: "2026-01-11", kg: 70 },
        ],
        75,
      ),
    );
    expect(t).not.toBeNull();
    expect(t!.remaining).toBeGreaterThan(0);
    expect(t!.rate).toBeLessThan(0);
    expect(t!.eta).toBeNull();
  });

  it("eta when remaining and rate are both negative (losing toward a lower goal)", () => {
    const t = weightTrend(
      withWeights(
        [
          { date: "2026-01-01", kg: 70 },
          { date: "2026-01-11", kg: 69 },
        ],
        65,
      ),
    );
    expect(t).not.toBeNull();
    expect(t!.remaining).toBeLessThan(0);
    expect(t!.rate).toBeLessThan(0);
    expect(t!.eta).toBe(40);
  });

  it("measures the rate in whole days when the window crosses the clock change", () => {
    const originalTz = process.env.TZ;
    process.env.TZ = "Europe/Madrid";
    try {
      // 2026-03-29 is 23 h long, so the span used to count as 13,96 days and
      // inflated the rate — and with it the "llegarías en unos N días" figure.
      const t = weightTrend(
        withWeights(
          [
            { date: "2026-03-22", kg: 80 },
            { date: "2026-04-05", kg: 78 },
          ],
          75,
        ),
      );
      expect(t!.rate).toBeCloseTo(-2 / 14, 12);
      expect(t!.eta).toBe(21);
    } finally {
      process.env.TZ = originalTz;
    }
  });

  it("no eta when remaining is negative and rate is positive (gaining away from a lower goal)", () => {
    const t = weightTrend(
      withWeights(
        [
          { date: "2026-01-01", kg: 69 },
          { date: "2026-01-11", kg: 70 },
        ],
        65,
      ),
    );
    expect(t).not.toBeNull();
    expect(t!.remaining).toBeLessThan(0);
    expect(t!.rate).toBeGreaterThan(0);
    expect(t!.eta).toBeNull();
  });
});
