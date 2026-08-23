import { DEFAULT_ACCENT, isAccentId } from "./accent";
import { isMeasureInRange } from "./measures";
import { DEFAULT_MACRO_PCT, clampMacroPct, isMacroPresetId, pctForPreset } from "./domain";
import { DEFAULT_REMINDERS, parseReminders } from "./reminders";
import { DEFAULT_WEEKDAY_PLAN, parseWeekdayPlan } from "./weekday-goals";
import {
  AUX_STORE_KEYS,
  LEGACY_STORE_KEYS,
  MEALS,
  MEASURES,
  NOTE_MAX,
  SCHEMA_VERSION,
  STORE_KEY,
  type DayLog,
  type Food,
  type FoodUnit,
  type IntensityId,
  type MealEntry,
  type MeasureId,
  type PersistedState,
  type Profile,
  type Settings,
  type Goals,
  type UserRecipe,
  type WeightEntry,
  type WorkoutEntry,
} from "./types";
import { normalizeEan } from "./barcode";
import { DATE_KEY } from "./dates";
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
      accent: DEFAULT_ACCENT,
      units: "met",
      glass: 250,
      pantryBasics: true,
      /**
       * Apagado de salida, como ya hacía `migrate` con los guardados antiguos.
       *
       * El aviso de Ajustes dice, con estas palabras, que "tu nivel de
       * actividad ya cuenta el movimiento habitual" y que activando esto "los
       * entrenos y los pasos de hoy se suman otra vez". Con el nivel por
       * defecto (Ligero, PAL 1,375) y esta clave en `true`, todo usuario nuevo
       * arrancaba justo en el estado contra el que la app avisa — y sin haber
       * visto el aviso, que solo aparece en Ajustes. Quien omitía el
       * onboarding, además, llegaba ahí sin haber contestado nada.
       *
       * Quien lo quiera lo enciende en Ajustes, que es donde está el aviso. Los
       * que ya lo tuvieran guardado explícitamente no se ven afectados:
       * `migrate` respeta un booleano explícito.
       */
      activityAdjust: false,
      fasting: "off",
      // Matches FASTING_PRESETS' own "16-8" start (12:00); irrelevant while
      // fasting is "off", but a real default avoids a 00:00 fallback the one
      // time someone turns fasting on without ever touching this field.
      fastingStart: 12 * 60,
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
      fib: 31,
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
  // `numOrNull` y no `Number`: `Number(null)` es 0 y es finito, así que un
  // backup con `min: null` ("este dato no lo tengo") colaba un entreno fantasma
  // de 0 min y 0 kcal, que luego cuenta como sesión en los logros y en las
  // marcas de entreno. Un hueco es un descarte, no un cero.
  const min = numOrNull(v.min);
  const kcal = numOrNull(v.kcal);
  if (min == null || min < 0) return null;
  if (kcal == null || kcal < 0) return null;
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
  // `numOrNull` y no `Number`: ver el comentario de abajo sobre sug/sat/sod. El
  // mismo `Number(null) === 0` que allí convertía "no lo sabemos" en cero aquí
  // hacía pasar por buena una entrada con `kcal: null`, guardándola como una
  // afirmación de 0 kcal y 0 g de proteína. Un hueco en un macro obligatorio es
  // un descarte, que es justo lo que esta función existe para hacer.
  const macro = (x: unknown): number | null => numOrNull(x);
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
    // Arriba, un hueco en kcal/prot/etc descarta la entrada entera: una comida
    // no puede no tener calorías. Para estos tres es al revés: `null` es el
    // valor legítimo de "Open Food Facts no traía este dato", no un error de
    // carga, así que se conserva tal cual y `dayFoodTotals` lo trata como
    // ausente en vez de sumar un cero falso al total del día.
    sug: numOrNull(v.sug),
    sat: numOrNull(v.sat),
    sod: numOrNull(v.sod),
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
  // Las medidas se recorren desde MEASURES para que añadir una no exija
  // acordarse de tocar también esta función.
  const measures: Partial<Record<MeasureId, number>> = {};
  for (const m of MEASURES) {
    const n = numOrNull(v[m.id]);
    if (n != null && isMeasureInRange(n)) measures[m.id] = n;
  }
  return { date: v.date, kg, ...(fat != null ? { fat } : {}), ...(muscle != null ? { muscle } : {}), ...measures };
}

function parseFood(v: unknown): Food | null {
  if (!isObj(v)) return null;
  if (typeof v.id !== "string" || !v.id) return null;
  if (typeof v.name !== "string" || !v.name) return null;
  if (typeof v.cat !== "string" || !v.cat) return null;
  if (v.base !== "g" && v.base !== "ml") return null;
  // `numOrNull` y no `Number`, por lo mismo que en `parseMealEntry` y en
  // `parseWorkout`: `Number(null)` es 0 y 0 es finito, así que un alimento
  // propio con `kcal: null` entraba declarando cero calorías, y ese cero se
  // suma al día como si fuera un dato medido en vez de un hueco.
  const kcal = numOrNull(v.kcal);
  const prot = numOrNull(v.prot);
  const carb = numOrNull(v.carb);
  const fat = numOrNull(v.fat);
  const fib = numOrNull(v.fib);
  if (kcal == null || prot == null || carb == null || fat == null || fib == null) return null;
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
  // Una receta sin ingredientes que sobrevivan al filtro no es una receta: se
  // quedaría en la lista de "Mis recetas" sin nada dentro y sin poder
  // reescalarse, porque `buildUserRecipe` divide por el total en gramos.
  if (items.length === 0) return null;
  // Mismo motivo que en `parseFood`: `num()` cae en 0 ante un `null`, así que
  // una receta propia sin `per100` entraba como 0/0/0/0/0 y parecía válida.
  const per = isObj(v.per100) ? v.per100 : {};
  const kcal = numOrNull(per.kcal);
  const prot = numOrNull(per.prot);
  const carb = numOrNull(per.carb);
  const fat = numOrNull(per.fat);
  const fib = numOrNull(per.fib);
  if (kcal == null || prot == null || carb == null || fat == null || fib == null) return null;
  return {
    id: v.id,
    name: v.name,
    items,
    servings,
    servingG,
    // Estos tres sí admiten `null`: es el valor legítimo de "algún ingrediente
    // no traía el dato", igual que en las comidas y en las recetas del catálogo.
    per100: { kcal, prot, carb, fat, fib, sug: numOrNull(per.sug), sat: numOrNull(per.sat), sod: numOrNull(per.sod) },
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
  // An unknown accent would leave `data-accent` pointing at a rule that does
  // not exist, so the app would silently fall back to the bare `:root` green
  // while Ajustes highlighted nothing — better to land on the real default.
  if (!isAccentId(settings.accent)) settings.accent = DEFAULT_ACCENT;
  const fasting = (settings as Settings).fasting;
  if (fasting !== "off" && fasting !== "12-12" && fasting !== "14-10" && fasting !== "16-8" && fasting !== "18-6") {
    settings.fasting = "off";
  }
  if (settings.units !== "met" && settings.units !== "imp") settings.units = "met";
  {
    const n = numOrNull((settings as Settings).fastingStart);
    settings.fastingStart = n != null && n >= 0 && n < 1440 ? Math.round(n) : base.settings.fastingStart;
  }
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
  // Los dos únicos ajustes que se colaban sin validar. `glass` es el tamaño del
  // vaso y se usa como número en toda la pantalla de Agua: un `"mucho"` de una
  // copia editada a mano llegaba entero hasta `uniqueGlassAmounts`, pintaba un
  // botón "+— ml" y a partir del primer toque `waterTotal` concatenaba cadenas,
  // con lo que Actividad enseñaba "NaN vasos". Un 0 o un negativo son igual de
  // inservibles como tamaño de vaso.
  settings.glass = positive(settings.glass, base.settings.glass);
  settings.pantryBasics =
    typeof rawSettings?.pantryBasics === "boolean" ? rawSettings.pantryBasics : base.settings.pantryBasics;
  const rawGoals = { ...base.goals, ...(isObj(out.goals) ? out.goals : {}) } as Goals;
  // Every goal divides or subtracts somewhere on Hoy and Tendencias; a
  // non-numeric one turns whole screens into NaN. Zero stays legal (it is how
  // Ajustes lets you switch a goal off) — only non-finite and negative are not.
  const goals: Goals = {
    kcal: nonNegative(rawGoals.kcal, base.goals.kcal),
    prot: nonNegative(rawGoals.prot, base.goals.prot),
    carb: nonNegative(rawGoals.carb, base.goals.carb),
    fat: nonNegative(rawGoals.fat, base.goals.fat),
    fib: nonNegative(rawGoals.fib, base.goals.fib),
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
    // La clave de un día es la fecha, y media app la parsea como tal. Sin esta
    // guarda, una copia con `days: { "no soy una fecha": {...} }` se importaba
    // igual: la vista previa del backup (que sí filtra por formato) contaba un
    // día menos de los que acababan entrando, `dateOf()` devolvía Invalid Date
    // y el CSV exportado se llevaba la clave basura en la columna de fecha.
    if (!DATE_KEY.test(k)) continue;
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
          // Sin el suelo a 0, un `ml` negativo de una copia editada a mano hace
          // que `waterTotal` salga en negativo y el anillo de agua se pinte al
          // revés. Lo mismo con los pasos, que además restan del objetivo del
          // día vía `activityKcal` cuando el ajuste por actividad está activo.
          return { id: rec.id || `w${k}${i}`, t: num(rec.t, Date.now()), ml: Math.max(0, num(rec.ml)) };
        })
      : [];
    d.workouts = Array.isArray(v.workouts)
      ? v.workouts.map(parseWorkout).filter((w): w is WorkoutEntry => w != null)
      : [];
    d.steps = Math.max(0, num(v.steps, 0));
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
