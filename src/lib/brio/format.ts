export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function round(v: number, d = 0): number {
  const p = Math.pow(10, d);
  return Math.round(v * p) / p;
}

export function uid(prefix = "x"): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function nf(v: number | null | undefined, d = 0): string {
  // Number.isFinite also rules out ±Infinity, which used to render literally
  // as "Infinity" instead of the em dash placeholder.
  if (v == null || !Number.isFinite(v)) return "—";
  const n = round(v, d);
  const parts = String(Math.abs(n)).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (n < 0 ? "-" : "") + parts[0] + (parts[1] ? `,${parts[1]}` : "");
}

export function parseNum(v: string | number | null | undefined): number {
  if (v == null) return NaN;
  const s = String(v).trim().replace(",", ".");
  if (s === "") return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * `plural(1, "día", "días")` → "1 día". Both forms are spelled out because
 * Spanish plurals are not a reliable "+s" (sesión → sesiones), and several
 * strings around the app used to read "1 días" / "1 sesiones".
 */
export function plural(n: number, one: string, many: string): string {
  return `${nf(n)} ${n === 1 ? one : many}`;
}

/**
 * Like `parseNum`, but only accepts a finite value strictly greater than zero.
 * Quantities the user types (grams, ml, kg, minutes, cm) are never negative,
 * and `parseNum` alone happily returns -500 for "-500".
 */
export function parsePositive(v: string | number | null | undefined): number {
  const n = parseNum(v);
  return n > 0 ? n : NaN;
}

export function norm(s: string): string {
  const low = String(s).toLowerCase();
  return low.normalize ? low.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : low;
}

export function ageFrom(birth: string, on = new Date()): number {
  const p = birth.split("-").map(Number);
  if (p.length < 3 || !p[0]) return 0;
  let age = on.getFullYear() - p[0];
  const md = on.getMonth() + 1 - (p[1] || 1);
  if (md < 0 || (md === 0 && on.getDate() < (p[2] || 1))) age -= 1;
  return age;
}
