/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import {
  TAB_BY_DIGIT,
  QUICK_LOG_EVENT,
  emitQuickLog,
  isTypingTarget,
  matchHotkey,
  resolveHotkey,
  type HotkeyEvent,
} from "./hotkeys";

function ev(partial: Partial<HotkeyEvent> & Pick<HotkeyEvent, "key">): HotkeyEvent {
  return {
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    ...partial,
  };
}

describe("TAB_BY_DIGIT", () => {
  it("maps 1–5 to the five tabs", () => {
    expect(TAB_BY_DIGIT).toEqual({
      "1": "/",
      "2": "/comida",
      "3": "/actividad",
      "4": "/tendencias",
      "5": "/ajustes",
    });
  });
});

describe("matchHotkey", () => {
  it("maps digits 1–5 to tabs", () => {
    expect(matchHotkey(ev({ key: "1" }))).toEqual({ type: "tab", to: "/" });
    expect(matchHotkey(ev({ key: "2" }))).toEqual({ type: "tab", to: "/comida" });
    expect(matchHotkey(ev({ key: "3" }))).toEqual({ type: "tab", to: "/actividad" });
    expect(matchHotkey(ev({ key: "4" }))).toEqual({ type: "tab", to: "/tendencias" });
    expect(matchHotkey(ev({ key: "5" }))).toEqual({ type: "tab", to: "/ajustes" });
  });

  it("ignores digits outside 1–5", () => {
    expect(matchHotkey(ev({ key: "0" }))).toBeNull();
    expect(matchHotkey(ev({ key: "6" }))).toBeNull();
  });

  it("opens quick food on n or N", () => {
    expect(matchHotkey(ev({ key: "n" }))).toEqual({ type: "quick", kind: "food" });
    expect(matchHotkey(ev({ key: "N" }))).toEqual({ type: "quick", kind: "food" });
  });

  it("opens help on ? or Shift+/", () => {
    expect(matchHotkey(ev({ key: "?" }))).toEqual({ type: "help" });
    expect(matchHotkey(ev({ key: "?", shiftKey: true }))).toEqual({ type: "help" });
    expect(matchHotkey(ev({ key: "/", shiftKey: true }))).toEqual({ type: "help" });
    expect(matchHotkey(ev({ key: "/" }))).toBeNull();
  });

  it("undoes on ctrl/cmd+z without shift", () => {
    expect(matchHotkey(ev({ key: "z", ctrlKey: true }))).toEqual({ type: "undo" });
    expect(matchHotkey(ev({ key: "Z", ctrlKey: true }))).toEqual({ type: "undo" });
    expect(matchHotkey(ev({ key: "z", metaKey: true }))).toEqual({ type: "undo" });
    expect(matchHotkey(ev({ key: "Z", metaKey: true }))).toEqual({ type: "undo" });
  });

  it("does not steal redo or other ctrl/cmd shortcuts", () => {
    expect(matchHotkey(ev({ key: "z", ctrlKey: true, shiftKey: true }))).toBeNull();
    expect(matchHotkey(ev({ key: "z", metaKey: true, shiftKey: true }))).toBeNull();
    expect(matchHotkey(ev({ key: "c", ctrlKey: true }))).toBeNull();
    expect(matchHotkey(ev({ key: "1", metaKey: true }))).toBeNull();
    expect(matchHotkey(ev({ key: "n", ctrlKey: true }))).toBeNull();
    expect(matchHotkey(ev({ key: "?", metaKey: true }))).toBeNull();
  });

  it("ignores alt", () => {
    expect(matchHotkey(ev({ key: "z", ctrlKey: true, altKey: true }))).toBeNull();
    expect(matchHotkey(ev({ key: "1", altKey: true }))).toBeNull();
    expect(matchHotkey(ev({ key: "n", altKey: true }))).toBeNull();
    expect(matchHotkey(ev({ key: "?", altKey: true }))).toBeNull();
  });

  it("ignores unrelated keys", () => {
    expect(matchHotkey(ev({ key: "a" }))).toBeNull();
    expect(matchHotkey(ev({ key: "Escape" }))).toBeNull();
    expect(matchHotkey(ev({ key: "w" }))).toBeNull();
  });
});

describe("resolveHotkey", () => {
  it("returns the match when not typing", () => {
    expect(resolveHotkey(ev({ key: "1" }), false)).toEqual({ type: "tab", to: "/" });
    expect(resolveHotkey(ev({ key: "n" }), false)).toEqual({ type: "quick", kind: "food" });
    expect(resolveHotkey(ev({ key: "?", shiftKey: true }), false)).toEqual({ type: "help" });
    expect(resolveHotkey(ev({ key: "z", ctrlKey: true }), false)).toEqual({ type: "undo" });
  });

  it("returns null while typing even for known keys", () => {
    expect(resolveHotkey(ev({ key: "1" }), true)).toBeNull();
    expect(resolveHotkey(ev({ key: "n" }), true)).toBeNull();
    expect(resolveHotkey(ev({ key: "?" }), true)).toBeNull();
    expect(resolveHotkey(ev({ key: "z", ctrlKey: true }), true)).toBeNull();
    expect(resolveHotkey(ev({ key: "/", shiftKey: true }), true)).toBeNull();
  });
});

describe("isTypingTarget", () => {
  it("detects inputs, textareas and selects", () => {
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget(document.createElement("div"))).toBe(false);
    expect(isTypingTarget(document.createElement("button"))).toBe(false);
    expect(isTypingTarget(document.createElement("input"))).toBe(true);
    expect(isTypingTarget(document.createElement("textarea"))).toBe(true);
    expect(isTypingTarget(document.createElement("select"))).toBe(true);
  });
});

describe("emitQuickLog", () => {
  it("dispatches a window event with the kind", () => {
    const kinds: unknown[] = [];
    function onQuick(e: Event) {
      kinds.push((e as CustomEvent).detail);
    }
    window.addEventListener(QUICK_LOG_EVENT, onQuick);
    emitQuickLog("food");
    emitQuickLog("water");
    window.removeEventListener(QUICK_LOG_EVENT, onQuick);
    expect(kinds).toEqual(["food", "water"]);
  });
});
