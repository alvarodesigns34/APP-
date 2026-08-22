import { activityOf } from "./domain";
import { rangeKeys, todayKey } from "./dates";
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

export function allSessions(s: SelectorState): WorkoutSession[] {
  const out: WorkoutSession[] = [];
  for (const [date, day] of Object.entries(s.days)) {
    for (const w of day.workouts) out.push({ ...w, date });
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? 1 : -1));
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
