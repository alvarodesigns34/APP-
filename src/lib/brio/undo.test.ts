import { afterEach, describe, expect, it, vi } from "vitest";
import { applyUndo, clearUndo, listUndo, MAX_UNDO, popUndo, pushUndo, subscribeUndo, undoCount } from "./undo";

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

describe("listUndo", () => {
  it("lists labels most-recent-first without mutating the stack", () => {
    pushUndo({ label: "a", apply: () => {} });
    pushUndo({ label: "b", apply: () => {} });
    pushUndo({ label: "c", apply: () => {} });
    expect(listUndo()).toEqual(["c", "b", "a"]);
    expect(undoCount()).toBe(3);
  });

  it("returns a stable reference until the stack changes", () => {
    pushUndo({ label: "a", apply: () => {} });
    const first = listUndo();
    expect(listUndo()).toBe(first);
    pushUndo({ label: "b", apply: () => {} });
    expect(listUndo()).not.toBe(first);
    expect(listUndo()).toEqual(["b", "a"]);
  });

  it("nested pushes during applyUndo do not notify (they are dropped, per pushUndo)", () => {
    pushUndo({ label: "outer", apply: () => pushUndo({ label: "nested", apply: () => {} }) });
    const before = listUndo();
    applyUndo(popUndo()!);
    expect(listUndo()).toEqual([]);
    expect(listUndo()).not.toBe(before);
  });
});

describe("subscribeUndo", () => {
  it("notifies on push, pop and clear, and unsubscribes cleanly", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeUndo(listener);

    pushUndo({ label: "a", apply: () => {} });
    expect(listener).toHaveBeenCalledTimes(1);

    popUndo();
    expect(listener).toHaveBeenCalledTimes(2);

    popUndo(); // empty stack: no change, no notify
    expect(listener).toHaveBeenCalledTimes(2);

    pushUndo({ label: "b", apply: () => {} });
    clearUndo();
    expect(listener).toHaveBeenCalledTimes(4);

    clearUndo(); // already empty: no notify
    expect(listener).toHaveBeenCalledTimes(4);

    unsubscribe();
    pushUndo({ label: "c", apply: () => {} });
    expect(listener).toHaveBeenCalledTimes(4);
  });
});
