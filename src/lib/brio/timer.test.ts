import { describe, expect, it } from "vitest";
import { remainingSeconds } from "./timer";

const NOW = 1_700_000_000_000;

describe("remainingSeconds", () => {
  it("rounds up so a fresh timer shows the full duration", () => {
    expect(remainingSeconds(NOW + 90_000, NOW)).toBe(90);
    expect(remainingSeconds(NOW + 89_999, NOW)).toBe(90);
    expect(remainingSeconds(NOW + 89_001, NOW)).toBe(90);
  });

  it("counts down with the clock", () => {
    const endsAt = NOW + 60_000;
    expect(remainingSeconds(endsAt, NOW + 1_000)).toBe(59);
    expect(remainingSeconds(endsAt, NOW + 30_500)).toBe(30);
    expect(remainingSeconds(endsAt, NOW + 59_500)).toBe(1);
  });

  it("clamps to 0 at and past endsAt", () => {
    const endsAt = NOW + 60_000;
    expect(remainingSeconds(endsAt, endsAt)).toBe(0);
    expect(remainingSeconds(endsAt, endsAt + 1)).toBe(0);
    expect(remainingSeconds(endsAt, endsAt + 3_600_000)).toBe(0);
  });

  it("survives a long gap between ticks (backgrounded tab)", () => {
    // The old counter subtracted 1 per tick, so five throttled ticks over four
    // real minutes left "115s" on screen. Off the clock, the same five ticks
    // land on the truth no matter when they fire.
    const endsAt = NOW + 120_000;
    const ticks = [NOW + 1_000, NOW + 2_000, NOW + 3_000, NOW + 4_000, NOW + 240_000];
    expect(ticks.map((t) => remainingSeconds(endsAt, t))).toEqual([119, 118, 117, 116, 0]);
  });

  it("treats a missing or broken end instant as finished", () => {
    expect(remainingSeconds(NaN, NOW)).toBe(0);
    expect(remainingSeconds(Infinity, NOW)).toBe(0);
  });
});
