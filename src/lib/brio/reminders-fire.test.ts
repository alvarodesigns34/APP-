import { describe, expect, it, vi } from "vitest";
import { fireDueReminders, firedKey, pruneLastFired } from "./reminders-fire";
import type { ReminderNotice } from "./reminders";

const due: ReminderNotice[] = [
  { id: "desayuno", title: "Desayuno", body: "Aún no has registrado esta comida.", url: "/comida" },
  { id: "water", title: "Agua", body: "Bebe un vaso.", url: "/" },
];

describe("fireDueReminders", () => {
  it("does not mark fired when there is no show function", async () => {
    const last = await fireDueReminders(due, "2026-08-22", {}, { show: null, baseUrl: "/" });
    expect(last).toEqual({});
  });

  it("marks only the notices that show() resolved", async () => {
    const show = vi.fn(async (title: string) => {
      if (title === "Agua") throw new Error("fail");
    });
    const last = await fireDueReminders(due, "2026-08-22", {}, { show, baseUrl: "/", now: 1000 });
    expect(last[firedKey("2026-08-22", "desayuno")]).toBe(1000);
    expect(last[firedKey("2026-08-22", "water")]).toBeUndefined();
    expect(show).toHaveBeenCalledTimes(2);
  });

  it("marks every notice when show() succeeds", async () => {
    const show = vi.fn(async () => {});
    const last = await fireDueReminders(due, "2026-08-22", { "2026-08-21:water": 1 }, { show, baseUrl: "/APP-/", now: 50 });
    expect(last["2026-08-21:water"]).toBe(1);
    expect(last["2026-08-22:desayuno"]).toBe(50);
    expect(last["2026-08-22:water"]).toBe(50);
  });
});

describe("firedKey", () => {
  it("is day-scoped for every reminder id, water included", () => {
    expect(firedKey("2026-08-22", "cena")).toBe("2026-08-22:cena");
    expect(firedKey("2026-08-22", "water")).toBe("2026-08-22:water");
    expect(firedKey("2026-08-22", "streak")).toBe("2026-08-22:streak");
  });
});

describe("pruneLastFired", () => {
  it("keeps today's entries and drops every other day", () => {
    const map = {
      "2026-08-20:cena": 1,
      "2026-08-21:water": 2,
      "2026-08-22:desayuno": 3,
      "2026-08-22:water": 4,
    };
    expect(pruneLastFired(map, "2026-08-22")).toEqual({
      "2026-08-22:desayuno": 3,
      "2026-08-22:water": 4,
    });
  });

  it("does not match a day that merely shares a prefix", () => {
    // "2026-08-2" is a prefix of "2026-08-22" as a plain string; the colon
    // in the separator is what stops a partial date from matching.
    expect(pruneLastFired({ "2026-08-22:cena": 1 }, "2026-08-2")).toEqual({});
  });

  it("returns an empty map when nothing is from today", () => {
    expect(pruneLastFired({ "2026-08-21:cena": 1 }, "2026-08-22")).toEqual({});
    expect(pruneLastFired({}, "2026-08-22")).toEqual({});
  });
});
