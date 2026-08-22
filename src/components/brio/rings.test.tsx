import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Bar, Ring, Rings } from "./rings";

function markup(pct: number) {
  return renderToStaticMarkup(<Ring r={58} pct={pct} color="var(--brio-kcal)" />);
}

describe("Ring overflow", () => {
  it("marks p===1 as complete, without overflow chrome", () => {
    const html = markup(1);
    expect(html).toContain('data-overflow="false"');
    expect(html).not.toContain('data-overflow="true"');
    expect(html).not.toContain("data-overflow-arc");
    expect(html).not.toContain("data-overflow-tick");
    expect(html).toContain("var(--brio-kcal)");
    expect(html).not.toContain("var(--brio-bad)");
    expect(html).not.toContain("var(--brio-warn)");
  });

  it("makes p>1 distinguishable from p===1", () => {
    const atGoal = markup(1);
    const over = markup(1.5);
    expect(over).not.toBe(atGoal);
    expect(over).toContain('data-overflow="true"');
    expect(over).toContain("data-overflow-arc");
    expect(over).toContain("data-overflow-tick");
    expect(over).toContain("var(--brio-bad)");
    expect(over).toContain("var(--brio-warn)");
    expect(over).toMatch(/stroke-dashoffset="[^"]+"/);
  });

  it("treats the old 1.05 clamp as overflow, unlike a full ring", () => {
    const atGoal = markup(1);
    const justOver = markup(1.05);
    expect(justOver).not.toBe(atGoal);
    expect(justOver).toContain('data-overflow="true"');
    expect(justOver).toContain("data-overflow-arc");
    expect(atGoal).toContain('data-overflow="false"');
  });

  it("keeps overflow arc shorter than a full extra lap for 3000/2000", () => {
    const html = markup(3000 / 2000);
    const offsets = [...html.matchAll(/stroke-dashoffset="([^"]+)"/g)].map((m) => Number(m[1]));
    expect(offsets.length).toBe(2);
    const c = 2 * Math.PI * 58;
    expect(offsets[0]).toBeCloseTo(0, 5);
    expect(offsets[1]).toBeCloseTo(c * 0.5, 5);
    expect(offsets[1]).not.toBeCloseTo(offsets[0], 5);
  });

  it("does not mark empty or in-progress rings as overflow", () => {
    expect(markup(0)).toContain('data-overflow="false"');
    expect(markup(0.72)).toContain('data-overflow="false"');
    expect(markup(0)).not.toContain("data-overflow-arc");
  });
});

describe("Rings layout", () => {
  it("keeps default size and viewBox so Hoy does not jump", () => {
    const html = renderToStaticMarkup(<Rings kcal={1.5} steps={1} move={0.4} />);
    expect(html).toContain('width="148"');
    expect(html).toContain('height="148"');
    expect(html).toContain('viewBox="0 0 140 140"');
  });

  it("flags only the rings that exceed the goal", () => {
    const html = renderToStaticMarkup(<Rings kcal={1.2} steps={1} move={0.4} />);
    expect(html.match(/data-overflow="true"/g)?.length).toBe(1);
    expect(html.match(/data-overflow="false"/g)?.length).toBe(2);
  });
});

describe("non-finite ratios", () => {
  it("renders Ring as empty instead of vanishing when pct is NaN", () => {
    const nan = markup(NaN);
    expect(nan).toBe(markup(0));
    expect(nan).not.toContain("NaN");
    expect(nan).toContain('data-overflow="false"');
  });

  it("renders Ring as empty for Infinity rather than an overflow arc", () => {
    expect(markup(Infinity)).not.toContain("NaN");
    expect(markup(-Infinity)).toBe(markup(0));
  });

  it("renders Bar at 0% instead of an invalid width", () => {
    const nan = renderToStaticMarkup(<Bar pct={NaN} color="var(--brio-kcal)" />);
    expect(nan).toContain("width:0%");
    expect(nan).not.toContain("NaN");
  });

  it("still clamps a normal Bar to 0..100", () => {
    expect(renderToStaticMarkup(<Bar pct={-20} color="red" />)).toContain("width:0%");
    expect(renderToStaticMarkup(<Bar pct={250} color="red" />)).toContain("width:100%");
  });
});
