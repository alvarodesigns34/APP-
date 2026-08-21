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
