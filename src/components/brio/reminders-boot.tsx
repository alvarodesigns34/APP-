import { useEffect } from "react";
import { todayKey } from "@/lib/brio/dates";
import { dueReminders } from "@/lib/brio/reminders";
import { waterTotal } from "@/lib/brio/selectors";
import { useBrioStore } from "@/lib/brio/store";
import { AUX_STORE_KEYS } from "@/lib/brio/types";

const FIRED_KEY = AUX_STORE_KEYS[1];

function loadLastFired(): Record<string, number> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(FIRED_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object" || Array.isArray(o)) return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      const n = Number(v);
      if (Number.isFinite(n)) out[k] = n;
    }
    return out;
  } catch {
    return {};
  }
}

function saveLastFired(map: Record<string, number>) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify(map));
  } catch {
    /* quota */
  }
}

function tick() {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  const s = useBrioStore.getState();
  if (!s.hydrated) return;
  const reminders = s.settings.reminders;
  if (!reminders.enabled) return;
  const day = todayKey();
  const dayLog = s.days[day];
  const lastFired = loadLastFired();
  const due = dueReminders(new Date(), reminders, lastFired, {
    mealHasFood: {
      desayuno: (dayLog?.meals.desayuno.length ?? 0) > 0,
      comida: (dayLog?.meals.comida.length ?? 0) > 0,
      cena: (dayLog?.meals.cena.length ?? 0) > 0,
    },
    waterMl: waterTotal(s, day),
    waterGoal: s.goals.water,
    weighedToday: s.weights.some((w) => w.date === day),
  });
  if (!due.length) return;
  const now = Date.now();
  for (const n of due) {
    if (n.id === "water") lastFired.water = now;
    else lastFired[`${day}:${n.id}`] = now;
  }
  saveLastFired(lastFired);
  if (!("serviceWorker" in navigator)) return;
  void navigator.serviceWorker.ready.then((reg) => {
    for (const n of due) {
      void reg.showNotification(n.title, {
        body: n.body,
        icon: "/icon-192.png",
        tag: `brio-${n.id}`,
        data: { url: n.url },
        renotify: false,
      } as NotificationOptions);
    }
  });
}

export function RemindersBoot() {
  const hydrated = useBrioStore((s) => s.hydrated);
  const enabled = useBrioStore((s) => s.settings.reminders.enabled);

  useEffect(() => {
    if (!hydrated) return;
    tick();
    const id = window.setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [hydrated, enabled]);

  return null;
}
