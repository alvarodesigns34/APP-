import {
  LEGACY_STORE_KEYS,
  MEALS,
  NOTE_MAX,
  SCHEMA_VERSION,
  STORE_KEY,
  type DayLog,
  type Food,
  type MealId,
  type PersistedState,
  type Profile,
  type Settings,
  type Goals,
} from "./types";

export function emptyDay(): DayLog {
  return {
    meals: { desayuno: [], comida: [], cena: [], snack: [] },
    water: [],
    steps: 0,
    workouts: [],
    sleep: null,
    note: "",
  };
}

export function defaultState(): PersistedState {
  return {
    schema: SCHEMA_VERSION,
    onboarded: false,
    profile: {
      name: "",
      sex: "h",
      birth: "",
      height: 175,
      weight: 70,
      activity: "lig",
      purpose: "mantener",
    },
    settings: {
      theme: "auto",
      units: "met",
      glass: 250,
      pantryBasics: true,
      activityAdjust: true,
      fasting: "off",
    },
    goals: {
      kcal: 2200,
      prot: 138,
      carb: 248,
      fat: 73,
      steps: 8000,
      water: 2000,
      sleep: 480,
      weight: 70,
      activityMin: 150,
    },
    days: {},
    weights: [],
    customFoods: [],
    recipes: [],
    favorites: [],
    favRecipes: [],
    pantry: [],
    recents: [],
  };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function num(v: unknown, d = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

export function migrate(raw: unknown): PersistedState {
  const base = defaultState();
  const out = isObj(raw) ? raw : {};
  const profile = { ...base.profile, ...(isObj(out.profile) ? out.profile : {}) } as Profile;
  if (profile.sex !== "h" && profile.sex !== "m" && profile.sex !== "nb") profile.sex = "h";
  const settings = { ...base.settings, ...(isObj(out.settings) ? out.settings : {}) } as Settings;
  if (settings.theme !== "auto" && settings.theme !== "light" && settings.theme !== "dark") settings.theme = "auto";
  const fasting = (settings as Settings).fasting;
  if (fasting !== "off" && fasting !== "12-12" && fasting !== "14-10" && fasting !== "16-8" && fasting !== "18-6") {
    settings.fasting = "off";
  }
  const goals = { ...base.goals, ...(isObj(out.goals) ? out.goals : {}) } as Goals;

  const daysIn = isObj(out.days) ? out.days : {};
  const days: Record<string, DayLog> = {};
  for (const [k, v] of Object.entries(daysIn)) {
    if (!isObj(v)) continue;
    const d = emptyDay();
    const meals = isObj(v.meals) ? v.meals : {};
    for (const m of MEALS) {
      const arr = meals[m.id];
      d.meals[m.id] = Array.isArray(arr) ? (arr.filter((e) => e && typeof e === "object") as DayLog["meals"][MealId]) : [];
    }
    d.water = Array.isArray(v.water)
      ? v.water.map((w, i) => {
          const rec = w as { id?: string; t?: number; ml?: number };
          return { id: rec.id || `w${k}${i}`, t: num(rec.t, Date.now()), ml: num(rec.ml) };
        })
      : [];
    d.workouts = Array.isArray(v.workouts) ? (v.workouts as DayLog["workouts"]) : [];
    d.steps = num(v.steps, 0);
    const sleep = v.sleep;
    d.sleep =
      isObj(sleep) && typeof sleep.bed === "number" && typeof sleep.wake === "number"
        ? { bed: sleep.bed, wake: sleep.wake }
        : null;
    d.note = typeof v.note === "string" ? v.note.slice(0, NOTE_MAX) : "";
    days[k] = d;
  }

  return {
    schema: SCHEMA_VERSION,
    onboarded: !!out.onboarded,
    profile,
    settings,
    goals,
    days,
    weights: Array.isArray(out.weights)
      ? (out.weights as PersistedState["weights"])
          .filter((w) => w && typeof w.date === "string" && typeof w.kg === "number")
          .sort((a, b) => (a.date < b.date ? -1 : 1))
      : [],
    customFoods: Array.isArray(out.customFoods) ? (out.customFoods as Food[]) : [],
    recipes: Array.isArray(out.recipes) ? (out.recipes as PersistedState["recipes"]) : [],
    favorites: Array.isArray(out.favorites) ? (out.favorites as string[]) : [],
    favRecipes: Array.isArray(out.favRecipes) ? (out.favRecipes as string[]) : [],
    pantry: Array.isArray(out.pantry) ? (out.pantry as string[]) : [],
    recents: Array.isArray(out.recents) ? (out.recents as string[]) : [],
  };
}

export function loadState(): PersistedState {
  if (typeof localStorage === "undefined") return defaultState();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return migrate(JSON.parse(raw));
    for (const k of LEGACY_STORE_KEYS) {
      const legacy = localStorage.getItem(k);
      if (legacy) {
        const migrated = migrate(JSON.parse(legacy));
        saveState(migrated);
        return migrated;
      }
    }
  } catch {
    /* corrupt storage */
  }
  return defaultState();
}

export function saveState(state: PersistedState): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ ...state, schema: SCHEMA_VERSION }));
    return true;
  } catch {
    return false;
  }
}

export function isEmptyDay(d: DayLog): boolean {
  return (
    MEALS.every((m) => d.meals[m.id].length === 0) &&
    d.water.length === 0 &&
    !d.steps &&
    d.workouts.length === 0 &&
    !d.sleep &&
    !d.note.trim()
  );
}
