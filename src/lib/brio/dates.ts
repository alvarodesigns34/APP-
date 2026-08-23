import type { MealId } from "./types";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const MESES_C = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/**
 * La forma de una clave de día. Vive aquí, junto a `keyOf`/`dateOf`, porque la
 * usan tanto la vista previa de un backup como la carga que de verdad importa
 * los días: tenerla dos veces era tener dos criterios distintos de qué cuenta
 * como fecha, y la vista previa llegó a contar menos días de los que entraban.
 */
export const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function keyOf(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function todayKey(): string {
  return keyOf(new Date());
}

export function dateOf(key: string): Date {
  const p = key.split("-");
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}

export function addDays(key: string, n: number): string {
  const d = dateOf(key);
  d.setDate(d.getDate() + n);
  return keyOf(d);
}

/**
 * Cuántos días se puede planificar hacia delante. Esta es la única definición:
 * el comentario que había apuntaba a una constante del mismo nombre en
 * date-nav.tsx que no existe — ese componente llama a `canPlanFurther` sin
 * tercer argumento y se queda con este valor por defecto.
 */
export const MAX_PLAN_DAYS_AHEAD = 7;

/** True while `key` is still within the plannable window ahead of `today`. */
export function canPlanFurther(key: string, today: string, maxDaysAhead = MAX_PLAN_DAYS_AHEAD): boolean {
  return key < addDays(today, maxDaysAhead);
}

/**
 * Whether the day the app is showing should follow the clock over midnight.
 *
 * A PWA left open overnight keeps `viewDate` on the day it was opened, so "Hoy"
 * quietly becomes yesterday. Roll forward only when the user is actually
 * sitting on what used to be today — never drag them off a day they chose.
 */
export function shouldRollViewDate(viewDate: string, prevToday: string, nextToday: string): boolean {
  if (prevToday === nextToday) return false;
  return viewDate === "" || viewDate === prevToday;
}

/**
 * Whole calendar days from `a` to `b`, signed.
 *
 * Both keys resolve to local midnight, and the day the clocks change is 23 or
 * 25 hours long, so dividing the millisecond gap gave 13,96 days for the two
 * weeks around the last Sunday of March. That fed the weight rate and the
 * "llegarías en unos N días" estimate. Rounding recovers the calendar count:
 * the drift is at most an hour out of twenty-four.
 */
export function daysBetween(a: string, b: string): number {
  return Math.round((dateOf(b).getTime() - dateOf(a).getTime()) / 86400000);
}

export function rangeKeys(endKey: string, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(endKey, -i));
  return out;
}

export function fmtDateLong(key: string): string {
  const d = dateOf(key);
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

export function fmtDateRelative(key: string): string {
  const t = todayKey();
  if (key === t) return "Hoy";
  if (key === addDays(t, -1)) return "Ayer";
  if (key === addDays(t, 1)) return "Mañana";
  const d = dateOf(key);
  return `${capitalize(DIAS[d.getDay()])} ${d.getDate()} ${MESES_C[d.getMonth()]}`;
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "Buenas noches";
  if (h < 13) return "Buenos días";
  if (h < 21) return "Buenas tardes";
  return "Buenas noches";
}

export function minutesToHM(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  if (r === 0) return `${h} h`;
  return `${h} h ${r} min`;
}

export function minutesToClock(min: number): string {
  let m = Math.round(min) % 1440;
  if (m < 0) m += 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function clockToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function sleepDuration(bed: number, wake: number): number {
  let d = wake - bed;
  if (d < 0) d += 1440;
  return d;
}

export function nowMinutes(): number {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

/**
 * Which meal an hour belongs to, on Spanish mealtimes.
 *
 * The old boundaries sent anything from 21:00 on to "snack", so a 21:30 dinner
 * — normal here — was filed as a tentempié, and the strip on Hoy titled itself
 * "Al vuelo · Tentempiés" at dinner time. It also contradicted the app's own
 * default dinner reminder, which is set to 21:00.
 */
export function mealForHour(h = new Date().getHours()): MealId {
  if (h < 11) return "desayuno";
  if (h < 16) return "comida";
  if (h < 20) return "snack";
  return "cena";
}

export function fmtMonthYear(key: string): string {
  const d = dateOf(key);
  return `${capitalize(MESES[d.getMonth()])} ${d.getFullYear()}`;
}

export function monthStart(key: string): string {
  const d = dateOf(key);
  d.setDate(1);
  return keyOf(d);
}

export function addMonths(key: string, n: number): string {
  const d = dateOf(key);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return keyOf(d);
}

export const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"] as const;

/**
 * A heat map laid out as weeks-in-columns, Monday at the top of each column,
 * ending with the week that contains `endKey`.
 *
 * The previous layout poured N days into a 7-column grid, which looks like a
 * calendar but is really a wrapping strip: a column only lines up with a
 * weekday if the first day happens to be a Monday. Here column = week and row =
 * weekday always, and days after `endKey` come back as null so the current week
 * is not padded with squares that have not happened.
 */
export function weekColumns(endKey: string, weeks: number): (string | null)[][] {
  const n = Math.max(1, Math.floor(weeks));
  const dow = (dateOf(endKey).getDay() + 6) % 7;
  const start = addDays(endKey, -dow - (n - 1) * 7);
  const cols: (string | null)[][] = [];
  for (let w = 0; w < n; w++) {
    const col: (string | null)[] = [];
    for (let d = 0; d < 7; d++) {
      const key = addDays(start, w * 7 + d);
      col.push(key > endKey ? null : key);
    }
    cols.push(col);
  }
  return cols;
}

export function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const n = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= n; d++) cells.push(keyOf(new Date(year, month, d)));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
