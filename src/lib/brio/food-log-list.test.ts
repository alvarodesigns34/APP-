import { describe, expect, it } from "vitest";
import { buildFoodLogList } from "./food-log-list";
import type { Food } from "./types";

const yogurt: Food = {
  id: "c1",
  name: "Yogur de casa",
  cat: "propio",
  kcal: 60,
  prot: 4,
  carb: 5,
  fat: 2,
  fib: 0,
  sug: null,
  sat: null,
  sod: null,
  units: [{ name: "unidad", g: 125 }],
  base: "g",
  custom: true,
};

describe("buildFoodLogList", () => {
  it("returns a custom food while the builtin catalog is empty", () => {
    const list = buildFoodLogList({
      picked: null,
      editing: false,
      tab: "buscar",
      q: "yogur",
      cat: null,
      recents: [],
      favorites: [],
      habitual: [],
      customFoods: [yogurt],
      recipes: [],
    });
    expect(list.map((f) => f.id)).toEqual(["c1"]);
  });

  it("resolves recents of custom foods without the builtin catalog", () => {
    const list = buildFoodLogList({
      picked: null,
      editing: false,
      tab: "recientes",
      q: "",
      cat: null,
      recents: ["c1"],
      favorites: [],
      habitual: [],
      customFoods: [yogurt],
      recipes: [],
    });
    expect(list.map((f) => f.name)).toEqual(["Yogur de casa"]);
  });
});
