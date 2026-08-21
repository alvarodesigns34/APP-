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

export function pushUndo(entry: UndoEntry): void {
  if (applying) return;
  stack.push(entry);
  if (stack.length > MAX_UNDO) stack.shift();
}

export function popUndo(): UndoEntry | null {
  return stack.pop() ?? null;
}

export function clearUndo(): void {
  stack.length = 0;
}

export function undoCount(): number {
  return stack.length;
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
