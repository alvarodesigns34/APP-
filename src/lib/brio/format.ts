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
  if (v == null || Number.isNaN(v)) return "—";
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
