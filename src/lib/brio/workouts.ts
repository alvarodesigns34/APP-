import { ACTIVITIES, activityOf, type Sport } from "./domain";
import { rangeKeys, todayKey } from "./dates";
import { norm } from "./format";
import { workoutMinTotal } from "./selectors";
import type { SelectorState, WorkoutEntry } from "./types";

export type WorkoutSession = WorkoutEntry & { date: string };

export type SportMark = {
  type: string;
  name: string;
  sessions: number;
  bestMin: number;
  bestKcal: number;
  lastDate: string;
  weekMin: number;
};

/** Every logged session, newest first. Takes only `days` so a component can subscribe to that slice alone. */
export function allSessions(s: Pick<SelectorState, "days">): WorkoutSession[] {
  const out: WorkoutSession[] = [];
  for (const [date, day] of Object.entries(s.days)) {
    for (const w of day.workouts) out.push({ ...w, date });
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? 1 : -1));
}

/**
 * The last `limit` distinct sports the user actually logged, most recent first.
 *
 * The workout sheet showed 45 chips in four groups and nothing else, so the two
 * sports somebody trains every week were as far away as the ones they will
 * never pick. Sessions whose `type` is no longer in activities.json are skipped:
 * `activityOf` falls back to the first sport for an unknown id, which would put
 * a chip in the row that lies about what it logs.
 */
export function recentSports(s: Pick<SelectorState, "days">, limit = 4): Sport[] {
  const out: Sport[] = [];
  for (const sess of allSessions(s)) {
    if (out.length >= limit) break;
    if (out.some((a) => a.id === sess.type)) continue;
    const sport = ACTIVITIES.find((a) => a.id === sess.type);
    if (sport) out.push(sport);
  }
  return out;
}

/**
 * Accent-insensitive sport filter: "padel" finds "Pádel", "natac" finds
 * "Natación". Prefix hits lead so typing "remo" puts "Remo" above the sports
 * that merely contain it.
 */
export function searchSports(q: string, list: Sport[] = ACTIVITIES): Sport[] {
  const needle = norm(q).trim();
  if (!needle) return list;
  return list
    .filter((a) => norm(a.n).includes(needle))
    .sort((a, b) => Number(norm(b.n).startsWith(needle)) - Number(norm(a.n).startsWith(needle)));
}

export function weekWorkoutMin(s: SelectorState): number {
  return rangeKeys(todayKey(), 7).reduce((n, k) => n + workoutMinTotal(s, k), 0);
}

export function sportMarks(s: SelectorState): SportMark[] {
  const week = new Set(rangeKeys(todayKey(), 7));
  const map = new Map<string, SportMark>();
  for (const sess of allSessions(s)) {
    const cur = map.get(sess.type);
    if (!cur) {
      map.set(sess.type, {
        type: sess.type,
        name: activityOf(sess.type).n,
        sessions: 1,
        bestMin: sess.min,
        bestKcal: sess.kcal,
        lastDate: sess.date,
        weekMin: week.has(sess.date) ? sess.min : 0,
      });
    } else {
      cur.sessions += 1;
      if (sess.min > cur.bestMin) cur.bestMin = sess.min;
      if (sess.kcal > cur.bestKcal) cur.bestKcal = sess.kcal;
      if (sess.date > cur.lastDate) cur.lastDate = sess.date;
      if (week.has(sess.date)) cur.weekMin += sess.min;
    }
  }
  return [...map.values()].sort((a, b) => b.sessions - a.sessions);
}
