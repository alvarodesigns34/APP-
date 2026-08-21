/** @vitest-environment jsdom */
import { act, useEffect, useRef, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { useShallow } from "zustand/react/shallow";
import { useBrioStore } from "./store";
import { todayKey } from "./dates";

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

function mount(ui: ReactNode): { root: Root; el: HTMLDivElement } {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const root = createRoot(el);
  act(() => {
    root.render(ui);
  });
  return { root, el };
}

afterEach(() => {
  document.body.innerHTML = "";
  useBrioStore.getState().resetAll();
});

function FullStoreProbe({ onRender }: { onRender: () => void }) {
  useBrioStore();
  const n = useRef(0);
  n.current += 1;
  useEffect(() => {
    onRender();
  });
  return <span data-testid="full">{n.current}</span>;
}

function DateNavProbe({ onRender }: { onRender: () => void }) {
  useBrioStore((s) => s.viewDate);
  useBrioStore((s) => s.setViewDate);
  const n = useRef(0);
  n.current += 1;
  useEffect(() => {
    onRender();
  });
  return <span data-testid="nav">{n.current}</span>;
}

function SettingsProbe({ onRender }: { onRender: () => void }) {
  useBrioStore((s) => s.profile);
  useBrioStore((s) => s.settings);
  useBrioStore((s) => s.goals);
  const n = useRef(0);
  n.current += 1;
  useEffect(() => {
    onRender();
  });
  return <span data-testid="settings">{n.current}</span>;
}

function TodaySliceProbe({ onRender }: { onRender: () => void }) {
  useBrioStore(
    useShallow((s) => ({
      days: s.days,
      goals: s.goals,
      profile: s.profile,
      settings: s.settings,
      weights: s.weights,
    })),
  );
  const n = useRef(0);
  n.current += 1;
  useEffect(() => {
    onRender();
  });
  return <span data-testid="today">{n.current}</span>;
}

describe("store subscriptions (render counts)", () => {
  it("DateNav and Settings do not re-render when water is logged; full store does", async () => {
    let full = 0;
    let nav = 0;
    let settings = 0;
    let today = 0;
    const a = mount(<FullStoreProbe onRender={() => { full += 1; }} />);
    const b = mount(<DateNavProbe onRender={() => { nav += 1; }} />);
    const c = mount(<SettingsProbe onRender={() => { settings += 1; }} />);
    const d = mount(<TodaySliceProbe onRender={() => { today += 1; }} />);
    await act(async () => {
      await Promise.resolve();
    });
    const before = { full, nav, settings, today };
    act(() => {
      useBrioStore.getState().addWater(todayKey(), 250);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(full).toBeGreaterThan(before.full);
    expect(nav).toBe(before.nav);
    expect(settings).toBe(before.settings);
    expect(today).toBeGreaterThan(before.today);
    a.root.unmount();
    b.root.unmount();
    c.root.unmount();
    d.root.unmount();
  });
});
