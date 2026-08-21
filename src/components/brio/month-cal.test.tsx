/** @vitest-environment jsdom */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { WEEKDAYS } from "@/lib/brio/dates";
import { MonthCal } from "./month-cal";

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

afterEach(() => {
  mounted?.root.unmount();
  mounted = null;
  document.body.innerHTML = "";
});

describe("MonthCal", () => {
  const counts: Record<string, number> = {
    "2026-08-20": 4,
    "2026-08-21": 3,
    "2026-08-19": 1,
  };

  function markup(today = "2026-08-22") {
    return renderToStaticMarkup(
      <MonthCal today={today} countFor={(k) => counts[k] ?? 0} onSelect={() => {}} />,
    );
  }

  it("renders Spanish weekday headers L M X J V S D", () => {
    const html = markup();
    for (const w of WEEKDAYS) expect(html).toContain(`>${w}<`);
    expect(html).toContain("Agosto 2026");
  });

  it("outlines today and colors days by goalsMet count", () => {
    const html = markup();
    expect(html).toContain('aria-current="date"');
    expect(html).toContain("ring-2 ring-inset ring-foreground");
    expect(html).toMatch(/data-key="2026-08-20"[^>]*bg-primary[" ]/);
    expect(html).toMatch(/data-key="2026-08-21"[^>]*bg-primary\/70/);
    expect(html).toMatch(/data-key="2026-08-19"[^>]*bg-primary\/30/);
    expect(html).toMatch(/data-key="2026-08-22"[^>]*bg-muted/);
  });

  it("disables days after today", () => {
    const html = markup("2026-08-22");
    expect(html).toContain('data-key="2026-08-23"');
    expect(html).toMatch(/data-key="2026-08-23"[^>]*disabled/);
    expect(html).not.toMatch(/data-key="2026-08-22"[^>]*disabled/);
  });

  it("calls onSelect with the day key", () => {
    const picked: string[] = [];
    const { el } = mount(
      <MonthCal today="2026-08-22" countFor={(k) => counts[k] ?? 0} onSelect={(k) => picked.push(k)} />,
    );
    const btn = el.querySelector<HTMLButtonElement>('button[data-key="2026-08-20"]');
    expect(btn).toBeTruthy();
    act(() => {
      btn!.click();
    });
    expect(picked).toEqual(["2026-08-20"]);
  });

  it("navigates to the previous month and blocks next on the current month", () => {
    const { el } = mount(
      <MonthCal today="2026-08-22" countFor={() => 0} onSelect={() => {}} />,
    );
    const next = el.querySelector<HTMLButtonElement>('button[aria-label="Mes siguiente"]');
    const prev = el.querySelector<HTMLButtonElement>('button[aria-label="Mes anterior"]');
    expect(next?.disabled).toBe(true);
    act(() => {
      prev!.click();
    });
    expect(el.querySelector("[data-testid=month-label]")?.textContent).toBe("Julio 2026");
    expect(el.querySelector<HTMLButtonElement>('button[aria-label="Mes siguiente"]')?.disabled).toBe(false);
  });
});
