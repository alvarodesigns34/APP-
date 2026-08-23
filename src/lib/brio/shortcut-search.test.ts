import { afterEach, describe, expect, it, vi } from "vitest";
import { bootShortcut, parseShortcutSearch, resetShortcutConsume, shortcutDest, stripShortcutSearch, takeShortcut } from "./shortcut-search";

afterEach(() => {
  resetShortcutConsume();
});

describe("parseShortcutSearch", () => {
  it("maps agua / peso / log query flags", () => {
    expect(parseShortcutSearch("?agua=1")).toBe("water");
    expect(parseShortcutSearch("?peso=1")).toBe("weight");
    expect(parseShortcutSearch("?log=1")).toBe("food");
    expect(parseShortcutSearch("")).toBeNull();
    expect(parseShortcutSearch("?foo=1")).toBeNull();
  });
});

describe("stripShortcutSearch", () => {
  it("drops shortcut flags and keeps other params", () => {
    expect(stripShortcutSearch("?agua=1")).toBe("");
    expect(stripShortcutSearch("?log=1&x=2")).toBe("?x=2");
  });
});

describe("takeShortcut", () => {
  it("remembers the kind after the URL is stripped (effect remount)", () => {
    expect(takeShortcut("?agua=1")).toBe("water");
    expect(takeShortcut("")).toBeNull();
  });
});

describe("bootShortcut", () => {
  it("emits once even if the effect re-runs after replaceState", async () => {
    const emit = vi.fn();
    const navigate = vi.fn(async () => {});
    const replaceUrl = vi.fn();

    await bootShortcut({
      search: "?agua=1",
      pathname: "/",
      hash: "",
      navigate,
      emit,
      replaceUrl,
    });
    await bootShortcut({
      search: "",
      pathname: "/",
      hash: "",
      navigate,
      emit,
      replaceUrl,
    });

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith("water");
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/");
    expect(replaceUrl).toHaveBeenCalledWith("/");
  });

  it("navigates to /comida for log=1 before emitting", async () => {
    const emit = vi.fn();
    await bootShortcut({
      search: "?log=1",
      pathname: "/comida",
      hash: "",
      navigate: vi.fn(async () => {}),
      emit,
      replaceUrl: vi.fn(),
    });
    expect(emit).toHaveBeenCalledWith("food");
  });
});

describe("atajo de entreno", () => {
  // Comida, agua y peso ya estaban; entreno es el cuarto registro del día y
  // era el único de los cuatro sin atajo en el manifiesto.
  it("reconoce ?entreno=1", () => {
    expect(parseShortcutSearch("?entreno=1")).toBe("workout");
  });

  it("lo quita de la url como los demás", () => {
    expect(stripShortcutSearch("?entreno=1")).toBe("");
    expect(stripShortcutSearch("?entreno=1&otro=2")).toBe("?otro=2");
  });

  it("va a Hoy, que es donde está la hoja de entreno", () => {
    expect(shortcutDest("workout")).toBe("/");
  });
});
