import { describe, expect, it } from "vitest";
import { buildUserRecipe, scaleUserRecipe, userRecipePerServing, type RecipeDraftItem } from "./user-recipes";

const chicken: RecipeDraftItem["food"] = { id: "f1", name: "Pollo", kcal: 165, prot: 31, carb: 0, fat: 3.6, fib: 0 };
const rice: RecipeDraftItem["food"] = { id: "f2", name: "Arroz", kcal: 130, prot: 2.7, carb: 28, fat: 0.3, fib: 0.4 };

describe("buildUserRecipe", () => {
  it("aggregates items into a per-100g recipe", () => {
    // 200g chicken + 150g rice = 350g total
    const ur = buildUserRecipe(null, "Pollo con arroz", [
      { food: chicken, grams: 200 },
      { food: rice, grams: 150 },
    ], 2);
    expect(ur).not.toBeNull();
    expect(ur!.name).toBe("Pollo con arroz");
    expect(ur!.servings).toBe(2);
    expect(ur!.servingG).toBe(175); // 350 / 2
    expect(ur!.items).toEqual([
      { foodId: "f1", grams: 200 },
      { foodId: "f2", grams: 150 },
    ]);
    // per100 = (200*chicken + 150*rice per gram) / 350 * 100
    const expectedKcal = ((200 * 165 + 150 * 130) / 350);
    expect(ur!.per100.kcal).toBeCloseTo(expectedKcal, 1);
  });

  it("assigns a fresh id when creating, keeps the given one when editing", () => {
    const created = buildUserRecipe(null, "X", [{ food: chicken, grams: 100 }], 1);
    expect(created!.id.length).toBeGreaterThan(0);
    const edited = buildUserRecipe("ur-existing", "X", [{ food: chicken, grams: 100 }], 1);
    expect(edited!.id).toBe("ur-existing");
  });

  it("rejects an empty name", () => {
    expect(buildUserRecipe(null, "", [{ food: chicken, grams: 100 }], 1)).toBeNull();
    expect(buildUserRecipe(null, "   ", [{ food: chicken, grams: 100 }], 1)).toBeNull();
  });

  it("rejects a recipe with no usable ingredients", () => {
    expect(buildUserRecipe(null, "Vacía", [], 1)).toBeNull();
    expect(buildUserRecipe(null, "Vacía", [{ food: chicken, grams: 0 }], 1)).toBeNull();
    expect(buildUserRecipe(null, "Vacía", [{ food: chicken, grams: -50 }], 1)).toBeNull();
  });

  it("drops zero/negative items but keeps the valid ones", () => {
    const ur = buildUserRecipe(null, "Mixta", [
      { food: chicken, grams: 100 },
      { food: rice, grams: 0 },
    ], 1);
    expect(ur!.items).toEqual([{ foodId: "f1", grams: 100 }]);
  });

  it("floors servings at 0.5 and treats a non-finite value as 1", () => {
    const low = buildUserRecipe(null, "X", [{ food: chicken, grams: 100 }], 0.1);
    expect(low!.servings).toBe(0.5);
    const nan = buildUserRecipe(null, "X", [{ food: chicken, grams: 100 }], NaN);
    expect(nan!.servings).toBe(1);
  });

  it("floors a literal 0 to 0.5 rather than falling back to 1", () => {
    // `round(0, 1) || 1` would read 0 as falsy and jump straight past the
    // floor to 1 — servings=0 must land on the 0.5 floor like any other
    // too-small value.
    const zero = buildUserRecipe(null, "X", [{ food: chicken, grams: 100 }], 0);
    expect(zero!.servings).toBe(0.5);
  });
});

describe("userRecipePerServing", () => {
  it("scales per100 by the recipe's own serving size", () => {
    const ur = buildUserRecipe(null, "Pollo", [{ food: chicken, grams: 300 }], 2)!;
    // servingG = 150; per100 == chicken's own macros since it's the only ingredient
    const per = userRecipePerServing(ur);
    expect(per.kcal).toBeCloseTo(165 * 1.5, 1);
    expect(per.prot).toBeCloseTo(31 * 1.5, 1);
  });
});

describe("scaleUserRecipe", () => {
  const ur = buildUserRecipe(null, "Pollo con arroz", [
    { food: chicken, grams: 200 },
    { food: rice, grams: 100 },
  ], 2)!; // servingG = 150

  it("scales grams and macros linearly with servings", () => {
    const doubled = scaleUserRecipe(ur, 4);
    expect(doubled.servings).toBe(4);
    expect(doubled.grams).toBeCloseTo(600, 0); // 150 * 4
    const single = scaleUserRecipe(ur, 2);
    expect(doubled.macros.kcal).toBeCloseTo(single.macros.kcal * 2, 0);
  });

  it("scales each ingredient by the same factor", () => {
    const doubled = scaleUserRecipe(ur, 4); // factor = 4/2 = 2
    expect(doubled.ingredients).toEqual([
      { foodId: "f1", grams: 400 },
      { foodId: "f2", grams: 200 },
    ]);
  });

  it("clamps target servings to 0.5..20", () => {
    expect(scaleUserRecipe(ur, 0).servings).toBe(0.5);
    expect(scaleUserRecipe(ur, 100).servings).toBe(20);
  });
});
