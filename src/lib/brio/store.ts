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
import { MEALS, NOTE_MAX } from "./types";
import { clearAuxStorage, defaultState, emptyDay, isEmptyDay, loadState, migrate, saveState } from "./persist";
import { uid, round, plural } from "./format";
import { scaleMacros } from "./scale-macros";
import { fmtDateRelative } from "./dates";
import { kcalFromWorkout } from "./domain";
import { latestWeight } from "./selectors";
import { applyUndo, clearUndo, isApplyingUndo, popUndo, pushUndo } from "./undo";

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
  restoreMeal: (key: string, meal: MealId, entry: MealEntry) => void;
  duplicateMeal: (key: string, meal: MealId, entryId: string) => void;
  moveMeal: (key: string, from: MealId, to: MealId, entryId: string) => void;
  copyDayMeals: (fromKey: string, toKey: string) => number;
  copyMeal: (fromKey: string, toKey: string, meal: MealId) => string[];
  cloneMealEntries: (toKey: string, meal: MealId, entries: MealEntry[]) => string[];
  addWater: (key: string, ml: number) => string;
  undoWater: (key: string) => void;
  removeWater: (key: string, id: string) => void;
  setSteps: (key: string, steps: number) => void;
  addWorkout: (key: string, type: string, min: number, intensity: IntensityId) => string;
  removeWorkout: (key: string, id: string) => WorkoutEntry | null;
  restoreWorkout: (key: string, entry: WorkoutEntry) => void;
  setSleep: (key: string, sleep: SleepEntry | null) => void;
  setNote: (key: string, note: string) => void;
  upsertWeight: (date: string, kg: number, extra?: { fat?: number; muscle?: number }) => void;
  deleteWeight: (date: string) => void;
  toggleFavorite: (id: string) => void;
  toggleFavRecipe: (id: string) => void;
  togglePantry: (id: string) => void;
  addCustomFood: (food: Omit<Food, "id" | "custom" | "cat"> & { id?: string }) => string;
  addUserRecipe: (recipe: UserRecipe) => void;
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
  };
}

function weightExtra(w: WeightEntry): { fat?: number; muscle?: number } | undefined {
  if (w.fat == null && w.muscle == null) return undefined;
  return { fat: w.fat, muscle: w.muscle };
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
    const recents = [food.id, ...s.recents.filter((x) => x !== food.id)].slice(0, 25);
    set({ days: withDay(s, key, (d) => d.meals[meal].push(entry)), recents });
    get().persist();
    recordUndo("Comida añadida", () => {
      get().removeMeal(key, meal, id);
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
    set({
      days: withDay(s, key, (d) => {
        const i = d.meals[meal].findIndex((x) => x.id === entryId);
        if (i >= 0) removed = d.meals[meal].splice(i, 1)[0];
      }),
    });
    get().persist();
    if (removed) {
      const entry = removed;
      recordUndo("Comida quitada", () => {
        get().restoreMeal(key, meal, entry);
      });
    }
    return removed;
  },

  restoreMeal: (key, meal, entry) => {
    const s = get();
    set({
      days: withDay(s, key, (d) => {
        d.meals[meal].push(entry);
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
    let moved = false;
    set({
      days: withDay(s, key, (d) => {
        const i = d.meals[from].findIndex((x) => x.id === entryId);
        if (i < 0) return;
        const [e] = d.meals[from].splice(i, 1);
        d.meals[to].push(e);
        moved = true;
      }),
    });
    get().persist();
    if (moved) {
      const mealName = MEALS.find((x) => x.id === to)?.n.toLowerCase() ?? to;
      recordUndo(`Movido a ${mealName}`, () => {
        get().moveMeal(key, to, from, entryId);
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
  undoWater: (key) => {
    const s = get();
    set({
      days: withDay(s, key, (d) => {
        if (d.water.length) d.water.pop();
      }),
    });
    get().persist();
  },
  removeWater: (key, id) => {
    const s = get();
    set({
      days: withDay(s, key, (d) => {
        d.water = d.water.filter((w) => w.id !== id);
      }),
    });
    get().persist();
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
  removeWorkout: (key, id) => {
    const s = get();
    let removed: WorkoutEntry | null = null;
    set({
      days: withDay(s, key, (d) => {
        const i = d.workouts.findIndex((w) => w.id === id);
        if (i >= 0) removed = d.workouts.splice(i, 1)[0];
      }),
    });
    get().persist();
    if (removed) {
      const entry = removed;
      recordUndo("Entrenamiento quitado", () => {
        get().restoreWorkout(key, entry);
      });
    }
    return removed;
  },
  restoreWorkout: (key, entry) => {
    const s = get();
    set({
      days: withDay(s, key, (d) => {
        d.workouts.push(entry);
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
  upsertWeight: (date, kg, extra) => {
    const prev = get().weights.find((w) => w.date === date);
    const snapshot = prev ? { ...prev } : null;
    set((s) => {
      const rest = s.weights.filter((w) => w.date !== date);
      const next = [...rest, { date, kg: round(kg, 1), ...extra }].sort((a, b) => (a.date < b.date ? -1 : 1));
      return { weights: next };
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
    set((s) => ({ weights: s.weights.filter((w) => w.date !== date) }));
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
  addUserRecipe: (recipe) => {
    set((s) => ({ recipes: [...s.recipes, recipe] }));
    get().persist();
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
