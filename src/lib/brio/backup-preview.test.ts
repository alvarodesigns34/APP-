import { describe, expect, it } from "vitest";
import { formatBackupPreview, previewBackup } from "./backup-preview";

const day = (meals = 1) => ({
  meals: {
    desayuno: meals
      ? [{ id: "e1", foodId: "f1", qty: 1, grams: 100, unitName: "g", kcal: 100, prot: 0, carb: 0, fat: 0, fib: 0 }]
      : [],
    comida: [],
    cena: [],
    snack: [],
  },
  water: [],
  steps: 0,
  workouts: [],
  sleep: null,
  note: "",
});

describe("previewBackup", () => {
  it("rejects non-objects", () => {
    expect(() => previewBackup(null)).toThrow();
    expect(() => previewBackup("nope")).toThrow();
    expect(() => previewBackup([1])).toThrow();
  });

  it("summarises days, meal range, weights and custom foods", () => {
    const p = previewBackup({
      profile: { name: "Ana" },
      days: {
        "2026-08-01": day(1),
        "2026-08-20": day(2),
        "2026-08-10": day(0),
      },
      weights: [{ date: "2026-08-05", kg: 70 }],
      customFoods: [
        {
          id: "c1",
          name: "Yogur",
          cat: "propio",
          kcal: 80,
          prot: 4,
          carb: 6,
          fat: 3,
          fib: 0,
          sug: null,
          sat: null,
          sod: null,
          units: [{ name: "unidad", g: 125 }],
          base: "g",
        },
      ],
    });
    expect(p.name).toBe("Ana");
    expect(p.days).toBe(2);
    expect(p.meals).toBe(2);
    expect(p.firstDate).toBe("2026-08-01");
    expect(p.lastDate).toBe("2026-08-20");
    expect(p.weights).toBe(1);
    expect(p.customFoods).toBe(1);
    expect(p.looksEmpty).toBe(false);
    expect(formatBackupPreview(p)).toContain("Ana");
    expect(formatBackupPreview(p)).toContain("del 1/8/2026 al 20/8/2026");
    expect(formatBackupPreview(p)).toContain("1 pesaje");
  });

  it("flags an empty object as a wipe-looking restore", () => {
    const p = previewBackup({});
    expect(p.looksEmpty).toBe(true);
    expect(formatBackupPreview(p)).toMatch(/no tiene comidas ni peso/i);
  });
});
