export const QUICK_LOG_EVENT = "brio:quick-log";
export type QuickLogKind = "food" | "water" | "steps" | "weight";

export const TAB_BY_DIGIT: Record<string, string> = {
  "1": "/",
  "2": "/comida",
  "3": "/actividad",
  "4": "/tendencias",
  "5": "/ajustes",
};

export type HotkeyEvent = {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
};

export type HotkeyAction =
  { type: "tab"; to: string } | { type: "quick"; kind: QuickLogKind } | { type: "help" } | { type: "undo" };

export function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function matchHotkey(e: HotkeyEvent): HotkeyAction | null {
  if (e.altKey) return null;

  if (e.metaKey || e.ctrlKey) {
    if (!e.shiftKey && (e.key === "z" || e.key === "Z")) return { type: "undo" };
    return null;
  }

  if (e.key === "?" || (e.key === "/" && e.shiftKey)) return { type: "help" };

  if (e.shiftKey) return null;

  const to = TAB_BY_DIGIT[e.key];
  if (to) return { type: "tab", to };

  if (e.key === "n" || e.key === "N") return { type: "quick", kind: "food" };

  return null;
}

export function resolveHotkey(e: HotkeyEvent, typing: boolean): HotkeyAction | null {
  if (typing) return null;
  return matchHotkey(e);
}

export function emitQuickLog(kind: QuickLogKind): void {
  window.dispatchEvent(new CustomEvent(QUICK_LOG_EVENT, { detail: kind }));
}
