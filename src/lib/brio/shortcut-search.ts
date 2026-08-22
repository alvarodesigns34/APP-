import type { QuickLogKind } from "./hotkeys";

export type ShortcutKind = QuickLogKind;

export function parseShortcutSearch(search: string): ShortcutKind | null {
  const q = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(q);
  if (params.get("agua") === "1") return "water";
  if (params.get("peso") === "1") return "weight";
  if (params.get("log") === "1") return "food";
  return null;
}

export function stripShortcutSearch(search: string): string {
  const q = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(q);
  params.delete("agua");
  params.delete("peso");
  params.delete("log");
  const next = params.toString();
  return next ? `?${next}` : "";
}
