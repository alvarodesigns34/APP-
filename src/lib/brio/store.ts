import { toast } from "sonner";
import { create } from "zustand";
import type {
  DayLog,
  Food,
  IntensityId,
  MealEntry,
  MealId,
  PersistedState,
  SleepEntry,
  UserRecipe,
  WeightEntry,
  WorkoutEntry,
} from "./types";
import { MEALS, MEASURES, NOTE_MAX } from "./types";
import { clearAuxStorage, defaultState, emptyDay, isEmptyDay, loadState, migrate, saveState } from "./persist";
import { uid, round, plural } from "./format";
import { scaleMacros } from "./scale-macros";
import { fmtDateRelative } from "./dates";
import { kcalFromWorkout } from "./domain";
import { latestWeight } from "./selectors";
import { applyUndo, clearUndo, isApplyingUndo, popUndo, pushUndo } from "./undo";
import { findShoppingItem, makeShoppingItem, mergeQty } from "./shopping";

export type BrioStore = PersistedState & {
  hydrated: boolean;
  viewDate: string;
  hydrate: () => void;
  persist: () => void;
  setViewDate: (key: string) => void;
  completeOnboarding: (patch: Partial<PersistedState>) => void;
  skipOnboarding: () => void;
  patchProfile: (patch: Partial<PersistedState["profile"]>) => void;
  patchGoals: (patch: Partial<PersistedState["goals"]>) => void;
  patchSettings: (patch: Partial<PersistedState["settings"]>) => void;
  ensureDay: (key: string) => DayLog;
  addMeal: (key: string, meal: MealId, food: Food, grams: number, qty: number, unitName: string) => string;
  updateMeal: (
    key: string,
    meal: MealId,
    entryId: string,
    grams: number,
    qty: number,
    unitName: string,
    food?: Food,
  ) => void;
  removeMeal: (key: string, meal: MealId, entryId: string) => MealEntry | null;
  restoreMeal: (key: string, meal: MealId, entry: MealEntry, at?: number) => void;
  duplicateMeal: (key: string, meal: MealId, entryId: string) => void;
  moveMeal: (key: string, from: MealId, to: MealId, entryId: string) => void;
  copyDayMeals: (fromKey: string, toKey: string) => number;
  copyMeal: (fromKey: string, toKey: string, meal: MealId) => string[];
  cloneMealEntries: (toKey: string, meal: MealId, entries: MealEntry[]) => string[];
  addWater: (key: string, ml: number) => string;
  removeWater: (key: string, id: string) => void;
  setSteps: (key: string, steps: number) => void;
  addWorkout: (key: string, type: string, min: number, intensity: IntensityId) => string;
  updateWorkout: (key: string, id: string, patch: { type?: string; min?: number; intensity?: IntensityId }) => void;
  removeWorkout: (key: string, id: string) => WorkoutEntry | null;
  restoreWorkout: (key: string, entry: WorkoutEntry, at?: number) => void;
  setSleep: (key: string, sleep: SleepEntry | null) => void;
  setNote: (key: string, note: string) => void;
  upsertWeight: (date: string, kg: number, extra?: Partial<Omit<WeightEntry, "date" | "kg">>) => void;
  deleteWeight: (date: string) => void;
  toggleFavorite: (id: string) => void;
  toggleFavRecipe: (id: string) => void;
  togglePantry: (id: string) => void;
  addCustomFood: (food: Omit<Food, "id" | "custom" | "cat"> & { id?: string }) => string;
  updateCustomFood: (id: string, patch: Omit<Food, "id" | "custom" | "cat">) => void;
  removeCustomFood: (id: string) => void;
  addUserRecipe: (recipe: UserRecipe) => void;
  updateUserRecipe: (id: string, recipe: UserRecipe) => void;
  deleteUserRecipe: (id: string) => void;
  addShoppingItem: (input: { name: string; qty?: string; cat?: string; foodId?: string }) => string | null;
  addShoppingItems: (inputs: { name: string; qty?: string; cat?: string; foodId?: string }[]) => number;
  toggleShoppingItem: (id: string) => void;
  updateShoppingItem: (id: string, patch: { name?: string; qty?: string }) => void;
  removeShoppingItem: (id: string) => void;
  clearShoppingDone: () => void;
  clearShopping: () => void;
  shoppingDoneToPantry: () => number;
  importAll: (raw: unknown) => void;
  resetAll: () => void;
  undoLast: () => void;
};

function withDay(s: PersistedState, key: string, mut: (d: DayLog) => void): Record<string, DayLog> {
  const days = { ...s.days };
  const day = structuredClone(days[key] ?? emptyDay());
  mut(day);
  if (isEmptyDay(day)) delete days[key];
  else days[key] = day;
  return days;
}

function slicePersisted(s: BrioStore): PersistedState {
  return {
    schema: s.schema,
    onboarded: s.onboarded,
    profile: s.profile,
    settings: s.settings,
    goals: s.goals,
    days: s.days,
    weights: s.weights,
    customFoods: s.customFoods,
    recipes: s.recipes,
    favorites: s.favorites,
    favRecipes: s.favRecipes,
    pantry: s.pantry,
    recents: s.recents,
    shopping: s.shopping,
  };
}

/**
 * Todo lo que un pesaje lleva además de fecha y kg, para restaurarlo tal cual
 * al deshacer un `upsertWeight`/`deleteWeight`.
 *
 * Antes solo copiaba `fat`/`muscle`. Las cinco medidas de MEASURES (cintura,
 * pecho, cadera, brazo, muslo) se añadieron después a `WeightEntry` y esta
 * función se quedó sin actualizar: apuntar la cintura, guardar, y deshacer el
 * pesaje siguiente la borraba sin avisar. Se deriva de MEASURES para que no
 * vuelva a pasar si se añade una medida más.
 */
function weightExtra(w: WeightEntry): Partial<Omit<WeightEntry, "date" | "kg">> | undefined {
  const extra: Partial<Omit<WeightEntry, "date" | "kg">> = {};
  if (w.fat != null) extra.fat = w.fat;
  if (w.muscle != null) extra.muscle = w.muscle;
  for (const m of MEASURES) {
    const v = w[m.id];
    if (v != null) extra[m.id] = v;
  }
  return Object.keys(extra).length > 0 ? extra : undefined;
}

function recordUndo(label: string, apply: () => void) {
  if (isApplyingUndo()) return;
  pushUndo({ label, apply });
  toast(label, {
    action: {
      label: "Deshacer",
      onClick: () => useBrioStore.getState().undoLast(),
    },
  });
}

export const useBrioStore = create<BrioStore>((set, get) => ({
  ...defaultState(),
  hydrated: false,
  viewDate: "",

  hydrate: () => {
    if (get().hydrated) return;
    const loaded = loadState();
    set({ ...loaded, hydrated: true });
  },

  persist: () => {
    const s = get();
    if (!s.hydrated) return;
    if (!saveState(slicePersisted(s))) {
      toast.error("No se ha podido guardar. Almacenamiento lleno o privado.");
    }
  },

  setViewDate: (key) => set({ viewDate: key }),

  completeOnboarding: (patch) => {
    set((s) => ({ ...s, ...patch, onboarded: true }));
    get().persist();
  },
  skipOnboarding: () => {
    set({ onboarded: true });
    get().persist();
  },
  patchProfile: (patch) => {
    set((s) => ({ profile: { ...s.profile, ...patch } }));
    get().persist();
  },
  patchGoals: (patch) => {
    set((s) => ({ goals: { ...s.goals, ...patch } }));
    get().persist();
  },
  patchSettings: (patch) => {
    set((s) => ({ settings: { ...s.settings, ...patch } }));
    get().persist();
  },

  ensureDay: (key) => get().days[key] ?? emptyDay(),

  addMeal: (key, meal, food, grams, qty, unitName) => {
    const s = get();
    const n = scaleMacros(food, grams);
    const id = uid("e");
    const entry: MealEntry = {
      id,
      foodId: food.id,
      name: food.name,
      qty: round(qty, 2),
      unitName,
      grams: round(grams, 1),
      t: Date.now(),
      kcal: round(n.kcal, 1),
      prot: round(n.prot, 1),
      carb: round(n.carb, 1),
      fat: round(n.fat, 1),
      fib: round(n.fib, 1),
      sug: n.sug == null ? null : round(n.sug, 1),
      sat: n.sat == null ? null : round(n.sat, 1),
      sod: n.sod == null ? null : round(n.sod, 1),
    };
    const prevRecents = s.recents;
    const recents = [food.id, ...s.recents.filter((x) => x !== food.id)].slice(0, 25);
    set({ days: withDay(s, key, (d) => d.meals[meal].push(entry)), recents });
    get().persist();
    recordUndo("Comida añadida", () => {
      get().removeMeal(key, meal, id);
      // Si no, un alimento que has registrado por error y has deshecho al
      // momento se queda encabezando la pestaña "Recientes" para siempre.
      set({ recents: prevRecents });
      get().persist();
    });
    return id;
  },

  updateMeal: (key, meal, entryId, grams, qty, unitName, food) => {
    const s = get();
    let prevEntry: MealEntry | null = null;
    set({
      days: withDay(s, key, (d) => {
        const e = d.meals[meal].find((x) => x.id === entryId);
        if (!e) return;
        prevEntry = { ...e };
        const n = food
          ? scaleMacros(food, grams)
          : e.grams
            ? {
                ...e,
                kcal: e.kcal * (grams / e.grams),
                prot: e.prot * (grams / e.grams),
                carb: e.carb * (grams / e.grams),
                fat: e.fat * (grams / e.grams),
                fib: e.fib * (grams / e.grams),
                sug: e.sug == null ? null : e.sug * (grams / e.grams),
                sat: e.sat == null ? null : e.sat * (grams / e.grams),
                sod: e.sod == null ? null : e.sod * (grams / e.grams),
              }
            : e;
        e.grams = round(grams, 1);
        e.qty = round(qty, 2);
        e.unitName = unitName;
        e.kcal = round(n.kcal, 1);
        e.prot = round(n.prot, 1);
        e.carb = round(n.carb, 1);
        e.fat = round(n.fat, 1);
        e.fib = round(n.fib, 1);
        e.sug = n.sug == null ? null : round(n.sug, 1);
        e.sat = n.sat == null ? null : round(n.sat, 1);
        e.sod = n.sod == null ? null : round(n.sod, 1);
      }),
    });
    get().persist();
    if (prevEntry) {
      const snapshot = prevEntry;
      recordUndo("Registro actualizado", () => {
        const st = get();
        set({
          days: withDay(st, key, (d) => {
            const e = d.meals[meal].find((x) => x.id === entryId);
            if (e) Object.assign(e, snapshot);
          }),
        });
        get().persist();
      });
    }
  },

  removeMeal: (key, meal, entryId) => {
    const s = get();
    let removed: MealEntry | null = null;
    let removedAt = -1;
    set({
      days: withDay(s, key, (d) => {
        const i = d.meals[meal].findIndex((x) => x.id === entryId);
        if (i >= 0) {
          removed = d.meals[meal].splice(i, 1)[0];
          removedAt = i;
        }
      }),
    });
    get().persist();
    if (removed) {
      const entry = removed;
      const at = removedAt;
      recordUndo("Comida quitada", () => {
        get().restoreMeal(key, meal, entry, at);
      });
    }
    return removed;
  },

  /**
   * `at` devuelve la entrada a su sitio, no al final de la comida. La lista del
   * día se pinta en el orden del array, así que quitar el primero de tres y
   * deshacer dejaba [b, c, a]: el deshacer no restauraba el estado anterior,
   * lo reordenaba. Sin `at` (o fuera de rango) se añade al final, que es lo
   * que quieren los que reinsertan algo que nunca estuvo en esa lista.
   */
  restoreMeal: (key, meal, entry, at) => {
    const s = get();
    set({
      days: withDay(s, key, (d) => {
        const arr = d.meals[meal];
        if (at != null && at >= 0 && at <= arr.length) arr.splice(at, 0, entry);
        else arr.push(entry);
      }),
    });
    get().persist();
  },

  duplicateMeal: (key, meal, entryId) => {
    const s = get();
    let newId: string | null = null;
    set({
      days: withDay(s, key, (d) => {
        const e = d.meals[meal].find((x) => x.id === entryId);
        if (e) {
          newId = uid("e");
          d.meals[meal].push({ ...e, id: newId, t: Date.now() });
        }
      }),
    });
    get().persist();
    if (newId) {
      const id = newId;
      recordUndo("Comida duplicada", () => {
        get().removeMeal(key, meal, id);
      });
    }
  },

  moveMeal: (key, from, to, entryId) => {
    if (from === to) return;
    const s = get();
    let moved: MealEntry | null = null;
    let movedFrom = -1;
    set({
      days: withDay(s, key, (d) => {
        const i = d.meals[from].findIndex((x) => x.id === entryId);
        if (i < 0) return;
        const [e] = d.meals[from].splice(i, 1);
        d.meals[to].push(e);
        moved = e;
        movedFrom = i;
      }),
    });
    get().persist();
    if (moved) {
      const entry: MealEntry = moved;
      const at = movedFrom;
      const mealName = MEALS.find((x) => x.id === to)?.n.toLowerCase() ?? to;
      // No se puede deshacer con otro `moveMeal`: eso lo devolvería al final de
      // la comida de origen en vez de a la posición que ocupaba.
      recordUndo(`Movido a ${mealName}`, () => {
        const st = get();
        set({
          days: withDay(st, key, (d) => {
            const i = d.meals[to].findIndex((x) => x.id === entryId);
            if (i >= 0) d.meals[to].splice(i, 1);
            const arr = d.meals[from];
            if (at >= 0 && at <= arr.length) arr.splice(at, 0, entry);
            else arr.push(entry);
          }),
        });
        get().persist();
      });
    }
  },

  copyDayMeals: (fromKey, toKey) => {
    const s = get();
    const src = s.days[fromKey];
    if (!src) return 0;
    let n = 0;
    const added: { meal: MealId; id: string }[] = [];
    set({
      days: withDay(s, toKey, (d) => {
        for (const m of MEALS) {
          for (const e of src.meals[m.id]) {
            const id = uid("e");
            d.meals[m.id].push({ ...e, id, t: Date.now() });
            added.push({ meal: m.id, id });
            n += 1;
          }
        }
      }),
    });
    get().persist();
    if (n) {
      const rel = fmtDateRelative(fromKey).toLowerCase();
      const verb = n === 1 ? "Copiado" : "Copiados";
      recordUndo(`${verb} ${plural(n, "registro", "registros")} de ${rel}`, () => {
        for (const x of added) get().removeMeal(toKey, x.meal, x.id);
      });
    }
    return n;
  },

  copyMeal: (fromKey, toKey, meal) => {
    const s = get();
    const src = s.days[fromKey]?.meals[meal] ?? [];
    if (!src.length) return [];
    return get().cloneMealEntries(toKey, meal, src);
  },

  cloneMealEntries: (toKey, meal, entries) => {
    if (!entries.length) return [];
    const ids: string[] = [];
    const s = get();
    set({
      days: withDay(s, toKey, (d) => {
        for (const e of entries) {
          const id = uid("e");
          ids.push(id);
          d.meals[meal].push({ ...e, id, t: Date.now() });
        }
      }),
    });
    get().persist();
    const mealName = MEALS.find((m) => m.id === meal)?.n.toLowerCase() ?? meal;
    const verb = ids.length === 1 ? "Añadido" : "Añadidos";
    recordUndo(`${verb} ${plural(ids.length, "alimento", "alimentos")} a ${mealName}`, () => {
      for (const id of ids) get().removeMeal(toKey, meal, id);
    });
    return ids;
  },

  addWater: (key, ml) => {
    const s = get();
    const id = uid("w");
    set({
      days: withDay(s, key, (d) => d.water.push({ id, t: Date.now(), ml })),
    });
    get().persist();
    recordUndo("Agua añadida", () => {
      get().removeWater(key, id);
    });
    return id;
  },
  /**
   * Lleva deshacer porque la hoja de Agua tiene un botón "Quitar" por vaso: no
   * es solo la inversa de `addWater`. Era la única acción destructiva del store
   * sin deshacer, así que tocar el vaso equivocado no tenía vuelta atrás,
   * mientras que quitar una comida, un entreno o un pesaje sí la tiene.
   *
   * Cuando llega por la vía del deshacer de `addWater`, `recordUndo` se calla
   * solo (`isApplyingUndo`), así que no se apila una entrada por deshacer otra.
   */
  removeWater: (key, id) => {
    const s = get();
    const prev = s.days[key]?.water.find((w) => w.id === id) ?? null;
    const at = s.days[key]?.water.findIndex((w) => w.id === id) ?? -1;
    set({
      days: withDay(s, key, (d) => {
        d.water = d.water.filter((w) => w.id !== id);
      }),
    });
    get().persist();
    if (prev) {
      recordUndo("Agua quitada", () => {
        const st = get();
        set({
          days: withDay(st, key, (d) => {
            if (at >= 0 && at <= d.water.length) d.water.splice(at, 0, prev);
            else d.water.push(prev);
          }),
        });
        get().persist();
      });
    }
  },
  setSteps: (key, steps) => {
    const s = get();
    const prev = s.days[key]?.steps ?? 0;
    const next = Math.max(0, Math.round(steps));
    set({
      days: withDay(s, key, (d) => {
        d.steps = next;
      }),
    });
    get().persist();
    if (prev !== next) {
      recordUndo("Pasos actualizados", () => {
        get().setSteps(key, prev);
      });
    }
  },
  addWorkout: (key, type, min, intensity) => {
    const s = get();
    const kg = latestWeight(s, key)?.kg ?? s.profile.weight;
    const kcal = kcalFromWorkout(type, min, intensity, kg);
    const id = uid("k");
    set({
      days: withDay(s, key, (d) => d.workouts.push({ id, type, min: Math.round(min), intensity, kcal })),
    });
    get().persist();
    recordUndo("Entrenamiento añadido", () => {
      get().removeWorkout(key, id);
    });
    return id;
  },
  /**
   * Corregir minutos o intensidad de un entreno ya registrado. Antes solo
   * había add/remove/restore, así que arreglar "puse 45 min y fueron 60"
   * obligaba a borrarlo y crearlo de nuevo — perdiendo el sitio que ocupaba
   * en la lista del día y generando dos entradas de deshacer donde debería
   * haber una.
   *
   * El kcal se recalcula con la misma fórmula que `addWorkout`, con el peso
   * de ese día — no lo pasa quien llama, para que "cambié la intensidad" no
   * pueda dejar el kcal desincronizado con lo que se ve.
   */
  updateWorkout: (key, id, patch) => {
    const s = get();
    const day = s.days[key];
    const prev = day?.workouts.find((w) => w.id === id) ?? null;
    if (!prev) return;
    const next: WorkoutEntry = {
      ...prev,
      ...(patch.type != null ? { type: patch.type } : {}),
      ...(patch.min != null ? { min: Math.round(patch.min) } : {}),
      ...(patch.intensity != null ? { intensity: patch.intensity } : {}),
    };
    const kg = latestWeight(s, key)?.kg ?? s.profile.weight;
    next.kcal = kcalFromWorkout(next.type, next.min, next.intensity, kg);
    set({
      days: withDay(s, key, (d) => {
        const i = d.workouts.findIndex((w) => w.id === id);
        if (i >= 0) d.workouts[i] = next;
      }),
    });
    get().persist();
    recordUndo("Entrenamiento corregido", () => {
      get().updateWorkout(key, id, { type: prev.type, min: prev.min, intensity: prev.intensity });
    });
  },
  removeWorkout: (key, id) => {
    const s = get();
    let removed: WorkoutEntry | null = null;
    let removedAt = -1;
    set({
      days: withDay(s, key, (d) => {
        const i = d.workouts.findIndex((w) => w.id === id);
        if (i >= 0) {
          removed = d.workouts.splice(i, 1)[0];
          removedAt = i;
        }
      }),
    });
    get().persist();
    if (removed) {
      const entry = removed;
      const at = removedAt;
      recordUndo("Entrenamiento quitado", () => {
        get().restoreWorkout(key, entry, at);
      });
    }
    return removed;
  },
  /** `at` como en `restoreMeal`: devuelve el entreno a su sitio, no al final. */
  restoreWorkout: (key, entry, at) => {
    const s = get();
    set({
      days: withDay(s, key, (d) => {
        if (at != null && at >= 0 && at <= d.workouts.length) d.workouts.splice(at, 0, entry);
        else d.workouts.push(entry);
      }),
    });
    get().persist();
  },
  setSleep: (key, sleep) => {
    const s = get();
    const prev = s.days[key]?.sleep ?? null;
    set({
      days: withDay(s, key, (d) => {
        d.sleep = sleep;
      }),
    });
    get().persist();
    // Same guard as setSteps/setNote: saving the sheet without changing
    // anything should not push a no-op entry onto the undo stack.
    const same = prev === sleep || (!!prev && !!sleep && prev.bed === sleep.bed && prev.wake === sleep.wake);
    if (!same) {
      recordUndo(sleep ? "Sueño guardado" : "Sueño borrado", () => {
        get().setSleep(key, prev);
      });
    }
  },
  setNote: (key, note) => {
    const s = get();
    const prev = s.days[key]?.note ?? "";
    const next = note.slice(0, NOTE_MAX);
    set({
      days: withDay(s, key, (d) => {
        d.note = next;
      }),
    });
    get().persist();
    if (prev !== next) {
      recordUndo("Nota guardada", () => {
        get().setNote(key, prev);
      });
    }
  },
  /**
   * `profile.weight` se deriva aquí, no lo escribe quien llama.
   *
   * La hoja de Peso hacía dos escrituras seguidas: `upsertWeight` y un
   * `patchProfile({ weight })`. La primera dejaba entrada de deshacer y la
   * segunda no, así que el toast decía "Deshecho", la serie volvía atrás y el
   * perfil se quedaba con el kilo nuevo — y de ahí cuelgan el IMC de Ajustes,
   * el recálculo de TDEE y el peso con el que se estiman las kcal de un
   * entreno. Actividad lee el último pesaje y Ajustes leía el perfil, así que
   * las dos pantallas podían enseñar IMC distintos.
   *
   * Derivarlo del último pesaje arregla además un caso que la escritura doble
   * tenía mal de por sí: apuntar un peso en un día pasado machacaba el peso
   * actual del perfil con el de hace tres semanas.
   */
  upsertWeight: (date, kg, extra) => {
    const prev = get().weights.find((w) => w.date === date);
    const snapshot = prev ? { ...prev } : null;
    set((s) => {
      const rest = s.weights.filter((w) => w.date !== date);
      const next = [...rest, { date, kg: round(kg, 1), ...extra }].sort((a, b) => (a.date < b.date ? -1 : 1));
      return { weights: next, profile: { ...s.profile, weight: latestWeight({ ...s, weights: next })?.kg ?? s.profile.weight } };
    });
    get().persist();
    if (snapshot) {
      recordUndo("Peso guardado", () => {
        get().upsertWeight(snapshot.date, snapshot.kg, weightExtra(snapshot));
      });
    } else {
      recordUndo("Peso guardado", () => {
        get().deleteWeight(date);
      });
    }
  },
  deleteWeight: (date) => {
    const prev = get().weights.find((w) => w.date === date);
    const snapshot = prev ? { ...prev } : null;
    set((s) => {
      const next = s.weights.filter((w) => w.date !== date);
      return { weights: next, profile: { ...s.profile, weight: latestWeight({ ...s, weights: next })?.kg ?? s.profile.weight } };
    });
    get().persist();
    if (snapshot) {
      recordUndo("Peso borrado", () => {
        get().upsertWeight(snapshot.date, snapshot.kg, weightExtra(snapshot));
      });
    }
  },
  toggleFavorite: (id) => {
    set((s) => ({
      favorites: s.favorites.includes(id) ? s.favorites.filter((x) => x !== id) : [id, ...s.favorites],
    }));
    get().persist();
  },
  toggleFavRecipe: (id) => {
    set((s) => ({
      favRecipes: s.favRecipes.includes(id) ? s.favRecipes.filter((x) => x !== id) : [id, ...s.favRecipes],
    }));
    get().persist();
  },
  togglePantry: (id) => {
    set((s) => ({
      pantry: s.pantry.includes(id) ? s.pantry.filter((x) => x !== id) : [...s.pantry, id],
    }));
    get().persist();
  },
  addCustomFood: (food) => {
    const id = food.id || uid("cf");
    set((s) => ({
      customFoods: [
        ...s.customFoods,
        {
          ...food,
          id,
          cat: "propio",
          custom: true,
          sug: food.sug ?? null,
          sat: food.sat ?? null,
          sod: food.sod ?? null,
        },
      ],
    }));
    get().persist();
    return id;
  },
  updateCustomFood: (id, patch) => {
    const prev = get().customFoods.find((f) => f.id === id);
    if (!prev) return;
    set((s) => ({
      customFoods: s.customFoods.map((f) =>
        f.id === id
          ? { ...patch, id, cat: "propio", custom: true, sug: patch.sug ?? null, sat: patch.sat ?? null, sod: patch.sod ?? null }
          : f,
      ),
    }));
    get().persist();
    // Meal entries already logged keep their own snapshot of macros taken at
    // add-time (see addMeal), so editing a custom food's numbers never rewrites
    // history — only future uses of it see the new values.
    recordUndo("Alimento actualizado", () => {
      set((s) => ({ customFoods: s.customFoods.map((f) => (f.id === id ? prev : f)) }));
      get().persist();
    });
  },

  removeCustomFood: (id) => {
    const s = get();
    const removed = s.customFoods.find((f) => f.id === id);
    if (!removed) return;
    const at = s.customFoods.findIndex((f) => f.id === id);
    const hadFavorite = s.favorites.includes(id);
    const hadPantry = s.pantry.includes(id);
    set({
      customFoods: s.customFoods.filter((f) => f.id !== id),
      // Otherwise the id sits in these lists forever: getFood(id) resolves to
      // nothing once the food is gone, and every screen that maps over them
      // already has to silently filter out that undefined — cleaning it up
      // here means they don't have to keep doing that for a deleted id.
      favorites: s.favorites.filter((x) => x !== id),
      pantry: s.pantry.filter((x) => x !== id),
    });
    get().persist();
    recordUndo(`Quitado ${removed.name}`, () => {
      set((st) => {
        const foods = [...st.customFoods];
        if (at >= 0 && at <= foods.length) foods.splice(at, 0, removed);
        else foods.push(removed);
        return {
          customFoods: foods,
          favorites: hadFavorite ? [...st.favorites, id] : st.favorites,
          pantry: hadPantry ? [...st.pantry, id] : st.pantry,
        };
      });
      get().persist();
    });
  },

  addUserRecipe: (recipe) => {
    set((s) => ({ recipes: [...s.recipes, recipe] }));
    get().persist();
  },

  updateUserRecipe: (id, recipe) => {
    const prev = get().recipes.find((r) => r.id === id);
    if (!prev) return;
    set((s) => ({ recipes: s.recipes.map((r) => (r.id === id ? recipe : r)) }));
    get().persist();
    recordUndo("Receta actualizada", () => {
      set((s) => ({ recipes: s.recipes.map((r) => (r.id === id ? prev : r)) }));
      get().persist();
    });
  },

  deleteUserRecipe: (id) => {
    const s = get();
    const removed = s.recipes.find((r) => r.id === id);
    if (!removed) return;
    const at = s.recipes.findIndex((r) => r.id === id);
    const hadFavorite = s.favRecipes.includes(id);
    set({
      recipes: s.recipes.filter((r) => r.id !== id),
      favRecipes: s.favRecipes.filter((x) => x !== id),
    });
    get().persist();
    recordUndo(`Quitada ${removed.name}`, () => {
      set((st) => {
        const list = [...st.recipes];
        if (at >= 0 && at <= list.length) list.splice(at, 0, removed);
        else list.push(removed);
        return { recipes: list, favRecipes: hadFavorite ? [...st.favRecipes, id] : st.favRecipes };
      });
      get().persist();
    });
  },
  addShoppingItem: (input) => {
    const name = input.name.trim();
    if (!name) return null;
    const existing = findShoppingItem(get().shopping, name);
    if (existing) {
      // Adding the same thing twice should not produce two lines to tick off.
      // An already-bought line comes back as pending, and the amounts are
      // merged: keeping only the first one meant coming home short.
      const qty = mergeQty(existing.qty, input.qty ?? "");
      if (existing.done || qty !== existing.qty) {
        set((s) => ({
          shopping: s.shopping.map((i) => (i.id === existing.id ? { ...i, done: false, qty } : i)),
        }));
        get().persist();
      }
      return existing.id;
    }
    const item = makeShoppingItem({ ...input, name });
    set((s) => ({ shopping: [...s.shopping, item] }));
    get().persist();
    return item.id;
  },

  addShoppingItems: (inputs) => {
    const s = get();
    const next = [...s.shopping];
    const addedIds: string[] = [];
    const revivedIds: string[] = [];
    /** Cómo estaba cada línea fusionada antes de tocarla, para el deshacer. */
    const revived: { id: string; qty: string; done: boolean }[] = [];
    for (const input of inputs) {
      const name = input.name.trim();
      if (!name) continue;
      const existing = findShoppingItem(next, name);
      if (existing) {
        // Same rule as addShoppingItem: a line already ticked off comes back as
        // pending, and the amounts are merged. Skipping it left an ingredient
        // the user had just asked for sitting in the "comprados" section,
        // invisible while shopping — and dropped the second recipe's amount.
        const qty = mergeQty(existing.qty, input.qty ?? "");
        if (existing.done || qty !== existing.qty) {
          if (!revived.some((r) => r.id === existing.id)) {
            revived.push({ id: existing.id, qty: existing.qty, done: existing.done });
          }
          next[next.indexOf(existing)] = { ...existing, done: false, qty };
          revivedIds.push(existing.id);
        }
        continue;
      }
      const item = makeShoppingItem({ ...input, name });
      next.push(item);
      addedIds.push(item.id);
    }
    const added = addedIds.length + revivedIds.length;
    if (!added) return 0;
    set({ shopping: next });
    get().persist();
    const label = added === 1 ? "1 producto" : `${added} productos`;
    recordUndo(`${label} a la lista`, () => {
      const drop = new Set(addedIds);
      // La cantidad de antes de la fusión, no solo el tick: reponer el "✓" y
      // dejar "350 g" donde había "200 g" no es deshacer, es deshacer a medias
      // — te llevabas a la compra la suma de una receta que ya no está.
      const restore = new Map(revived.map((r) => [r.id, r]));
      set((st) => ({
        shopping: st.shopping
          .filter((i) => !drop.has(i.id))
          .map((i) => {
            const prev = restore.get(i.id);
            return prev ? { ...i, done: prev.done, qty: prev.qty } : i;
          }),
      }));
      get().persist();
    });
    return added;
  },

  toggleShoppingItem: (id) => {
    set((s) => ({ shopping: s.shopping.map((i) => (i.id === id ? { ...i, done: !i.done } : i)) }));
    get().persist();
  },

  updateShoppingItem: (id, patch) => {
    const prev = get().shopping.find((i) => i.id === id);
    if (!prev) return;
    set((s) => ({
      shopping: s.shopping.map((i) =>
        i.id === id
          ? {
              ...i,
              ...(patch.name != null && patch.name.trim() ? { name: patch.name.trim() } : {}),
              ...(patch.qty != null ? { qty: patch.qty.trim() } : {}),
            }
          : i,
      ),
    }));
    get().persist();
    const after = get().shopping.find((i) => i.id === id);
    // Solo si algo ha cambiado de verdad: abrir el lápiz y cerrarlo sin tocar
    // nada no debe apilar una entrada de deshacer vacía.
    if (after && (after.name !== prev.name || after.qty !== prev.qty)) {
      recordUndo("Producto corregido", () => {
        set((s) => ({ shopping: s.shopping.map((i) => (i.id === id ? prev : i)) }));
        get().persist();
      });
    }
  },

  removeShoppingItem: (id) => {
    const removed = get().shopping.find((i) => i.id === id);
    if (!removed) return;
    // La lista se agrupa por pasillo pero dentro de cada grupo se pinta en el
    // orden del array, así que reinsertar al final movía la línea de sitio.
    const at = get().shopping.findIndex((i) => i.id === id);
    set((s) => ({ shopping: s.shopping.filter((i) => i.id !== id) }));
    get().persist();
    recordUndo(`Quitado ${removed.name}`, () => {
      set((s) => {
        const list = [...s.shopping];
        if (at >= 0 && at <= list.length) list.splice(at, 0, removed);
        else list.push(removed);
        return { shopping: list };
      });
      get().persist();
    });
  },

  clearShoppingDone: () => {
    const cleared = get().shopping.filter((i) => i.done);
    if (!cleared.length) return;
    set((s) => ({ shopping: s.shopping.filter((i) => !i.done) }));
    get().persist();
    recordUndo(`${plural(cleared.length, "producto quitado", "productos quitados")}`, () => {
      set((s) => ({ shopping: [...s.shopping, ...cleared] }));
      get().persist();
    });
  },

  clearShopping: () => {
    const all = get().shopping;
    if (!all.length) return;
    set({ shopping: [] });
    get().persist();
    recordUndo("Lista vaciada", () => {
      // Devolver el snapshot en crudo (`set({ shopping: all })`) borraba todo
      // lo añadido entre el vaciado y el deshacer, y entre las dos cosas puede
      // pasar un buen rato: la pila guarda veinte acciones y Ajustes deja
      // deshacer desde su propio panel.
      set((s) => {
        const have = new Set(s.shopping.map((i) => i.id));
        return { shopping: [...s.shopping, ...all.filter((i) => !have.has(i.id))] };
      });
      get().persist();
    });
  },

  /** Ticked items that came from the catalog go into the pantry and leave the list. */
  shoppingDoneToPantry: () => {
    const s = get();
    const done = s.shopping.filter((i) => i.done);
    if (!done.length) return 0;
    const ids = done.map((i) => i.foodId).filter((id): id is string => !!id);
    const pantry = [...s.pantry];
    /** Solo lo que esta acción metió: lo que ya estaba no es suyo y no lo quita. */
    const addedToPantry = new Set<string>();
    for (const id of ids) {
      if (!pantry.includes(id)) {
        pantry.push(id);
        addedToPantry.add(id);
      }
    }
    set({ pantry, shopping: s.shopping.filter((i) => !i.done) });
    get().persist();
    recordUndo(`${plural(done.length, "producto guardado", "productos guardados")}`, () => {
      // Reponer la despensa entera desde el snapshot se llevaba por delante
      // cualquier alimento marcado después, desde el catálogo o desde aquí.
      set((st) => ({
        pantry: st.pantry.filter((p) => !addedToPantry.has(p)),
        shopping: [...st.shopping, ...done],
      }));
      get().persist();
    });
    return done.length;
  },

  importAll: (raw) => {
    clearUndo();
    set({ ...migrate(raw), hydrated: true });
    get().persist();
  },
  resetAll: () => {
    clearUndo();
    // Side keys are not covered by `persist()`, which only rewrites STORE_KEY.
    clearAuxStorage();
    set({ ...defaultState(), hydrated: true, viewDate: get().viewDate });
    get().persist();
  },
  undoLast: () => {
    const entry = popUndo();
    if (!entry) return;
    applyUndo(entry);
    toast.success("Deshecho");
  },
}));
