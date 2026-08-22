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
  type IntensityId,
  type MealEntry,
  type PersistedState,
  type Profile,
  type Settings,
  type Goals,
  type UserRecipe,
  type WeightEntry,
  type WorkoutEntry,
} from "./types";
import { normalizeEan } from "./barcode";
import { parseShopping } from "./shopping";

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
    shopping: [],
  };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function num(v: unknown, d = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

/**
 * `Number(null)` and `Number("")` are both 0, so an absent field would silently
 * become a real zero — for a goal that reads as "switched off" rather than
 * "missing". Treat those as absent and let the caller's fallback win.
 */
function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Finite and > 0, else the fallback. */
function positive(v: unknown, fallback: number): number {
  const n = numOrNull(v);
  return n != null && n > 0 ? n : fallback;
}

/** Finite and >= 0, else the fallback. An explicit zero is a legal "goal switched off". */
function nonNegative(v: unknown, fallback: number): number {
  const n = numOrNull(v);
  return n != null && n >= 0 ? n : fallback;
}

function strIds(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.length > 0);
}

function isFoodUnit(v: unknown): v is FoodUnit {
  return isObj(v) && typeof v.name === "string" && Number.isFinite(Number(v.g)) && Number(v.g) > 0;
}

function isIntensityId(v: unknown): v is IntensityId {
  return v === "suave" || v === "media" || v === "alta";
}

function parseWorkout(v: unknown): WorkoutEntry | null {
  if (!isObj(v)) return null;
  if (typeof v.id !== "string" || !v.id) return null;
  if (typeof v.type !== "string" || !v.type) return null;
  if (!isIntensityId(v.intensity)) return null;
  const min = Number(v.min);
  const kcal = Number(v.kcal);
  if (!Number.isFinite(min) || min < 0) return null;
  if (!Number.isFinite(kcal) || kcal < 0) return null;
  return { id: v.id, type: v.type, min, intensity: v.intensity, kcal };
}

/**
 * Meal entries used to pass through on nothing more than `typeof === "object"`,
 * so a hand-edited or truncated backup could carry an entry with no `kcal` at
 * all. `sumEntries` adds those straight into the day's totals, and one missing
 * number turns every calorie figure in the app into NaN. Validate them the same
 * way workouts and custom foods already are.
 */
function parseMealEntry(v: unknown, index: number): MealEntry | null {
  if (!isObj(v)) return null;
  const macro = (x: unknown): number | null => {
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
  };
  const kcal = macro(v.kcal);
  const prot = macro(v.prot);
  const carb = macro(v.carb);
  const fat = macro(v.fat);
  const fib = macro(v.fib);
  if (kcal == null || prot == null || carb == null || fat == null || fib == null) return null;
  const grams = macro(v.grams);
  const qty = macro(v.qty);
  const foodId = typeof v.foodId === "string" && v.foodId ? v.foodId : null;
  if (foodId == null) return null;
  const t = macro(v.t);
  return {
    id: typeof v.id === "string" && v.id ? v.id : `e-migrated-${index}-${foodId}`,
    foodId,
    name: typeof v.name === "string" && v.name ? v.name : foodId,
    qty: qty != null && qty > 0 ? qty : 1,
    unitName: typeof v.unitName === "string" && v.unitName ? v.unitName : "g",
    grams: grams != null && grams >= 0 ? grams : 0,
    ...(t != null ? { t } : {}),
    kcal,
    prot,
    carb,
    fat,
    fib,
    sug: macro(v.sug),
    sat: macro(v.sat),
    sod: macro(v.sod),
  };
}

/**
 * Body-fat and muscle percentages reach the CSV export and the weight history,
 * so they get the same validation as everything else rather than being passed
 * through from the file untouched.
 */
function parseWeight(v: unknown): WeightEntry | null {
  if (!isObj(v)) return null;
  if (typeof v.date !== "string" || !v.date) return null;
  const kg = numOrNull(v.kg);
  if (kg == null || kg <= 0) return null;
  const pct = (x: unknown): number | undefined => {
    const n = numOrNull(x);
    return n != null && n > 0 && n <= 100 ? n : undefined;
  };
  const fat = pct(v.fat);
  const muscle = pct(v.muscle);
  return { date: v.date, kg, ...(fat != null ? { fat } : {}), ...(muscle != null ? { muscle } : {}) };
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
  // Height and weight feed bmr/bmi/kcalFromSteps. A string or a negative number
  // from a hand-edited backup would otherwise reach them unchecked.
  profile.height = positive(profile.height, base.profile.height);
  profile.weight = positive(profile.weight, base.profile.weight);
  profile.name = typeof profile.name === "string" ? profile.name : "";
  profile.birth = typeof profile.birth === "string" ? profile.birth : "";
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
  // Saves from before this setting existed have no `activityAdjust` key at all — default
  // those to off so a returning user's kcal goal doesn't silently change. An explicit
  // true/false (including one this app itself saved) is always respected as-is.
  settings.activityAdjust = typeof rawSettings?.activityAdjust === "boolean" ? rawSettings.activityAdjust : false;
  const rawGoals = { ...base.goals, ...(isObj(out.goals) ? out.goals : {}) } as Goals;
  // Every goal divides or subtracts somewhere on Hoy and Tendencias; a
  // non-numeric one turns whole screens into NaN. Zero stays legal (it is how
  // Ajustes lets you switch a goal off) — only non-finite and negative are not.
  const goals: Goals = {
    kcal: nonNegative(rawGoals.kcal, base.goals.kcal),
    prot: nonNegative(rawGoals.prot, base.goals.prot),
    carb: nonNegative(rawGoals.carb, base.goals.carb),
    fat: nonNegative(rawGoals.fat, base.goals.fat),
    steps: nonNegative(rawGoals.steps, base.goals.steps),
    water: nonNegative(rawGoals.water, base.goals.water),
    sleep: nonNegative(rawGoals.sleep, base.goals.sleep),
    weight: positive(rawGoals.weight, base.goals.weight),
    activityMin: nonNegative(rawGoals.activityMin, base.goals.activityMin),
  };

  const daysIn = isObj(out.days) ? out.days : {};
  const days: Record<string, DayLog> = {};
  for (const [k, v] of Object.entries(daysIn)) {
    if (!isObj(v)) continue;
    const d = emptyDay();
    const meals = isObj(v.meals) ? v.meals : {};
    for (const m of MEALS) {
      const arr = meals[m.id];
      d.meals[m.id] = Array.isArray(arr)
        ? arr.map((e, i) => parseMealEntry(e, i)).filter((e): e is MealEntry => e != null)
        : [];
    }
    d.water = Array.isArray(v.water)
      ? v.water.map((w, i) => {
          const rec = w as { id?: string; t?: number; ml?: number };
          return { id: rec.id || `w${k}${i}`, t: num(rec.t, Date.now()), ml: num(rec.ml) };
        })
      : [];
    d.workouts = Array.isArray(v.workouts)
      ? v.workouts.map(parseWorkout).filter((w): w is WorkoutEntry => w != null)
      : [];
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
      ? out.weights
          .map(parseWeight)
          .filter((w): w is WeightEntry => w != null)
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
    // Additive: saves from before the shopping list existed simply have none.
    shopping: parseShopping(out.shopping),
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
