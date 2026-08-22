import type { ReminderNotice } from "./reminders";

/** Bookkeeping key for "this reminder already fired today". Must match the keys `dueReminders` checks. */
export function firedKey(day: string, id: string): string {
  return `${day}:${id}`;
}

/**
 * Keeps only the entries belonging to `day`.
 *
 * Every key is day-scoped (`2026-08-22:cena`) and only today's are ever read,
 * but nothing used to drop the old ones: the map grew by one entry per
 * reminder per day forever, and was re-serialized to localStorage on every
 * fire.
 */
export function pruneLastFired(map: Record<string, number>, day: string): Record<string, number> {
  const prefix = `${day}:`;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(map)) {
    if (k.startsWith(prefix)) out[k] = v;
  }
  return out;
}

export type ShowNotification = (title: string, options: NotificationOptions) => Promise<void>;

/**
 * Persist lastFired only after a successful showNotification for that id.
 * Missing SW / rejected ready / failed show → that slot stays due.
 */
export async function fireDueReminders(
  due: ReminderNotice[],
  day: string,
  lastFired: Record<string, number>,
  opts: {
    show: ShowNotification | null;
    baseUrl: string;
    now?: number;
  },
): Promise<Record<string, number>> {
  if (!due.length || !opts.show) return lastFired;
  const now = opts.now ?? Date.now();
  const next = { ...lastFired };
  const base = opts.baseUrl;
  for (const n of due) {
    try {
      await opts.show(n.title, {
        body: n.body,
        icon: `${base}icon-192.png`,
        tag: `brio-${n.id}`,
        data: { url: `${base}${n.url.replace(/^\//, "")}` },
        renotify: false,
      } as NotificationOptions);
      next[firedKey(day, n.id)] = now;
    } catch {
      /* leave unfired so the next tick retries */
    }
  }
  return next;
}
