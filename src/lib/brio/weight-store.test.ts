import { afterEach, describe, expect, it } from "vitest";
import { defaultState } from "./persist";
import { useBrioStore } from "./store";
import { clearUndo, undoCount } from "./undo";

afterEach(() => {
  useBrioStore.setState({ ...defaultState(), hydrated: false, viewDate: "" });
  clearUndo();
});

function weights() {
  return useBrioStore.getState().weights;
}

describe("deshacer un pesaje con medidas", () => {
  it("restaura la cintura al deshacer el borrado", () => {
    // El caso exacto que se coló: apuntar cintura, guardar, deshacer.
    const s = useBrioStore.getState();
    s.upsertWeight("2026-08-20", 80, { waist: 92 });
    expect(weights()[0]).toMatchObject({ kg: 80, waist: 92 });

    useBrioStore.getState().deleteWeight("2026-08-20");
    expect(weights()).toHaveLength(0);

    useBrioStore.getState().undoLast();
    expect(weights()[0]).toMatchObject({ kg: 80, waist: 92 });
  });

  it("restaura todas las medidas a la vez, no solo una", () => {
    const s = useBrioStore.getState();
    s.upsertWeight("2026-08-20", 80, { waist: 92, chest: 101, hip: 98, arm: 34, thigh: 58 });
    useBrioStore.getState().deleteWeight("2026-08-20");
    useBrioStore.getState().undoLast();
    expect(weights()[0]).toMatchObject({ waist: 92, chest: 101, hip: 98, arm: 34, thigh: 58 });
  });

  it("sobrescribir sin `extra` reemplaza el pesaje entero, a propósito", () => {
    // `upsertWeight` reemplaza en vez de fusionar los extras — no es un
    // descuido: es la única forma que tiene la hoja de Peso de dejar de llevar
    // una medida (vaciar el campo y guardar). Si fusionara, ese borrado sería
    // imposible. Este test documenta el contrato para que nadie lo "arregle"
    // hacia una fusión sin darse cuenta de que rompería esa vía.
    const s = useBrioStore.getState();
    s.upsertWeight("2026-08-20", 80, { waist: 92 });
    useBrioStore.getState().upsertWeight("2026-08-20", 79.5);
    const w = weights()[0];
    expect(w.kg).toBe(79.5);
    expect(w.waist).toBeUndefined();

    // Y por eso el deshacer sí tiene que restaurarla explícitamente: es lo
    // único que la trae de vuelta tras ese reemplazo.
    useBrioStore.getState().undoLast();
    expect(weights()[0]).toMatchObject({ kg: 80, waist: 92 });
  });

  it("un pesaje sin ninguna medida sigue deshaciéndose sin arrastrar campos vacíos", () => {
    const s = useBrioStore.getState();
    s.upsertWeight("2026-08-20", 80);
    useBrioStore.getState().deleteWeight("2026-08-20");
    useBrioStore.getState().undoLast();
    const w = weights()[0];
    expect(w.kg).toBe(80);
    expect(w.waist).toBeUndefined();
    expect(w.fat).toBeUndefined();
  });

  it("deja una sola entrada de deshacer por acción, como el resto del store", () => {
    const s = useBrioStore.getState();
    s.upsertWeight("2026-08-20", 80, { waist: 92 });
    expect(undoCount()).toBe(1);
  });
});
