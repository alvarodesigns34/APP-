import type { AccentId } from "./accent";

export const APP_NAME = "Brío";
export const APP_VERSION = "4.8.0";
export const SCHEMA_VERSION = 4;
export const STORE_KEY = "brio.v4";
export const LEGACY_STORE_KEYS = ["brio.v1", "salud.v1"] as const;
/**
 * Side keys kept outside the main store. They are not part of the exported
 * backup, but "borrar todos los datos" must still clear them — otherwise the
 * wipe leaves the last search and the reminder bookkeeping behind.
 */
export const AUX_STORE_KEYS = ["brio.search-prefs", "brio.reminders.fired"] as const;
export const NOTE_MAX = 600;

export type Sex = "h" | "m" | "nb";
export type PurposeId = "perder" | "recomp" | "mantener" | "ganar";
export type ActivityId = "sed" | "lig" | "mod" | "alto" | "muy";
export type MealId = "desayuno" | "comida" | "cena" | "snack";
export type ThemePref = "auto" | "light" | "dark";
export type IntensityId = "suave" | "media" | "alta";
export type FoodBase = "g" | "ml";
export type FastingId = "off" | "12-12" | "14-10" | "16-8" | "18-6";
export type MacroPresetId = "equilibrado" | "alto-prot" | "keto" | "custom";
export type MacroPct = { prot: number; carb: number; fat: number };

export type FoodUnit = { name: string; g: number };

export type Food = {
  id: string;
  name: string;
  cat: string;
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
  fib: number;
  sug: number | null;
  sat: number | null;
  sod: number | null;
  units: FoodUnit[];
  base: FoodBase;
  custom?: boolean;
  recipe?: boolean;
  builtinRecipe?: boolean;
  barcode?: string;
};

export type RecipeItem = { foodId: string; grams: number };

export type RecipeSource = {
  id: string;
  name: string;
  cat: string;
  servings: number;
  minutes: number;
  items: RecipeItem[];
  steps: string[];
  tags: string[];
};

export type Macros = {
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
  fib: number;
  sug: number | null;
  sat: number | null;
  sod: number | null;
};

export type Recipe = RecipeSource & {
  vegetarian: boolean;
  vegan: boolean;
  totalG: number;
  servingG: number;
  per100: Macros;
  perServing: Macros;
  badges: string[];
  ing: { id: string; name: string; g: number; base: FoodBase; kcal: number }[];
};

export type MealEntry = {
  id: string;
  foodId: string;
  name: string;
  qty: number;
  unitName: string;
  grams: number;
  /** When this entry was logged (ms epoch). Absent on entries saved before this field existed. */
  t?: number;
} & Macros;

export type WaterEntry = { id: string; t: number; ml: number };

export type WorkoutEntry = {
  id: string;
  type: string;
  min: number;
  intensity: IntensityId;
  kcal: number;
};

export type SleepEntry = { bed: number; wake: number };

export type DayLog = {
  meals: Record<MealId, MealEntry[]>;
  water: WaterEntry[];
  steps: number;
  workouts: WorkoutEntry[];
  sleep: SleepEntry | null;
  note: string;
};

/**
 * One line on the shopping list.
 *
 * The list is a first-class list of its own, not a view over recipes: an item
 * can come from a recipe (`foodId` set) or be anything the user types.
 */
export type ShoppingItem = {
  id: string;
  name: string;
  /** Free text as typed — "2 kg", "un paquete". Empty when the user gave none. */
  qty: string;
  done: boolean;
  /** A CATEGORIES id used to group by supermarket aisle, or "otros". */
  cat: string;
  /** Set when the item came from the catalog, so it can go to the pantry once bought. */
  foodId?: string;
  /** When it was added (ms epoch). */
  t: number;
};

/**
 * Las medidas que se pueden apuntar junto al peso, en centímetros.
 *
 * Viven aquí, junto a MEALS y compañía, para que el tipo de `WeightEntry`
 * pueda derivarse de la lista: así añadir una medida es tocar un sitio, y la
 * hoja de registro, la validación al cargar y el CSV recorren todas la misma
 * fuente en vez de repetir la lista tres veces.
 */
export const MEASURES = [
  { id: "waist", n: "Cintura" },
  { id: "chest", n: "Pecho" },
  { id: "hip", n: "Cadera" },
  { id: "arm", n: "Brazo" },
  { id: "thigh", n: "Muslo" },
] as const;

export type MeasureId = (typeof MEASURES)[number]["id"];

/**
 * Un pesaje y, opcionalmente, lo que te midieras esa misma mañana. Es una
 * entrada por fecha y no una colección aparte a propósito: quien se mide lo
 * hace el mismo día que se pesa, y así las dos series comparten eje temporal
 * sin tener que cruzarlas.
 */
export type WeightEntry = {
  date: string;
  kg: number;
  fat?: number;
  muscle?: number;
} & Partial<Record<MeasureId, number>>;

export type Profile = {
  name: string;
  sex: Sex;
  birth: string;
  height: number;
  weight: number;
  activity: ActivityId;
  purpose: PurposeId;
};

export type ReminderSettings = {
  enabled: boolean;
  meals: boolean;
  water: boolean;
  weight: boolean;
  streak: boolean;
  desayuno: string;
  comida: string;
  cena: string;
  aguaEveryMin: number;
  peso: string;
  streakTime: string;
};

export type WeekdayPlan = {
  enabled: boolean;
  /** index 0 = Sunday … 6 = Saturday, matching Date.getDay() */
  training: boolean[];
};

export type Settings = {
  theme: ThemePref;
  /** Which palette drives `--brio-primary`/`--brio-kcal`. See lib/brio/accent.ts. */
  accent: AccentId;
  units: "met" | "imp";
  glass: number;
  pantryBasics: boolean;
  activityAdjust: boolean;
  fasting: FastingId;
  /**
   * Minutes-from-midnight the eating window opens. The presets fix a window
   * length (16:8 = 8h eating) but previously also fixed *when* — always
   * 12:00–20:00 for 16:8, so someone eating 14:00–22:00 (normal in Spain)
   * could not represent their actual schedule. This shifts the same-length
   * window; it means nothing while `fasting` is "off".
   */
  fastingStart: number;
  macroPreset: MacroPresetId;
  macroPct: MacroPct;
  reminders: ReminderSettings;
  weekdayPlan: WeekdayPlan;
};

export type Goals = {
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
  fib: number;
  steps: number;
  water: number;
  sleep: number;
  weight: number;
  activityMin: number;
};

export type UserRecipe = {
  id: string;
  name: string;
  items: RecipeItem[];
  servings: number;
  servingG: number;
  /**
   * `Macros` entero, no solo los cinco de siempre. Las recetas del catálogo
   * conservan azúcar, saturada y sodio y las propias los tiraban, así que
   * cocinar en casa borraba esos tres del total del día. Los tres pueden ser
   * `null`: significa "algún ingrediente no traía el dato", no cero.
   */
  per100: Macros;
};

export type PersistedState = {
  schema: number;
  onboarded: boolean;
  profile: Profile;
  settings: Settings;
  goals: Goals;
  days: Record<string, DayLog>;
  weights: WeightEntry[];
  customFoods: Food[];
  recipes: UserRecipe[];
  favorites: string[];
  favRecipes: string[];
  pantry: string[];
  recents: string[];
  shopping: ShoppingItem[];
};

/**
 * What the read-only selectors actually need.
 *
 * The shopping list is deliberately excluded: nothing derived from a day, a
 * goal or a weigh-in reads it, so screens can subscribe to a slice that does
 * not change when you tick something off the list. A full `PersistedState` is
 * assignable here, so the store keeps working everywhere.
 */
export type SelectorState = Omit<PersistedState, "shopping">;

export const MEALS: { id: MealId; n: string }[] = [
  { id: "desayuno", n: "Desayuno" },
  { id: "comida", n: "Comida" },
  { id: "cena", n: "Cena" },
  { id: "snack", n: "Tentempiés" },
];

export const FASTING_PRESETS: { id: FastingId; n: string; hint: string; start: number; end: number }[] = [
  { id: "off", n: "Sin ventana", hint: "Come cuando quieras", start: 0, end: 1440 },
  { id: "12-12", n: "12:12", hint: "8:00 – 20:00", start: 8 * 60, end: 20 * 60 },
  { id: "14-10", n: "14:10", hint: "10:00 – 20:00", start: 10 * 60, end: 20 * 60 },
  { id: "16-8", n: "16:8", hint: "12:00 – 20:00", start: 12 * 60, end: 20 * 60 },
  { id: "18-6", n: "18:6", hint: "14:00 – 20:00", start: 14 * 60, end: 20 * 60 },
];

export const CATEGORIES: { id: string; n: string }[] = [
  { id: "fruta", n: "Frutas" },
  { id: "verdura", n: "Verduras y hortalizas" },
  { id: "carne", n: "Carnes y embutidos" },
  { id: "pescado", n: "Pescados y mariscos" },
  { id: "lacteo", n: "Huevos y lácteos" },
  { id: "cereal", n: "Cereales, pan y pasta" },
  { id: "legumbre", n: "Legumbres" },
  { id: "frutoseco", n: "Frutos secos y semillas" },
  { id: "grasa", n: "Aceites y grasas" },
  { id: "bebida", n: "Bebidas" },
  { id: "dulce", n: "Dulces, snacks y bollería" },
  { id: "salsa", n: "Salsas y condimentos" },
  { id: "especia", n: "Especias y hierbas" },
  { id: "precocinado", n: "Productos preparados" },
  { id: "receta_base", n: "Recetas" },
  { id: "propio", n: "Mis alimentos" },
  { id: "receta", n: "Mis recetas" },
];
