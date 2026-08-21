import { describe, expect, it } from "vitest";
import {
  DEFAULT_REMINDERS,
  dueReminders,
  parseReminders,
  parseTimeToMinutes,
  reminderDayKey,
  type ReminderNotice,
} from "./reminders";
import type { ReminderSettings } from "./types";

const emptyCtx = {
  mealHasFood: { desayuno: false, comida: false, cena: false },
  waterMl: 0,
  waterGoal: 2000,
  weighedToday: false,
};

function on(patch: Partial<ReminderSettings> = {}): ReminderSettings {
  return { ...DEFAULT_REMINDERS, enabled: true, water: false, weight: false, ...patch };
}

function ids(notices: ReminderNotice[]): string[] {
  return notices.map((n) => n.id);
}

describe("parseTimeToMinutes", () => {
  it("parses padded and unpadded clocks", () => {
    expect(parseTimeToMinutes("08:30")).toBe(510);
    expect(parseTimeToMinutes("8:30")).toBe(510);
    expect(parseTimeToMinutes("00:00")).toBe(0);
    expect(parseTimeToMinutes("23:59")).toBe(23 * 60 + 59);
  });

  it("rejects garbage", () => {
    expect(Number.isFinite(parseTimeToMinutes("nope"))).toBe(false);
    expect(Number.isFinite(parseTimeToMinutes("25:00"))).toBe(false);
    expect(Number.isFinite(parseTimeToMinutes("12:60"))).toBe(false);
  });
});

describe("reminderDayKey", () => {
  it("uses the local calendar day", () => {
    expect(reminderDayKey(new Date(2026, 7, 22, 0, 5))).toBe("2026-08-22");
    expect(reminderDayKey(new Date(2026, 7, 22, 23, 59))).toBe("2026-08-22");
  });
});

describe("parseReminders", () => {
  it("returns defaults for garbage", () => {
    expect(parseReminders(null)).toEqual(DEFAULT_REMINDERS);
    expect(parseReminders("nope")).toEqual(DEFAULT_REMINDERS);
    expect(parseReminders(1)).toEqual(DEFAULT_REMINDERS);
    expect(parseReminders([])).toEqual(DEFAULT_REMINDERS);
  });

  it("fills missing fields and sanitizes the rest", () => {
    expect(
      parseReminders({
        enabled: 1,
        desayuno: "nope",
        comida: "9:15",
        cena: "25:00",
        aguaEveryMin: 5,
        peso: "7:3",
        extra: true,
      }),
    ).toEqual({
      ...DEFAULT_REMINDERS,
      enabled: true,
      comida: "09:15",
      aguaEveryMin: 30,
    });
  });

  it("clamps aguaEveryMin to 30–360 and coerces booleans", () => {
    expect(parseReminders({ aguaEveryMin: 999, meals: 0, water: "yes", weight: false }).aguaEveryMin).toBe(360);
    const p = parseReminders({ meals: 0, water: "yes", weight: false });
    expect(p.meals).toBe(false);
    expect(p.water).toBe(true);
    expect(p.weight).toBe(false);
  });
});

describe("dueReminders", () => {
  it("returns none when disabled", () => {
    const now = new Date(2026, 7, 22, 15, 0);
    expect(dueReminders(now, DEFAULT_REMINDERS, {}, emptyCtx)).toEqual([]);
    expect(dueReminders(now, { ...DEFAULT_REMINDERS, enabled: false, meals: true }, {}, emptyCtx)).toEqual([]);
  });

  it("fires one meal when due and empty", () => {
    const now = new Date(2026, 7, 22, 8, 30);
    const notices = dueReminders(now, on(), {}, emptyCtx);
    expect(ids(notices)).toEqual(["desayuno"]);
    expect(notices[0].title).toBe("Desayuno");
    expect(notices[0].url).toBe("/comida");
    expect(notices[0].body.length).toBeGreaterThan(0);
  });

  it("skips a meal that already has food", () => {
    const now = new Date(2026, 7, 22, 9, 0);
    const notices = dueReminders(now, on(), {}, { ...emptyCtx, mealHasFood: { ...emptyCtx.mealHasFood, desayuno: true } });
    expect(notices).toEqual([]);
  });

  it("does not fire the same slot twice in a day", () => {
    const now = new Date(2026, 7, 22, 9, 0);
    const notices = dueReminders(now, on(), { "2026-08-22:desayuno": now.getTime() }, emptyCtx);
    expect(notices).toEqual([]);
  });

  it("fires again the next day for the same slot", () => {
    const now = new Date(2026, 7, 23, 8, 30);
    const notices = dueReminders(now, on(), { "2026-08-22:desayuno": Date.now() }, emptyCtx);
    expect(ids(notices)).toEqual(["desayuno"]);
  });

  it("does not fire a meal before its time", () => {
    const now = new Date(2026, 7, 22, 8, 29);
    expect(dueReminders(now, on(), {}, emptyCtx)).toEqual([]);
  });

  it("fires water on interval and skips when the goal is met", () => {
    const at = (h: number, m: number) => new Date(2026, 7, 22, h, m);
    const waterOn = on({ water: true, meals: false });
    expect(ids(dueReminders(at(10, 0), waterOn, {}, emptyCtx))).toEqual(["water"]);
    expect(dueReminders(at(9, 59), waterOn, {}, emptyCtx)).toEqual([]);
    expect(dueReminders(at(7, 0), waterOn, {}, emptyCtx)).toEqual([]);
    expect(dueReminders(at(22, 1), waterOn, {}, emptyCtx)).toEqual([]);

    const last = at(8, 0).getTime();
    expect(ids(dueReminders(at(10, 0), waterOn, { water: last }, emptyCtx))).toEqual(["water"]);
    expect(dueReminders(at(9, 59), waterOn, { water: last }, emptyCtx)).toEqual([]);
    expect(dueReminders(at(10, 0), waterOn, { water: at(10, 0).getTime() }, emptyCtx)).toEqual([]);

    expect(
      dueReminders(at(10, 0), waterOn, {}, { ...emptyCtx, waterMl: 2000, waterGoal: 2000 }),
    ).toEqual([]);
    expect(ids(dueReminders(at(10, 0), waterOn, {}, { ...emptyCtx, waterMl: 1999, waterGoal: 2000 }))).toEqual([
      "water",
    ]);
  });

  it("uses lastFired water even after 08:00, and 08:00 if never", () => {
    const waterOn = on({ water: true, meals: false, aguaEveryMin: 60 });
    const now = new Date(2026, 7, 22, 11, 0);
    expect(dueReminders(now, waterOn, { water: now.getTime() - 59 * 60 * 1000 }, emptyCtx)).toEqual([]);
    expect(ids(dueReminders(now, waterOn, { water: now.getTime() - 60 * 60 * 1000 }, emptyCtx))).toEqual(["water"]);
  });

  it("fires weight once per day when due and not logged", () => {
    const now = new Date(2026, 7, 22, 8, 0);
    const w = on({ weight: true, meals: false });
    const notices = dueReminders(now, w, {}, emptyCtx);
    expect(ids(notices)).toEqual(["peso"]);
    expect(notices[0].url).toBe("/");
    expect(dueReminders(now, w, {}, { ...emptyCtx, weighedToday: true })).toEqual([]);
    expect(dueReminders(now, w, { "2026-08-22:peso": now.getTime() }, emptyCtx)).toEqual([]);
  });
});
