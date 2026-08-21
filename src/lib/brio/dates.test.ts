import { describe, expect, it } from "vitest";
import { addMonths, fmtMonthYear, monthGrid, monthStart } from "./dates";

describe("month helpers", () => {
  it("monthStart pins to day 01", () => {
    expect(monthStart("2026-08-22")).toBe("2026-08-01");
  });

  it("addMonths wraps the year", () => {
    expect(addMonths("2026-12-01", 1)).toBe("2027-01-01");
    expect(addMonths("2026-01-01", -1)).toBe("2025-12-01");
    expect(addMonths("2026-08-22", -1)).toBe("2026-07-01");
  });

  it("fmtMonthYear is Spanish title case", () => {
    expect(fmtMonthYear("2026-08-01")).toBe("Agosto 2026");
    expect(fmtMonthYear("2026-01-15")).toBe("Enero 2026");
  });

  it("monthGrid starts weeks on Monday and pads to full weeks", () => {
    // 1 Aug 2026 is Saturday → 5 leading cells, 31 days, 6 trailing = 42
    const cells = monthGrid(2026, 7);
    expect(cells.length).toBe(42);
    expect(cells.length % 7).toBe(0);
    expect(cells.slice(0, 5).every((k) => k == null)).toBe(true);
    expect(cells[5]).toBe("2026-08-01");
    expect(cells[35]).toBe("2026-08-31");
    expect(cells.slice(36).every((k) => k == null)).toBe(true);
  });

  it("monthGrid places a Thursday-start month with 3 leading blanks", () => {
    const cells = monthGrid(2026, 0);
    expect(cells.slice(0, 3).every((k) => k == null)).toBe(true);
    expect(cells[3]).toBe("2026-01-01");
    expect(cells.filter(Boolean)).toHaveLength(31);
  });
});
