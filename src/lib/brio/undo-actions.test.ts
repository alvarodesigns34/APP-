import { afterEach, describe, expect, it } from "vitest";
import { defaultState, emptyDay } from "./persist";
import { useBrioStore } from "./store";
import { clearUndo, undoCount } from "./undo";
import type { MealEntry } from "./types";

function entry(foodId: string, name = foodId): MealEntry {
  return {
    id: `e-${foodId}`,
    foodId,
    name,
    qty: 1,
    unitName: "g",
    grams: 100,
    kcal: 100,
    prot: 10,
    carb: 10,
    fat: 2,
    fib: 1,
    sug: null,
    sat: null,
    sod: null,
  };
}

afterEach(() => {
  useBrioStore.setState({ ...defaultState(), hydrated: false, viewDate: "" });
  clearUndo();
});

describe("updateMeal undo", () => {
  it("restores the previous amount and macros", () => {
    const key = "2026-08-22";
    const day = emptyDay();
    day.meals.comida = [entry("pollo", "Pollo")];
    useBrioStore.setState({ days: { [key]: day } });
    useBrioStore.getState().updateMeal(key, "comida", "e-pollo", 200, 2, "g");
    expect(useBrioStore.getState().days[key].meals.comida[0].grams).toBe(200);
    useBrioStore.getState().undoLast();
    const restored = useBrioStore.getState().days[key].meals.comida[0];
    expect(restored.grams).toBe(100);
    expect(restored.kcal).toBe(100);
  });
});

describe("duplicateMeal undo", () => {
  it("removes the duplicate and leaves the original untouched", () => {
    const key = "2026-08-22";
    const day = emptyDay();
    day.meals.comida = [entry("pollo", "Pollo")];
    useBrioStore.setState({ days: { [key]: day } });
    useBrioStore.getState().duplicateMeal(key, "comida", "e-pollo");
    expect(useBrioStore.getState().days[key].meals.comida).toHaveLength(2);
    useBrioStore.getState().undoLast();
    const meals = useBrioStore.getState().days[key].meals.comida;
    expect(meals).toHaveLength(1);
    expect(meals[0].id).toBe("e-pollo");
  });
});

describe("moveMeal undo", () => {
  it("moves the entry back to its original slot", () => {
    const key = "2026-08-22";
    const day = emptyDay();
    day.meals.desayuno = [entry("avena", "Avena")];
    useBrioStore.setState({ days: { [key]: day } });
    useBrioStore.getState().moveMeal(key, "desayuno", "cena", "e-avena");
    expect(useBrioStore.getState().days[key].meals.desayuno).toHaveLength(0);
    expect(useBrioStore.getState().days[key].meals.cena).toHaveLength(1);
    useBrioStore.getState().undoLast();
    expect(useBrioStore.getState().days[key].meals.desayuno).toHaveLength(1);
    expect(useBrioStore.getState().days[key].meals.cena).toHaveLength(0);
  });
});

describe("setSteps / setSleep / setNote undo", () => {
  it("restores the previous step count", () => {
    const key = "2026-08-22";
    useBrioStore.getState().setSteps(key, 5000);
    useBrioStore.getState().setSteps(key, 8000);
    expect(useBrioStore.getState().days[key].steps).toBe(8000);
    useBrioStore.getState().undoLast();
    expect(useBrioStore.getState().days[key].steps).toBe(5000);
  });

  it("does not push an undo entry when the value does not change", () => {
    const key = "2026-08-22";
    useBrioStore.getState().setSteps(key, 5000);
    clearUndo();
    useBrioStore.getState().setSteps(key, 5000);
    expect(undoCount()).toBe(0);
  });

  it("restores the previous sleep entry, including clearing back to null", () => {
    const key = "2026-08-22";
    useBrioStore.getState().setSleep(key, { bed: 23 * 60, wake: 7 * 60 });
    useBrioStore.getState().setSleep(key, null);
    expect(useBrioStore.getState().days[key]?.sleep).toBeUndefined();
    useBrioStore.getState().undoLast();
    expect(useBrioStore.getState().days[key].sleep).toEqual({ bed: 23 * 60, wake: 7 * 60 });
  });

  it("restores the previous note text", () => {
    const key = "2026-08-22";
    useBrioStore.getState().setNote(key, "Primera nota");
    useBrioStore.getState().setNote(key, "Segunda nota");
    expect(useBrioStore.getState().days[key].note).toBe("Segunda nota");
    useBrioStore.getState().undoLast();
    expect(useBrioStore.getState().days[key].note).toBe("Primera nota");
  });
});

describe("copyDayMeals / cloneMealEntries undo storms", () => {
  it("undoes an entire copied day in a single undo, not one entry at a time", () => {
    const to = "2026-08-22";
    const from = "2026-08-21";
    const src = emptyDay();
    src.meals.desayuno = [entry("avena", "Avena")];
    src.meals.comida = [entry("pollo", "Pollo"), entry("arroz", "Arroz")];
    useBrioStore.setState({ days: { [from]: src } });

    useBrioStore.getState().copyDayMeals(from, to);
    expect(undoCount()).toBe(1);

    useBrioStore.getState().undoLast();
    expect(useBrioStore.getState().days[to]).toBeUndefined();
    expect(undoCount()).toBe(0);
  });

  it("undoes a cloned meal (repetir el de ayer) in a single undo", () => {
    const to = "2026-08-22";
    const from = "2026-08-21";
    const src = emptyDay();
    src.meals.cena = [entry("sopa", "Sopa"), entry("pan", "Pan")];
    useBrioStore.setState({ days: { [from]: src } });

    useBrioStore.getState().copyMeal(from, to, "cena");
    expect(undoCount()).toBe(1);

    useBrioStore.getState().undoLast();
    expect(useBrioStore.getState().days[to]).toBeUndefined();
    expect(undoCount()).toBe(0);
  });
});

describe("setSleep undo", () => {
  const key = "2026-08-22";
  const night = { bed: 23 * 60, wake: 7 * 60 };

  it("records an undo entry when the night actually changes", () => {
    useBrioStore.setState({ hydrated: true });
    useBrioStore.getState().setSleep(key, night);
    expect(undoCount()).toBe(1);
    useBrioStore.getState().undoLast();
    expect(useBrioStore.getState().days[key]?.sleep ?? null).toBeNull();
  });

  it("does not record one when the sheet is saved without changing anything", () => {
    useBrioStore.setState({ hydrated: true });
    useBrioStore.getState().setSleep(key, night);
    clearUndo();
    // Same bed/wake, a fresh object: re-saving the sheet must not push a
    // no-op entry, the same way setSteps and setNote already guard.
    useBrioStore.getState().setSleep(key, { ...night });
    expect(undoCount()).toBe(0);
  });

  it("does not record one when clearing a night that was already empty", () => {
    useBrioStore.setState({ hydrated: true });
    useBrioStore.getState().setSleep(key, null);
    expect(undoCount()).toBe(0);
  });
});

/**
 * Deshacer tiene que devolver el estado anterior, no uno parecido. Todos estos
 * fallaban en silencio: el toast decía "Deshecho" y algo quedaba distinto.
 */
describe("deshacer restaura de verdad el estado anterior", () => {
  const KEY = "2026-08-22";

  function seedDay(partial: Partial<ReturnType<typeof emptyDay>>) {
    const day = { ...emptyDay(), ...partial };
    useBrioStore.setState({ ...defaultState(), hydrated: true, days: { [KEY]: day } });
    clearUndo();
  }

  it("devuelve una comida quitada a su sitio, no al final", () => {
    seedDay({ meals: { desayuno: [], comida: [entry("a"), entry("b"), entry("c")], cena: [], snack: [] } });
    useBrioStore.getState().removeMeal(KEY, "comida", "e-a");
    useBrioStore.getState().undoLast();
    expect(useBrioStore.getState().days[KEY].meals.comida.map((e) => e.foodId)).toEqual(["a", "b", "c"]);
  });

  it("devuelve una comida movida a su sitio en la comida de origen", () => {
    seedDay({ meals: { desayuno: [], comida: [entry("a"), entry("b"), entry("c")], cena: [], snack: [] } });
    useBrioStore.getState().moveMeal(KEY, "comida", "cena", "e-a");
    useBrioStore.getState().undoLast();
    expect(useBrioStore.getState().days[KEY].meals.comida.map((e) => e.foodId)).toEqual(["a", "b", "c"]);
    expect(useBrioStore.getState().days[KEY].meals.cena).toHaveLength(0);
  });

  it("quitar un vaso de agua se puede deshacer", () => {
    seedDay({ water: [{ id: "w1", t: 1, ml: 250 }, { id: "w2", t: 2, ml: 500 }] });
    useBrioStore.getState().removeWater(KEY, "w1");
    expect(useBrioStore.getState().days[KEY].water).toHaveLength(1);
    expect(undoCount()).toBe(1);
    useBrioStore.getState().undoLast();
    expect(useBrioStore.getState().days[KEY].water.map((w) => w.id)).toEqual(["w1", "w2"]);
  });

  it("deshacer una comida añadida no la deja encabezando Recientes", () => {
    useBrioStore.setState({ ...defaultState(), hydrated: true, recents: ["viejo"] });
    clearUndo();
    const food = {
      id: "nuevo", name: "Nuevo", cat: "propio", kcal: 100, prot: 5, carb: 10, fat: 2,
      fib: 1, sug: null, sat: null, sod: null, units: [], base: "g" as const,
    };
    useBrioStore.getState().addMeal(KEY, "comida", food, 100, 1, "g");
    expect(useBrioStore.getState().recents[0]).toBe("nuevo");
    useBrioStore.getState().undoLast();
    expect(useBrioStore.getState().recents).toEqual(["viejo"]);
  });
});

describe("deshacer en la lista de la compra no pisa lo de después", () => {
  it("vaciar la lista y deshacer conserva lo añadido entre medias", () => {
    useBrioStore.setState({ ...defaultState(), hydrated: true });
    clearUndo();
    const st = useBrioStore.getState();
    st.addShoppingItem({ name: "Arroz" });
    st.addShoppingItem({ name: "Pollo" });
    st.clearShopping();
    st.addShoppingItem({ name: "Leche" });
    useBrioStore.getState().undoLast();
    const names = useBrioStore.getState().shopping.map((i) => i.name).sort();
    expect(names).toEqual(["Arroz", "Leche", "Pollo"]);
  });

  it("deshacer una fusión de cantidades devuelve la cantidad, no solo el tick", () => {
    useBrioStore.setState({ ...defaultState(), hydrated: true });
    clearUndo();
    const st = useBrioStore.getState();
    const id = st.addShoppingItem({ name: "Arroz", qty: "200 g" });
    useBrioStore.getState().toggleShoppingItem(id!);
    clearUndo();

    useBrioStore.getState().addShoppingItems([{ name: "Arroz", qty: "150 g" }]);
    expect(useBrioStore.getState().shopping[0].qty).toBe("350 g");

    useBrioStore.getState().undoLast();
    const back = useBrioStore.getState().shopping[0];
    expect(back.qty).toBe("200 g");
    expect(back.done).toBe(true);
  });

  it("deshacer 'guardar en despensa' no borra lo que marcaste después", () => {
    useBrioStore.setState({ ...defaultState(), hydrated: true });
    clearUndo();
    const st = useBrioStore.getState();
    const id = st.addShoppingItem({ name: "Arroz", foodId: "f001" });
    useBrioStore.getState().toggleShoppingItem(id!);
    useBrioStore.getState().shoppingDoneToPantry();
    useBrioStore.getState().togglePantry("f999");
    expect(useBrioStore.getState().pantry).toEqual(["f001", "f999"]);

    useBrioStore.getState().undoLast();
    expect(useBrioStore.getState().pantry).toEqual(["f999"]);
  });
});
