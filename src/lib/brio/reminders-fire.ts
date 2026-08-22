import type { ReminderNotice } from "./reminders";

export function firedKey(day: string, id: string): string {
  return id === "water" ? `${day}:water` : `${day}:${id}`;
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
