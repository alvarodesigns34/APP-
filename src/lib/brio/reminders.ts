import type { ReminderSettings } from "./types";

export const DEFAULT_REMINDERS: ReminderSettings = {
  enabled: false,
  meals: true,
  water: true,
  weight: false,
  streak: false,
  desayuno: "08:30",
  comida: "14:00",
  cena: "21:00",
  aguaEveryMin: 120,
  peso: "08:00",
  streakTime: "20:00",
};

const TIME_RE = /^(\d{1,2}):(\d{2})$/;

const MEAL_SLOTS = [
  { id: "desayuno" as const, title: "Desayuno", body: "Aún no has registrado esta comida." },
  { id: "comida" as const, title: "Comida", body: "Aún no has registrado esta comida." },
  { id: "cena" as const, title: "Cena", body: "Aún no has registrado esta comida." },
];

/**
 * How long past a meal's time it's still worth reminding about. Without this,
 * turning reminders on in the evening (or leaving the app closed all day)
 * fires every meal slot already in the past at once — a burst of stale nags
 * instead of a timely one.
 */
const MEAL_GRACE_MIN = 120;

export function parseTimeToMinutes(hhmm: string): number {
  const m = TIME_RE.exec(String(hhmm).trim());
  if (!m) return NaN;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return NaN;
  return h * 60 + min;
}

export function reminderDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseClock(v: unknown, fallback: string): string {
  if (typeof v !== "string") return fallback;
  const m = TIME_RE.exec(v.trim());
  if (!m) return fallback;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return fallback;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

function parseAguaEveryMin(v: unknown, fallback: number): number {
  // Cuarta repetición del mismo footgun: `Number(null)` es 0 y es finito, así
  // que un ajuste ausente no caía en el fallback (120 min) sino en el suelo del
  // clamp, 30 — cuadruplicando sin avisar la frecuencia del aviso de agua.
  if (v == null || v === "") return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(360, Math.max(30, Math.round(n)));
}

function parseBool(v: unknown, fallback: boolean): boolean {
  if (v == null) return fallback;
  return !!v;
}

export function parseReminders(raw: unknown): ReminderSettings {
  const d = DEFAULT_REMINDERS;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...d };
  const o = raw as Record<string, unknown>;
  return {
    enabled: parseBool(o.enabled, d.enabled),
    meals: parseBool(o.meals, d.meals),
    water: parseBool(o.water, d.water),
    weight: parseBool(o.weight, d.weight),
    streak: parseBool(o.streak, d.streak),
    desayuno: parseClock(o.desayuno, d.desayuno),
    comida: parseClock(o.comida, d.comida),
    cena: parseClock(o.cena, d.cena),
    aguaEveryMin: parseAguaEveryMin(o.aguaEveryMin, d.aguaEveryMin),
    peso: parseClock(o.peso, d.peso),
    streakTime: parseClock(o.streakTime, d.streakTime),
  };
}

export type ReminderNotice = { id: string; title: string; body: string; url: string };

export function dueReminders(
  now: Date,
  reminders: ReminderSettings,
  lastFired: Record<string, number>,
  ctx: {
    mealHasFood: Record<"desayuno" | "comida" | "cena", boolean>;
    waterMl: number;
    waterGoal: number;
    weighedToday: boolean;
    streakDays: number;
    goalsMetToday: number;
  },
): ReminderNotice[] {
  if (!reminders.enabled) return [];
  const out: ReminderNotice[] = [];
  const day = reminderDayKey(now);
  const mins = now.getHours() * 60 + now.getMinutes();

  if (reminders.meals) {
    for (const slot of MEAL_SLOTS) {
      if (ctx.mealHasFood[slot.id]) continue;
      if (Number.isFinite(lastFired[`${day}:${slot.id}`])) continue;
      const t = parseTimeToMinutes(reminders[slot.id]);
      if (!Number.isFinite(t) || mins < t || mins - t > MEAL_GRACE_MIN) continue;
      out.push({ id: slot.id, title: slot.title, body: slot.body, url: "/comida" });
    }
  }

  if (reminders.weight && !ctx.weighedToday && !Number.isFinite(lastFired[`${day}:peso`])) {
    const t = parseTimeToMinutes(reminders.peso);
    if (Number.isFinite(t) && mins >= t) {
      out.push({ id: "peso", title: "Pésate", body: "Anota el peso de hoy.", url: "/" });
    }
  }

  if (
    reminders.streak &&
    ctx.streakDays > 0 &&
    ctx.goalsMetToday < 3 &&
    !Number.isFinite(lastFired[`${day}:streak`])
  ) {
    const t = parseTimeToMinutes(reminders.streakTime);
    if (Number.isFinite(t) && mins >= t) {
      out.push({
        id: "streak",
        title: "Racha en juego",
        body: `Llevas ${ctx.streakDays} ${ctx.streakDays === 1 ? "día seguido" : "días seguidos"}. Hoy van ${ctx.goalsMetToday} de 5.`,
        url: "/",
      });
    }
  }

  if (reminders.water && ctx.waterMl < ctx.waterGoal && mins >= 8 * 60 && mins <= 22 * 60) {
    // Day-scoped like the meal and peso keys: an unscoped key carries yesterday's
    // last-fired time into today, so the day's first check (any time after 8:00)
    // sees a gap far bigger than aguaEveryMin and fires immediately instead of
    // waiting out the interval from today's start.
    const last = lastFired[`${day}:water`];
    const since =
      typeof last === "number" && Number.isFinite(last)
        ? last
        : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0, 0).getTime();
    if (now.getTime() - since >= reminders.aguaEveryMin * 60 * 1000) {
      out.push({ id: "water", title: "Bebe agua", body: "Sigue con tu objetivo de hidratación.", url: "/" });
    }
  }

  return out;
}
