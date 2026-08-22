import { describe, expect, it, vi } from "vitest";
import { fireDueReminders, firedKey } from "./reminders-fire";
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
