import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays, addMonths, canPlanFurther, daysBetween, fmtMonthYear, MAX_PLAN_DAYS_AHEAD, mealForHour, monthGrid, monthStart, shouldRollViewDate, weekColumns, dateOf } from "./dates";

describe("daysBetween across the clock change", () => {
  // Spain moves the clocks on the last Sunday of March and of October, so
  // 2026-03-29 lasts 23 h and 2026-10-25 lasts 25 h. Under UTC the old
  // millisecond division looked right; here it did not.
  const originalTz = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = "Europe/Madrid";
  });
  afterAll(() => {
    process.env.TZ = originalTz;
  });

  it("counts whole days when the clocks go forward", () => {
    expect(daysBetween("2026-03-22", "2026-04-05")).toBe(14);
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
  });

  it("counts whole days when the clocks go back", () => {
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
    expect(daysBetween("2026-10-01", "2026-11-01")).toBe(31);
  });

  it("is signed and zero on the same day", () => {
    expect(daysBetween("2026-04-05", "2026-03-22")).toBe(-14);
    expect(daysBetween("2026-03-29", "2026-03-29")).toBe(0);
  });
});

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

describe("canPlanFurther", () => {
  const today = "2026-08-22";

  it("allows advancing through today and the plannable window", () => {
    expect(canPlanFurther(today, today)).toBe(true);
    expect(canPlanFurther(addDays(today, 1), today)).toBe(true);
    expect(canPlanFurther(addDays(today, MAX_PLAN_DAYS_AHEAD - 1), today)).toBe(true);
  });

  it("stops exactly at today + MAX_PLAN_DAYS_AHEAD", () => {
    expect(canPlanFurther(addDays(today, MAX_PLAN_DAYS_AHEAD), today)).toBe(false);
    expect(canPlanFurther(addDays(today, MAX_PLAN_DAYS_AHEAD + 3), today)).toBe(false);
  });

  it("allows any day in the past", () => {
    expect(canPlanFurther(addDays(today, -30), today)).toBe(true);
  });

  it("respects a custom window", () => {
    expect(canPlanFurther(addDays(today, 2), today, 2)).toBe(false);
    expect(canPlanFurther(addDays(today, 1), today, 2)).toBe(true);
  });
});

describe("shouldRollViewDate", () => {
  it("does nothing while the day has not changed", () => {
    expect(shouldRollViewDate("2026-08-22", "2026-08-22", "2026-08-22")).toBe(false);
    expect(shouldRollViewDate("2026-08-15", "2026-08-22", "2026-08-22")).toBe(false);
  });

  it("rolls someone sitting on today over to the new day", () => {
    expect(shouldRollViewDate("2026-08-22", "2026-08-22", "2026-08-23")).toBe(true);
  });

  it("rolls an unset viewDate too", () => {
    expect(shouldRollViewDate("", "2026-08-22", "2026-08-23")).toBe(true);
  });

  it("leaves a day the user deliberately opened alone", () => {
    // Reviewing last Tuesday at 00:01 must not yank the screen to the new today.
    expect(shouldRollViewDate("2026-08-18", "2026-08-22", "2026-08-23")).toBe(false);
    // Nor a future day being planned.
    expect(shouldRollViewDate("2026-08-27", "2026-08-22", "2026-08-23")).toBe(false);
  });
});

describe("mealForHour", () => {
  it("uses Spanish mealtimes", () => {
    expect(mealForHour(8)).toBe("desayuno");
    expect(mealForHour(14)).toBe("comida");
    expect(mealForHour(18)).toBe("snack");
    expect(mealForHour(21)).toBe("cena");
  });

  it("treats a 21:30 dinner as dinner, not a tentempié", () => {
    // It used to return "snack" from 21:00 on, while the app's own default
    // dinner reminder fires at exactly 21:00.
    expect(mealForHour(21)).toBe("cena");
    expect(mealForHour(22)).toBe("cena");
    expect(mealForHour(23)).toBe("cena");
  });

  it("keeps the afternoon merienda slot", () => {
    expect(mealForHour(17)).toBe("snack");
    expect(mealForHour(19)).toBe("snack");
  });

  it("covers every hour of the day", () => {
    for (let h = 0; h < 24; h++) {
      expect(["desayuno", "comida", "cena", "snack"]).toContain(mealForHour(h));
    }
  });
});

describe("weekColumns", () => {
  const sunday = "2026-08-23";
  const saturday = "2026-08-22";

  it("returns one column per week, seven rows each", () => {
    const cols = weekColumns(saturday, 12);
    expect(cols).toHaveLength(12);
    expect(cols.every((c) => c.length === 7)).toBe(true);
  });

  it("puts Monday at the top of every column", () => {
    for (const col of weekColumns(saturday, 4)) {
      const first = col.find((k) => k != null);
      // Every column starts on a Monday, which is what the old 7-column grid
      // only managed by accident.
      if (first) expect(dateOf(first).getDay()).toBe(1);
    }
  });

  it("ends on the requested day and leaves the rest of that week empty", () => {
    const cols = weekColumns(saturday, 3);
    const last = cols[cols.length - 1];
    // Saturday is row 5 (Mon=0), so Sunday is still to come.
    expect(last[5]).toBe(saturday);
    expect(last[6]).toBeNull();
  });

  it("fills the final column when the day is a Sunday", () => {
    const last = weekColumns(sunday, 2)[1];
    expect(last[6]).toBe(sunday);
    expect(last.every((k) => k != null)).toBe(true);
  });

  it("covers exactly the requested span with no gaps or repeats", () => {
    const keys = weekColumns(saturday, 5).flat().filter((k): k is string => k != null);
    expect(new Set(keys).size).toBe(keys.length);
    const sorted = [...keys].sort();
    expect(sorted[sorted.length - 1]).toBe(saturday);
  });

  it("never returns fewer than one week", () => {
    expect(weekColumns(saturday, 0)).toHaveLength(1);
    expect(weekColumns(saturday, -3)).toHaveLength(1);
  });
});
