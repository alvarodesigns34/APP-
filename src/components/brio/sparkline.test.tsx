import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Sparkline } from "./sparkline";

function svg(values: number[]) {
  return renderToStaticMarkup(<Sparkline values={values} />);
}

function pathOf(markup: string): string {
  return /d="([^"]+)"/.exec(markup)?.[1] ?? "";
}

function pointsOf(markup: string): { x: number; y: number }[] {
  return pathOf(markup)
    .split(/(?=[ML])/)
    .filter(Boolean)
    .map((seg) => {
      const [x, y] = seg.slice(1).split(",").map(Number);
      return { x, y };
    });
}

describe("Sparkline", () => {
  it("no pinta nada con menos de dos puntos", () => {
    // Una línea plana con un solo pesaje sugeriría que te has medido varias
    // veces sin cambio, que es justo lo contrario de lo que pasa.
    expect(svg([])).toBe("");
    expect(svg([82])).toBe("");
  });

  it("pinta un punto por lectura, repartidos a lo ancho", () => {
    const pts = pointsOf(svg([80, 82, 84]));
    expect(pts).toHaveLength(3);
    expect(pts[0].x).toBe(0);
    expect(pts[2].x).toBe(64);
    expect(pts[1].x).toBe(32);
  });

  it("pone arriba el valor mayor: en SVG la Y crece hacia abajo", () => {
    const pts = pointsOf(svg([80, 90]));
    expect(pts[1].y).toBeLessThan(pts[0].y);
  });

  it("usa el alto completo menos el margen del trazo", () => {
    // Sin margen, medio grosor de línea se corta arriba y abajo.
    const pts = pointsOf(svg([80, 90]));
    expect(Math.min(...pts.map((p) => p.y))).toBeCloseTo(1.5, 1);
    expect(Math.max(...pts.map((p) => p.y))).toBeCloseTo(18.5, 1);
  });

  it("una serie constante sale plana y centrada, sin dividir entre cero", () => {
    const pts = pointsOf(svg([82, 82, 82]));
    expect(pts.every((p) => Number.isFinite(p.y))).toBe(true);
    expect(new Set(pts.map((p) => p.y)).size).toBe(1);
    expect(pts[0].y).toBeCloseTo(10, 1);
  });

  it("escala cada serie por su cuenta, para que se vea la forma", () => {
    // Un cambio de 4 cm y otro de 1 cm deben llenar los dos el mismo alto: lo
    // que se lee aquí es la forma, y el número exacto va al lado en texto.
    const grande = pointsOf(svg([86, 82]));
    const pequeno = pointsOf(svg([35.5, 36.5]));
    expect(Math.max(...grande.map((p) => p.y))).toBeCloseTo(Math.max(...pequeno.map((p) => p.y)), 1);
  });

  it("marca la última lectura y la deja fuera del alcance de un lector de pantalla", () => {
    const markup = svg([80, 84]);
    expect(markup).toContain("<circle");
    expect(markup).toContain('aria-hidden="true"');
  });
});
