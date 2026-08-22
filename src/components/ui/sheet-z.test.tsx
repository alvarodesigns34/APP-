/** @vitest-environment jsdom */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { useSheetZ } from "./sheet-z";

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let mounted: { root: Root; el: HTMLDivElement } | null = null;

function mount(ui: ReactNode) {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const root = createRoot(el);
  act(() => {
    root.render(ui);
  });
  mounted = { root, el };
  return mounted;
}

function rerender(ui: ReactNode) {
  act(() => {
    mounted!.root.render(ui);
  });
}

function zOf(el: HTMLDivElement, id: string): number {
  return Number(el.querySelector(`[data-testid="${id}"]`)!.getAttribute("data-z"));
}

afterEach(() => {
  mounted?.root.unmount();
  mounted = null;
  document.body.innerHTML = "";
});

function Probe({ open, id }: { open: boolean; id: string }) {
  const z = useSheetZ(open);
  return <div data-testid={id} data-z={z} />;
}

describe("useSheetZ", () => {
  it("stays at the default z when never opened", () => {
    const { el } = mount(<Probe open={false} id="a" />);
    expect(zOf(el, "a")).toBe(50);
  });

  it("gives a sheet opened afterwards a higher z than one already open — the actual nested-sheet case", () => {
    // Mirrors food-log.tsx: the main sheet is already open, then "crear
    // alimento" or "escanear código" opens a second one on top of it.
    const { el } = mount(
      <>
        <Probe open={true} id="a" />
        <Probe open={false} id="b" />
      </>,
    );
    const zA = zOf(el, "a");
    rerender(
      <>
        <Probe open={true} id="a" />
        <Probe open={true} id="b" />
      </>,
    );
    expect(zOf(el, "b")).toBeGreaterThan(zA);
  });

  it("puts a sheet back on top when it is reopened after another was opened over it", () => {
    const { el } = mount(
      <>
        <Probe open={true} id="a" />
        <Probe open={true} id="b" />
      </>,
    );
    const zBOnTop = zOf(el, "b");
    rerender(
      <>
        <Probe open={false} id="a" />
        <Probe open={true} id="b" />
      </>,
    );
    rerender(
      <>
        <Probe open={true} id="a" />
        <Probe open={true} id="b" />
      </>,
    );
    expect(zOf(el, "a")).toBeGreaterThan(zBOnTop);
  });
});
