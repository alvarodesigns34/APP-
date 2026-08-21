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
  WorkoutEntry,
} from "./types";
import { MEALS, NOTE_MAX } from "./types";
import { defaultState, emptyDay, isEmptyDay, loadState, migrate, saveState } from "./persist";
import { uid, round } from "./format";
import { getFood, scaleMacros } from "./catalog";
import { addDays } from "./dates";
import { kcalFromWorkout } from "./domain";

type Ctx = { customFoods: Food[]; recipes: UserRecipe[] };

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
  addMeal: (key: string, meal: MealId, foodId: string, grams: number, qty: number, unitName: string) => string;
  updateMeal: (key: string, meal: MealId, entryId: string, grams: number, qty: number, unitName: string) => void;
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
  addWorkout: (key: string, type: string, min: number, intensity: IntensityId) => void;
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
};

function ctxOf(s: PersistedState): Ctx {
  return { customFoods: s.customFoods, recipes: s.recipes };
}

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

  addMeal: (key, meal, foodId, grams, qty, unitName) => {
    const s = get();
    const food = getFood(foodId, ctxOf(s));
    if (!food) return "";
    const n = scaleMacros(food, grams);
    const id = uid("e");
    const entry: MealEntry = {
      id,
      foodId,
      name: food.name,
      qty: round(qty, 2),
      unitName,
      grams: round(grams, 1),
      kcal: round(n.kcal, 1),
      prot: round(n.prot, 1),
      carb: round(n.carb, 1),
      fat: round(n.fat, 1),
      fib: round(n.fib, 1),
      sug: n.sug == null ? null : round(n.sug, 1),
      sat: n.sat == null ? null : round(n.sat, 1),
      sod: n.sod == null ? null : round(n.sod, 1),
    };
    const recents = [foodId, ...s.recents.filter((x) => x !== foodId)].slice(0, 25);
    set({ days: withDay(s, key, (d) => d.meals[meal].push(entry)), recents });
    get().persist();
    return id;
  },

  updateMeal: (key, meal, entryId, grams, qty, unitName) => {
    const s = get();
    set({
      days: withDay(s, key, (d) => {
        const e = d.meals[meal].find((x) => x.id === entryId);
        if (!e) return;
        const food = getFood(e.foodId, ctxOf(s));
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
    set({
      days: withDay(s, key, (d) => {
        const e = d.meals[meal].find((x) => x.id === entryId);
        if (e) d.meals[meal].push({ ...e, id: uid("e") });
      }),
    });
    get().persist();
  },

  moveMeal: (key, from, to, entryId) => {
    if (from === to) return;
    const s = get();
    set({
      days: withDay(s, key, (d) => {
        const i = d.meals[from].findIndex((x) => x.id === entryId);
        if (i < 0) return;
        const [e] = d.meals[from].splice(i, 1);
        d.meals[to].push(e);
      }),
    });
    get().persist();
  },

  copyDayMeals: (fromKey, toKey) => {
    const s = get();
    const src = s.days[fromKey];
    if (!src) return 0;
    let n = 0;
    set({
      days: withDay(s, toKey, (d) => {
        for (const m of MEALS) {
          for (const e of src.meals[m.id]) {
            d.meals[m.id].push({ ...e, id: uid("e") });
            n += 1;
          }
        }
      }),
    });
    get().persist();
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
          d.meals[meal].push({ ...e, id });
        }
      }),
    });
    get().persist();
    return ids;
  },

  addWater: (key, ml) => {
    const s = get();
    const id = uid("w");
    set({
      days: withDay(s, key, (d) => d.water.push({ id, t: Date.now(), ml })),
    });
    get().persist();
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
    set({ days: withDay(s, key, (d) => { d.water = d.water.filter((w) => w.id !== id); }) });
    get().persist();
  },
  setSteps: (key, steps) => {
    const s = get();
    set({ days: withDay(s, key, (d) => { d.steps = Math.max(0, Math.round(steps)); }) });
    get().persist();
  },
  addWorkout: (key, type, min, intensity) => {
    const s = get();
    const kg = s.weights.at(-1)?.kg ?? s.profile.weight;
    const kcal = kcalFromWorkout(type, min, intensity, kg);
    set({
      days: withDay(s, key, (d) =>
        d.workouts.push({ id: uid("k"), type, min: Math.round(min), intensity, kcal }),
      ),
    });
    get().persist();
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
    set({ days: withDay(s, key, (d) => { d.sleep = sleep; }) });
    get().persist();
  },
  setNote: (key, note) => {
    const s = get();
    set({ days: withDay(s, key, (d) => { d.note = note.slice(0, NOTE_MAX); }) });
    get().persist();
  },
  upsertWeight: (date, kg, extra) => {
    set((s) => {
      const rest = s.weights.filter((w) => w.date !== date);
      const next = [...rest, { date, kg: round(kg, 1), ...extra }].sort((a, b) => (a.date < b.date ? -1 : 1));
      return { weights: next };
    });
    get().persist();
  },
  deleteWeight: (date) => {
    set((s) => ({ weights: s.weights.filter((w) => w.date !== date) }));
    get().persist();
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
        { ...food, id, cat: "propio", custom: true, sug: food.sug ?? null, sat: food.sat ?? null, sod: food.sod ?? null },
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
    set({ ...migrate(raw), hydrated: true });
    get().persist();
  },
  resetAll: () => {
    set({ ...defaultState(), hydrated: true, viewDate: get().viewDate });
    get().persist();
  },
}));

export function previousDayKey(key: string) {
  return addDays(key, -1);
}
