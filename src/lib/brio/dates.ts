const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const MESES_C = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

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
  if (d <= 0) d += 1440;
  return d;
}
