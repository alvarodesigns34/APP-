import { afterEach, describe, expect, it } from "vitest";
import { defaultState } from "./persist";
import { useBrioStore } from "./store";
import { clearUndo, undoCount } from "./undo";

afterEach(() => {
  useBrioStore.setState({ ...defaultState(), hydrated: false, viewDate: "" });
  clearUndo();
});

const KEY = "2026-08-20";

function workouts() {
  return useBrioStore.getState().days[KEY]?.workouts ?? [];
}

describe("updateWorkout", () => {
  it("corrige minutos e intensidad sin cambiar el id ni el sitio en la lista", () => {
    const s = useBrioStore.getState();
    const id = s.addWorkout(KEY, "pesas", 45, "media");
    s.updateWorkout(KEY, id, { min: 60, intensity: "alta" });
    const w = workouts()[0];
    expect(w.id).toBe(id);
    expect(w.min).toBe(60);
    expect(w.intensity).toBe("alta");
    expect(workouts()).toHaveLength(1);
  });

  it("recalcula el kcal con los nuevos minutos e intensidad", () => {
    const s = useBrioStore.getState();
    const before = s.addWorkout(KEY, "pesas", 45, "media");
    const kcalBefore = workouts()[0].kcal;
    useBrioStore.getState().updateWorkout(KEY, before, { min: 90, intensity: "alta" });
    // El doble de minutos y más intensidad no puede dar el mismo kcal, o
    // significa que el número se quedó pegado al valor de cuando se creó.
    expect(workouts()[0].kcal).toBeGreaterThan(kcalBefore);
  });

  it("cambiar solo un campo no toca los demás", () => {
    const s = useBrioStore.getState();
    const id = s.addWorkout(KEY, "correr", 30, "media");
    useBrioStore.getState().updateWorkout(KEY, id, { min: 40 });
    const w = workouts()[0];
    expect(w.type).toBe("correr");
    expect(w.intensity).toBe("media");
    expect(w.min).toBe(40);
  });

  it("se puede deshacer, y una sola vez", () => {
    const s = useBrioStore.getState();
    const id = s.addWorkout(KEY, "pesas", 45, "media");
    clearUndo(); // solo nos interesa la entrada de la corrección
    useBrioStore.getState().updateWorkout(KEY, id, { min: 60 });
    expect(undoCount()).toBe(1);
    useBrioStore.getState().undoLast();
    expect(workouts()[0].min).toBe(45);
  });

  it("un id que no existe no rompe nada ni deja una entrada de deshacer fantasma", () => {
    useBrioStore.getState().addWorkout(KEY, "pesas", 45, "media");
    clearUndo();
    useBrioStore.getState().updateWorkout(KEY, "no-existe", { min: 60 });
    expect(undoCount()).toBe(0);
    expect(workouts()).toHaveLength(1);
  });
});
