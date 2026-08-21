/** @vitest-environment jsdom */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ScrollRestore } from "./scroll-restore";

const loc = { pathname: "/" };

vi.mock("@tanstack/react-router", () => ({
  useRouterState: ({ select }: { select: (s: { location: { pathname: string } }) => unknown }) =>
    select({ location: loc }),
}));

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let scrollY = 0;

let mounted: { root: Root; el: HTMLDivElement } | null = null;

function mount(ui: ReactNode): { root: Root; el: HTMLDivElement } {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const root = createRoot(el);
  act(() => {
    root.render(ui);
  });
  mounted = { root, el };
  return mounted;
}

async function flushFrame() {
  await act(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function userScroll(y: number) {
  scrollY = y;
  window.dispatchEvent(new Event("scroll"));
}

function go(root: Root, pathname: string) {
  loc.pathname = pathname;
  act(() => {
    root.render(<ScrollRestore />);
  });
}

afterEach(() => {
  if (mounted) {
    act(() => {
      mounted!.root.unmount();
    });
    mounted.el.remove();
    mounted = null;
  }
  loc.pathname = "/";
  scrollY = 0;
});

beforeEach(() => {
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    get: () => scrollY,
  });
  window.scrollTo = ((xOrOptions?: number | ScrollToOptions, y?: number) => {
    if (typeof xOrOptions === "object" && xOrOptions) {
      scrollY = Number(xOrOptions.top ?? scrollY);
    } else if (typeof y === "number") {
      scrollY = y;
    }
  }) as typeof window.scrollTo;
});

describe("ScrollRestore", () => {
  it("restores the previous window.scrollY when returning to a pathname", async () => {
    const { root } = mount(<ScrollRestore />);
    await flushFrame();

    userScroll(420);

    go(root, "/comida");
    await flushFrame();
    expect(scrollY).toBe(0);

    userScroll(180);

    go(root, "/");
    await flushFrame();
    expect(scrollY).toBe(420);

    go(root, "/comida");
    await flushFrame();
    expect(scrollY).toBe(180);
  });

  it("does not treat the restore jump as a user scroll on the new route", async () => {
    const { root } = mount(<ScrollRestore />);
    await flushFrame();
    userScroll(240);

    go(root, "/tendencias");
    await flushFrame();
    expect(scrollY).toBe(0);

    go(root, "/");
    await flushFrame();
    expect(scrollY).toBe(240);

    go(root, "/tendencias");
    await flushFrame();
    expect(scrollY).toBe(0);
  });
});
