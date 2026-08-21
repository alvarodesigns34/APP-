import { afterEach, describe, expect, it } from "vitest";
import { applyUndo, clearUndo, MAX_UNDO, popUndo, pushUndo, undoCount } from "./undo";

afterEach(() => {
  clearUndo();
});

describe("undo stack", () => {
  it("pops last-in first-out", () => {
    const order: string[] = [];
    pushUndo({ label: "a", apply: () => order.push("a") });
    pushUndo({ label: "b", apply: () => order.push("b") });
    pushUndo({ label: "c", apply: () => order.push("c") });
    expect(popUndo()?.label).toBe("c");
    expect(popUndo()?.label).toBe("b");
    expect(popUndo()?.label).toBe("a");
    expect(order).toEqual([]);
  });

  it("empty pop is null", () => {
    expect(popUndo()).toBeNull();
    expect(undoCount()).toBe(0);
  });

  it("drops oldest when over max", () => {
    for (let i = 0; i < MAX_UNDO + 5; i++) {
      pushUndo({ label: String(i), apply: () => {} });
    }
    expect(undoCount()).toBe(MAX_UNDO);
    expect(popUndo()?.label).toBe(String(MAX_UNDO + 4));
    const rest: string[] = [];
    let entry = popUndo();
    while (entry) {
      rest.push(entry.label);
      entry = popUndo();
    }
    expect(rest.at(-1)).toBe("5");
    expect(rest).toHaveLength(MAX_UNDO - 1);
  });

  it("clear empties the stack", () => {
    pushUndo({ label: "x", apply: () => {} });
    clearUndo();
    expect(popUndo()).toBeNull();
    expect(undoCount()).toBe(0);
  });

  it("applies the inverse and ignores nested pushes", () => {
    let n = 0;
    pushUndo({
      label: "outer",
      apply: () => {
        n += 1;
        pushUndo({ label: "nested", apply: () => {} });
      },
    });
    const entry = popUndo();
    expect(entry).not.toBeNull();
    applyUndo(entry!);
    expect(n).toBe(1);
    expect(popUndo()).toBeNull();
  });
});
