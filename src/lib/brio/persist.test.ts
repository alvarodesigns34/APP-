import { describe, expect, it } from "vitest";
import { migrate } from "./persist";

describe("migrate", () => {
  it("returns defaults for garbage input", () => {
    const s = migrate("not json object");
    expect(s.profile.weight).toBe(70);
    expect(s.customFoods).toEqual([]);
    expect(s.recipes).toEqual([]);
    expect(s.favorites).toEqual([]);
  });

  it("drops malformed customFoods, recipes and id lists", () => {
    const s = migrate({
      customFoods: [
        null,
        1,
        { id: "bad" },
        {
          id: "ok",
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
      recipes: [
        "nope",
        { id: "r1" },
        {
          id: "r-ok",
          name: "Tostada",
          items: [{ foodId: "pan", grams: 40 }],
          servings: 1,
          servingG: 40,
          per100: { kcal: 250, prot: 8, carb: 40, fat: 4, fib: 3 },
        },
      ],
      favorites: [1, "f1", null, ""],
      favRecipes: ["rec-1", 4],
      pantry: { salt: true },
      recents: ["a", "b", 3],
    });
    expect(s.customFoods).toHaveLength(1);
    expect(s.customFoods[0].id).toBe("ok");
    expect(s.recipes).toHaveLength(1);
    expect(s.recipes[0].id).toBe("r-ok");
    expect(s.favorites).toEqual(["f1"]);
    expect(s.favRecipes).toEqual(["rec-1"]);
    expect(s.pantry).toEqual([]);
    expect(s.recents).toEqual(["a", "b"]);
  });
});
