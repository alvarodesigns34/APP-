import { afterEach, describe, expect, it } from "vitest";
import { defaultState } from "./persist";
import { useBrioStore } from "./store";
import { clearUndo, undoCount } from "./undo";

afterEach(() => {
  useBrioStore.setState({ ...defaultState(), hydrated: false, viewDate: "" });
  clearUndo();
});

function names() {
  return useBrioStore.getState().shopping.map((i) => `${i.name}${i.done ? " ✓" : ""}`);
}

describe("addShoppingItems", () => {
  it("brings an already ticked-off product back to pending", () => {
    const id = useBrioStore.getState().addShoppingItem({ name: "Arroz" });
    useBrioStore.getState().toggleShoppingItem(id!);
    expect(names()).toEqual(["Arroz ✓"]);

    // Sending a recipe's ingredients to the list must not bury one of them in
    // the "comprados" section — the same rule addShoppingItem already follows.
    const added = useBrioStore.getState().addShoppingItems([{ name: "arroz" }, { name: "Pollo" }]);
    expect(added).toBe(2);
    expect(names()).toEqual(["Arroz", "Pollo"]);
  });

  it("does not duplicate a product that is already pending", () => {
    useBrioStore.getState().addShoppingItem({ name: "Arroz" });
    expect(useBrioStore.getState().addShoppingItems([{ name: "ARROZ" }])).toBe(0);
    expect(names()).toEqual(["Arroz"]);
    expect(undoCount()).toBe(0);
  });

  it("undoes both the new lines and the tick it cleared", () => {
    const id = useBrioStore.getState().addShoppingItem({ name: "Arroz" });
    useBrioStore.getState().toggleShoppingItem(id!);
    clearUndo();

    useBrioStore.getState().addShoppingItems([{ name: "arroz" }, { name: "Pollo" }]);
    expect(undoCount()).toBe(1);

    useBrioStore.getState().undoLast();
    expect(names()).toEqual(["Arroz ✓"]);
  });
});

describe("cantidades al repetir un producto", () => {
  it("suma la cantidad en vez de descartar la nueva", () => {
    // El caso que lo motivó: mandar a la lista los ingredientes de dos recetas
    // que llevan arroz. Antes quedaba solo «200 g» y en el súper te faltaba.
    const s = useBrioStore.getState();
    s.addShoppingItem({ name: "Arroz", qty: "200 g" });
    s.addShoppingItem({ name: "arroz", qty: "150 g" });
    const list = useBrioStore.getState().shopping;
    expect(list).toHaveLength(1);
    expect(list[0].qty).toBe("350 g");
  });

  it("suma también por el camino de «añadir ingredientes» de una receta", () => {
    const s = useBrioStore.getState();
    s.addShoppingItems([{ name: "Arroz", qty: "200 g" }]);
    s.addShoppingItems([{ name: "Arroz", qty: "150 g" }]);
    const list = useBrioStore.getState().shopping;
    expect(list).toHaveLength(1);
    expect(list[0].qty).toBe("350 g");
  });

  it("al revivir una línea ya comprada también suma", () => {
    const s = useBrioStore.getState();
    const id = s.addShoppingItem({ name: "Arroz", qty: "200 g" })!;
    useBrioStore.getState().toggleShoppingItem(id);
    expect(useBrioStore.getState().shopping[0].done).toBe(true);
    useBrioStore.getState().addShoppingItem({ name: "Arroz", qty: "150 g" });
    const item = useBrioStore.getState().shopping[0];
    expect(item.done).toBe(false);
    expect(item.qty).toBe("350 g");
  });
});
