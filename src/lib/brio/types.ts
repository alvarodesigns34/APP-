export const APP_NAME = "Brío";
export const APP_VERSION = "4.1.0";
export const SCHEMA_VERSION = 4;
export const STORE_KEY = "brio.v4";
export const LEGACY_STORE_KEYS = ["brio.v1", "salud.v1"] as const;
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

export type WeightEntry = {
  date: string;
  kg: number;
  fat?: number;
  muscle?: number;
};

export type Profile = {
  name: string;
  sex: Sex;
  birth: string;
  height: number;
  weight: number;
  activity: ActivityId;
  purpose: PurposeId;
};

export type Settings = {
  theme: ThemePref;
  units: "met" | "imp";
  glass: number;
  pantryBasics: boolean;
  activityAdjust: boolean;
  fasting: FastingId;
  macroPreset: MacroPresetId;
  macroPct: MacroPct;
};

export type Goals = {
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
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
  per100: Pick<Macros, "kcal" | "prot" | "carb" | "fat" | "fib">;
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
};

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
