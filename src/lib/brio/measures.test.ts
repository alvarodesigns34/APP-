import { describe, expect, it } from "vitest";
import { isMeasureInRange, latestWaist, measureChanges, measureSeries, waistToHeight } from "./measures";
import type { WeightEntry } from "./types";

const w = (date: string, kg: number, extra: Partial<WeightEntry> = {}): WeightEntry => ({ date, kg, ...extra });

describe("measureSeries", () => {
  it("se queda solo con los pesajes que traen esa medida", () => {
    const serie = measureSeries([w("2026-01-01", 80, { waist: 92 }), w("2026-01-08", 79), w("2026-01-15", 78, { waist: 90 })], "waist");
    expect(serie).toEqual([
      { date: "2026-01-01", cm: 92 },
      { date: "2026-01-15", cm: 90 },
    ]);
  });

  it("ordena por fecha aunque lleguen desordenados", () => {
    const serie = measureSeries([w("2026-02-01", 80, { chest: 100 }), w("2026-01-01", 81, { chest: 102 })], "chest");
    expect(serie.map((p) => p.date)).toEqual(["2026-01-01", "2026-02-01"]);
  });

  it("no confunde una medida con otra", () => {
    expect(measureSeries([w("2026-01-01", 80, { waist: 92 })], "hip")).toEqual([]);
  });
});

describe("measureChanges", () => {
  it("da la última lectura y la diferencia contra la primera", () => {
    const c = measureChanges([w("2026-01-01", 80, { waist: 92 }), w("2026-03-01", 77, { waist: 87.5 })]);
    expect(c).toEqual([{ id: "waist", n: "Cintura", last: 87.5, delta: -4.5 }]);
  });

  it("deja delta a null con una sola lectura, en vez de fingir un cero", () => {
    // Un 0 se leería como «no has cambiado nada», que es una afirmación que
    // con un único dato no se puede hacer.
    expect(measureChanges([w("2026-01-01", 80, { arm: 34 })])[0].delta).toBeNull();
  });

  it("omite las medidas que nadie ha apuntado", () => {
    const c = measureChanges([w("2026-01-01", 80, { waist: 92, thigh: 58 })]);
    expect(c.map((x) => x.id).sort()).toEqual(["thigh", "waist"]);
  });

  it("sin pesajes devuelve una lista vacía, no una fila por medida", () => {
    expect(measureChanges([])).toEqual([]);
  });
});

describe("waistToHeight", () => {
  it("clasifica según la regla de «menos de la mitad de tu altura»", () => {
    expect(waistToHeight(85, 178)!.tone).toBe("ok"); // 0.48
    expect(waistToHeight(95, 178)!.tone).toBe("warn"); // 0.53
    expect(waistToHeight(110, 178)!.tone).toBe("bad"); // 0.62
  });

  it("pone el corte exactamente en 0,5 y en 0,6", () => {
    expect(waistToHeight(89, 178)!.ratio).toBe(0.5);
    expect(waistToHeight(89, 178)!.tone).toBe("warn");
    expect(waistToHeight(106.8, 178)!.tone).toBe("bad");
  });

  it("devuelve null sin cintura o sin altura, en vez de un 0 que parecería excelente", () => {
    expect(waistToHeight(undefined, 178)).toBeNull();
    expect(waistToHeight(0, 178)).toBeNull();
    expect(waistToHeight(85, 0)).toBeNull();
    expect(waistToHeight(85, Number.NaN)).toBeNull();
  });
});

describe("latestWaist", () => {
  it("coge la más reciente, no la última del array", () => {
    expect(latestWaist([w("2026-03-01", 77, { waist: 87 }), w("2026-01-01", 80, { waist: 92 })])).toBe(87);
  });

  it("es undefined si nunca se ha medido", () => {
    expect(latestWaist([w("2026-01-01", 80)])).toBeUndefined();
  });
});

describe("isMeasureInRange", () => {
  it("descarta el dedo de más y los negativos", () => {
    expect(isMeasureInRange(92)).toBe(true);
    expect(isMeasureInRange(1750)).toBe(false);
    expect(isMeasureInRange(-5)).toBe(false);
    expect(isMeasureInRange(Number.NaN)).toBe(false);
  });
});
