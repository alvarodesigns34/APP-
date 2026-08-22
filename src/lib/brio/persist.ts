import { DEFAULT_MACRO_PCT, clampMacroPct, isMacroPresetId, pctForPreset } from "./domain";
import { DEFAULT_REMINDERS, parseReminders } from "./reminders";
import { DEFAULT_WEEKDAY_PLAN, parseWeekdayPlan } from "./weekday-goals";
import {
  AUX_STORE_KEYS,
  LEGACY_STORE_KEYS,
  MEALS,
  NOTE_MAX,
  SCHEMA_VERSION,
  STORE_KEY,
  type DayLog,
  type Food,
  type FoodUnit,
  type MealId,
  type PersistedState,
  type Profile,
  type Settings,
  type Goals,
  type UserRecipe,
} from "./types";
import { normalizeEan } from "./barcode";

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
      macroPreset: "equilibrado",
      macroPct: { ...DEFAULT_MACRO_PCT },
      reminders: { ...DEFAULT_REMINDERS },
      weekdayPlan: { ...DEFAULT_WEEKDAY_PLAN, training: [...DEFAULT_WEEKDAY_PLAN.training] },
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

function strIds(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.length > 0);
}

function isFoodUnit(v: unknown): v is FoodUnit {
  return isObj(v) && typeof v.name === "string" && Number.isFinite(Number(v.g)) && Number(v.g) > 0;
}

function parseFood(v: unknown): Food | null {
  if (!isObj(v)) return null;
  if (typeof v.id !== "string" || !v.id) return null;
  if (typeof v.name !== "string" || !v.name) return null;
  if (typeof v.cat !== "string" || !v.cat) return null;
  if (v.base !== "g" && v.base !== "ml") return null;
  const kcal = Number(v.kcal);
  const prot = Number(v.prot);
  const carb = Number(v.carb);
  const fat = Number(v.fat);
  const fib = Number(v.fib);
  if (![kcal, prot, carb, fat, fib].every(Number.isFinite)) return null;
  const units = Array.isArray(v.units) ? v.units.filter(isFoodUnit) : [];
  const opt = (x: unknown): number | null => {
    if (x == null) return null;
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
  };
  const barcode = typeof v.barcode === "string" ? normalizeEan(v.barcode) : "";
  return {
    id: v.id,
    name: v.name,
    cat: v.cat,
    kcal,
    prot,
    carb,
    fat,
    fib,
    sug: opt(v.sug),
    sat: opt(v.sat),
    sod: opt(v.sod),
    units,
    base: v.base,
    custom: true,
    ...(barcode ? { barcode } : {}),
  };
}

function parseUserRecipe(v: unknown): UserRecipe | null {
  if (!isObj(v)) return null;
  if (typeof v.id !== "string" || !v.id) return null;
  if (typeof v.name !== "string" || !v.name) return null;
  if (!Array.isArray(v.items)) return null;
  const servings = Number(v.servings);
  const servingG = Number(v.servingG);
  if (!Number.isFinite(servings) || servings <= 0) return null;
  if (!Number.isFinite(servingG) || servingG < 0) return null;
  const items = v.items.filter((it): it is { foodId: string; grams: number } => {
    if (!isObj(it)) return false;
    const grams = Number(it.grams);
    return typeof it.foodId === "string" && it.foodId.length > 0 && Number.isFinite(grams) && grams > 0;
  });
  const per = isObj(v.per100) ? v.per100 : {};
  return {
    id: v.id,
    name: v.name,
    items,
    servings,
    servingG,
    per100: {
      kcal: num(per.kcal),
      prot: num(per.prot),
      carb: num(per.carb),
      fat: num(per.fat),
      fib: num(per.fib),
    },
  };
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
  if (settings.units !== "met" && settings.units !== "imp") settings.units = "met";
  if (!isMacroPresetId(settings.macroPreset)) {
    settings.macroPreset = "equilibrado";
    settings.macroPct = { ...DEFAULT_MACRO_PCT };
  } else if (settings.macroPreset === "custom") {
    const p = isObj(settings.macroPct) ? settings.macroPct : null;
    const prot = p ? Number(p.prot) : NaN;
    const carb = p ? Number(p.carb) : NaN;
    const fat = p ? Number(p.fat) : NaN;
    if (![prot, carb, fat].every(Number.isFinite)) {
      settings.macroPct = { ...DEFAULT_MACRO_PCT };
    } else {
      settings.macroPct = clampMacroPct({ prot, carb, fat });
    }
  } else {
    settings.macroPct = pctForPreset(settings.macroPreset);
  }
  const rawSettings = isObj(out.settings) ? out.settings : null;
  settings.reminders = parseReminders(rawSettings ? rawSettings.reminders : undefined);
  settings.weekdayPlan = parseWeekdayPlan(rawSettings ? rawSettings.weekdayPlan : undefined);
  const goals = { ...base.goals, ...(isObj(out.goals) ? out.goals : {}) } as Goals;

  const daysIn = isObj(out.days) ? out.days : {};
  const days: Record<string, DayLog> = {};
  for (const [k, v] of Object.entries(daysIn)) {
    if (!isObj(v)) continue;
    const d = emptyDay();
    const meals = isObj(v.meals) ? v.meals : {};
    for (const m of MEALS) {
      const arr = meals[m.id];
      d.meals[m.id] = Array.isArray(arr)
        ? (arr.filter((e) => e && typeof e === "object") as DayLog["meals"][MealId])
        : [];
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
    customFoods: Array.isArray(out.customFoods)
      ? out.customFoods.map(parseFood).filter((f): f is Food => f != null)
      : [],
    recipes: Array.isArray(out.recipes)
      ? out.recipes.map(parseUserRecipe).filter((r): r is UserRecipe => r != null)
      : [],
    favorites: strIds(out.favorites),
    favRecipes: strIds(out.favRecipes),
    pantry: strIds(out.pantry),
    recents: strIds(out.recents),
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

/**
 * Removes the keys that live outside the main store. `resetAll` rewrites
 * `STORE_KEY` with a fresh state, which leaves these untouched, so a wipe has to
 * clear them explicitly for "borrar todos los datos" to mean what it says.
 */
export function clearAuxStorage(): void {
  if (typeof localStorage === "undefined") return;
  for (const k of [...AUX_STORE_KEYS, ...LEGACY_STORE_KEYS]) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* private mode */
    }
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
