import { describe, expect, it } from "vitest";
import {
  aisleName,
  findShoppingItem,
  groupShopping,
  makeShoppingItem,
  parseShopping,
  parseShoppingInput,
  shoppingAsText,
  shoppingCounts,
  SHOPPING_OTHER,
} from "./shopping";
import type { ShoppingItem } from "./types";

function item(name: string, cat = SHOPPING_OTHER, done = false, qty = ""): ShoppingItem {
  return { id: `s-${name}`, name, qty, done, cat, t: 1 };
}

describe("parseShoppingInput", () => {
  it("splits a leading amount with a unit", () => {
    expect(parseShoppingInput("2 kg naranjas")).toEqual({ qty: "2 kg", name: "naranjas" });
    expect(parseShoppingInput("500 g arroz integral")).toEqual({ qty: "500 g", name: "arroz integral" });
    expect(parseShoppingInput("1,5 l leche")).toEqual({ qty: "1,5 l", name: "leche" });
  });

  it("splits a bare number as a count", () => {
    expect(parseShoppingInput("3 aguacates")).toEqual({ qty: "3", name: "aguacates" });
  });

  it("keeps a plain name whole", () => {
    expect(parseShoppingInput("papel de cocina")).toEqual({ qty: "", name: "papel de cocina" });
    expect(parseShoppingInput("  pan   de  pueblo ")).toEqual({ qty: "", name: "pan de pueblo" });
  });

  it("does not strip a number that is the whole line", () => {
    // "2" alone is a name, not a quantity with nothing to buy.
    expect(parseShoppingInput("2")).toEqual({ qty: "", name: "2" });
  });

  it("returns empty for blank input", () => {
    expect(parseShoppingInput("")).toEqual({ qty: "", name: "" });
    expect(parseShoppingInput("   ")).toEqual({ qty: "", name: "" });
  });

  it("keeps a number that is part of the product name", () => {
    expect(parseShoppingInput("leche")).toEqual({ qty: "", name: "leche" });
  });
});

describe("findShoppingItem", () => {
  const items = [item("Tomates"), item("Leche")];

  it("matches ignoring case and accents", () => {
    expect(findShoppingItem(items, "tomates")?.name).toBe("Tomates");
    expect(findShoppingItem(items, "  LECHE ")?.name).toBe("Leche");
  });

  it("does not match a different product", () => {
    expect(findShoppingItem(items, "tomate frito")).toBeUndefined();
    expect(findShoppingItem(items, "")).toBeUndefined();
  });
});

describe("groupShopping", () => {
  it("orders pending groups by supermarket walk order", () => {
    const { pending } = groupShopping([
      item("Chocolate", "dulce"),
      item("Pollo", "carne"),
      item("Manzanas", "fruta"),
      item("Papel", SHOPPING_OTHER),
    ]);
    expect(pending.map((g) => g.cat)).toEqual(["fruta", "carne", "dulce", SHOPPING_OTHER]);
  });

  it("keeps insertion order inside a group", () => {
    const { pending } = groupShopping([item("Peras", "fruta"), item("Manzanas", "fruta")]);
    expect(pending[0].items.map((i) => i.name)).toEqual(["Peras", "Manzanas"]);
  });

  it("moves ticked items out of the aisles into one trailing group", () => {
    const { pending, done } = groupShopping([
      item("Manzanas", "fruta"),
      item("Peras", "fruta", true),
      item("Pollo", "carne", true),
    ]);
    expect(pending).toHaveLength(1);
    expect(pending[0].items.map((i) => i.name)).toEqual(["Manzanas"]);
    expect(done.map((i) => i.name)).toEqual(["Peras", "Pollo"]);
  });

  it("handles an empty list", () => {
    expect(groupShopping([])).toEqual({ pending: [], done: [] });
  });

  it("does not invent an aisle out of a category that is not one", () => {
    // "propio" / "receta" / "receta_base" are catalog tabs, not supermarket
    // aisles: picking one of your own foods as a suggestion used to open a
    // heading called "Mis alimentos", and "Recetas" even sorted after "Otros".
    const { pending } = groupShopping([
      item("Mi tortilla", "propio"),
      item("Papel", SHOPPING_OTHER),
      item("Manzanas", "fruta"),
      item("Lentejas de la abuela", "receta_base"),
    ]);
    expect(pending.map((g) => g.name)).toEqual(["Frutas", "Otros"]);
    expect(pending[1].items.map((i) => i.name)).toEqual(["Mi tortilla", "Papel", "Lentejas de la abuela"]);
  });
});

describe("shoppingCounts", () => {
  it("splits pending from done", () => {
    expect(shoppingCounts([item("a"), item("b", SHOPPING_OTHER, true)])).toEqual({ total: 2, pending: 1, done: 1 });
    expect(shoppingCounts([])).toEqual({ total: 0, pending: 0, done: 0 });
  });
});

describe("aisleName", () => {
  it("uses the catalog category names and falls back to Otros", () => {
    expect(aisleName("fruta")).toBe("Frutas");
    expect(aisleName(SHOPPING_OTHER)).toBe("Otros");
    expect(aisleName("no-existe")).toBe("Otros");
  });
});

describe("makeShoppingItem", () => {
  it("trims, defaults to Otros and starts pending", () => {
    const i = makeShoppingItem({ name: "  Pan  " });
    expect(i.name).toBe("Pan");
    expect(i.cat).toBe(SHOPPING_OTHER);
    expect(i.done).toBe(false);
    expect(i.qty).toBe("");
    expect(i.foodId).toBeUndefined();
  });

  it("keeps a catalog origin so the item can reach the pantry", () => {
    const i = makeShoppingItem({ name: "Tomate", cat: "verdura", foodId: "f123", qty: "2 kg" });
    expect(i.foodId).toBe("f123");
    expect(i.cat).toBe("verdura");
    expect(i.qty).toBe("2 kg");
  });
});

describe("shoppingAsText", () => {
  it("writes pending items grouped by aisle", () => {
    const text = shoppingAsText([
      item("Manzanas", "fruta", false, "1 kg"),
      item("Pollo", "carne"),
      item("Comprado", "fruta", true),
    ]);
    expect(text).toContain("FRUTAS");
    expect(text).toContain("- 1 kg Manzanas");
    expect(text).toContain("- Pollo");
    expect(text).not.toContain("Comprado");
  });
});

describe("parseShopping", () => {
  it("drops malformed rows and fills the gaps on the rest", () => {
    const out = parseShopping([
      null,
      "nope",
      { name: "   " },
      { name: "Pan" },
      { id: "s1", name: "Leche", qty: " 1 l ", done: 1, cat: "lacteo", foodId: "f9", t: 42 },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].name).toBe("Pan");
    expect(out[0].cat).toBe(SHOPPING_OTHER);
    expect(out[0].done).toBe(false);
    expect(out[1]).toMatchObject({ id: "s1", name: "Leche", qty: "1 l", done: true, cat: "lacteo", foodId: "f9", t: 42 });
  });

  it("collapses duplicates so a restored backup cannot show one product twice", () => {
    const out = parseShopping([{ name: "Tomates" }, { name: "tomates" }, { name: "TOMATES" }]);
    expect(out).toHaveLength(1);
  });

  it("returns an empty list for anything that is not an array", () => {
    expect(parseShopping(undefined)).toEqual([]);
    expect(parseShopping(null)).toEqual([]);
    expect(parseShopping({})).toEqual([]);
  });
});
