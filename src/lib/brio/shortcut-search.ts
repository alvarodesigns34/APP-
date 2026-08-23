import type { QuickLogKind } from "./hotkeys";

export type ShortcutKind = QuickLogKind;

export function parseShortcutSearch(search: string): ShortcutKind | null {
  const q = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(q);
  if (params.get("agua") === "1") return "water";
  if (params.get("peso") === "1") return "weight";
  if (params.get("entreno") === "1") return "workout";
  if (params.get("log") === "1") return "food";
  return null;
}

export function stripShortcutSearch(search: string): string {
  const q = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(q);
  params.delete("agua");
  params.delete("peso");
  params.delete("entreno");
  params.delete("log");
  const next = params.toString();
  return next ? `?${next}` : "";
}

/**
 * Survives a React effect remount (Strict Mode / unstable `navigate` identity).
 * First call remembers the kind even after the URL is stripped; later takes
 * return null so the action fires once.
 */
let captured: ShortcutKind | null | undefined;
let taken = false;

export function resetShortcutConsume(): void {
  captured = undefined;
  taken = false;
}

export function takeShortcut(search: string): ShortcutKind | null {
  if (captured === undefined) captured = parseShortcutSearch(search);
  if (!captured || taken) return null;
  taken = true;
  return captured;
}

export function shortcutDest(kind: ShortcutKind): "/" | "/comida" {
  return kind === "food" ? "/comida" : "/";
}

export async function bootShortcut(opts: {
  search: string;
  pathname: string;
  hash: string;
  navigate: (to: "/" | "/comida") => Promise<unknown> | unknown;
  emit: (kind: ShortcutKind) => void;
  replaceUrl: (url: string) => void;
}): Promise<ShortcutKind | null> {
  const kind = takeShortcut(opts.search);
  if (!kind) return null;
  opts.replaceUrl(`${opts.pathname}${stripShortcutSearch(opts.search)}${opts.hash}`);
  await opts.navigate(shortcutDest(kind));
  opts.emit(kind);
  return kind;
}
