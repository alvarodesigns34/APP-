/**
 * The accent (the app's "main colour") is chosen from a fixed palette rather
 * than a free colour picker on purpose: `--brio-primary` is used both as a
 * filled background with text on top *and* as text/icons on a card, so every
 * option has to clear contrast against three different surfaces in two
 * themes. A picker would happily produce a pastel yellow button with cream
 * text on it. The values themselves live in styles.css, keyed by
 * `[data-accent="…"]`, so this module never has to restate them — see
 * accent.test.ts, which reads that file and asserts the contrast holds.
 */
export const ACCENTS = [
  { id: "verde", n: "Verde" },
  { id: "salvia", n: "Salvia" },
  { id: "oliva", n: "Oliva" },
  { id: "ciruela", n: "Ciruela" },
  { id: "frambuesa", n: "Frambuesa" },
  { id: "violeta", n: "Violeta" },
  { id: "ambar", n: "Ámbar" },
  { id: "grafito", n: "Grafito" },
] as const;

export type AccentId = (typeof ACCENTS)[number]["id"];

export const DEFAULT_ACCENT: AccentId = "verde";

const IDS = new Set<string>(ACCENTS.map((a) => a.id));

export function isAccentId(v: unknown): v is AccentId {
  return typeof v === "string" && IDS.has(v);
}

export function accentName(id: AccentId): string {
  return ACCENTS.find((a) => a.id === id)?.n ?? id;
}
