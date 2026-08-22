import { useSyncExternalStore } from "react";

export type UndoEntry = {
  label: string;
  apply: () => void;
};

export const MAX_UNDO = 20;

const stack: UndoEntry[] = [];
let applying = false;

export function isApplyingUndo(): boolean {
  return applying;
}

// Lets a "last actions" panel re-render when the stack changes, without
// polling: the stack itself lives outside React/Zustand, so this is a
// minimal pub-sub for useSyncExternalStore (same pattern this codebase
// already uses for the module-level catalog-loading state).
type Listener = () => void;
const listeners = new Set<Listener>();

// useSyncExternalStore expects getSnapshot to return a stable reference when
// nothing changed; recomputing a fresh array on every call would make it
// look "changed" on every render. Cache it, invalidate on notify().
let cachedList: string[] | null = null;

function notify(): void {
  cachedList = null;
  for (const l of listeners) l();
}

export function subscribeUndo(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function pushUndo(entry: UndoEntry): void {
  if (applying) return;
  stack.push(entry);
  if (stack.length > MAX_UNDO) stack.shift();
  notify();
}

export function popUndo(): UndoEntry | null {
  const entry = stack.pop() ?? null;
  if (entry) notify();
  return entry;
}

export function clearUndo(): void {
  if (!stack.length) return;
  stack.length = 0;
  notify();
}

export function undoCount(): number {
  return stack.length;
}

/** Labels only, most recent first — for display, never mutates the stack. */
export function listUndo(): string[] {
  if (!cachedList) cachedList = stack.map((e) => e.label).reverse();
  return cachedList;
}

/** Live view of `listUndo()` for a "last actions" panel. */
export function useUndoList(): string[] {
  return useSyncExternalStore(subscribeUndo, listUndo, listUndo);
}

/** Run an inverse without recording nested undo entries. */
export function applyUndo(entry: UndoEntry): void {
  applying = true;
  try {
    entry.apply();
  } finally {
    applying = false;
  }
}
