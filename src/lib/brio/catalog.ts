import foodsJson from "@/data/foods.json";
import recipesJson from "@/data/recipes.json";
import routinesJson from "@/data/routines.json";
import type { Food, Macros, Recipe, RecipeSource, UserRecipe } from "./types";
import { round } from "./format";
import { buildFoodIndex, searchIndexed } from "./search";

export const BASE_FOODS = foodsJson as Food[];

const NON_VEGETARIAN_IDS = new Set(["f683", "f684", "f942", "f232"]);
const NON_VEGAN_IDS = new Set(["f279"]);
const NON_VEGETARIAN_CATS = new Set(["carne", "pescado"]);
const NON_VEGAN_CATS = new Set(["carne", "pescado", "lacteo"]);

export const FOOD_BY_ID: Record<string, Food> = {};
for (const f of BASE_FOODS) FOOD_BY_ID[f.id] = f;

export const RECIPE_FILTERS: {
  id: string;
  n: string;
  why: string;
  test: (r: Recipe) => boolean;
}[] = [
  {
    id: "prot",
    n: "Alto en proteína",
    why: "Al menos el 20 % de la energía procede de la proteína.",
    test: (r) => r.per100.kcal > 0 && (r.per100.prot * 4) / r.per100.kcal >= 0.2,
  },
  {
    id: "lowfat",
    n: "Bajo en grasa",
    why: "Como máximo 3 g de grasa por 100 g.",
    test: (r) => r.per100.fat <= 3,
  },
  {
    id: "lowcal",
    n: "Ligera",
    why: "Como máximo 400 kcal por ración.",
    test: (r) => r.perServing.kcal <= 400,
  },
  {
    id: "fiber",
    n: "Fuente de fibra",
    why: "Al menos 3 g de fibra por 100 g.",
    test: (r) => r.per100.fib >= 3,
  },
  {
    id: "lowcarb",
    n: "Bajo en hidratos",
    why: "Como máximo 20 g de hidratos por ración.",
    test: (r) => r.perServing.carb <= 20,
  },
  {
    id: "veg",
    n: "Vegetariana",
    why: "Sin carne ni pescado ni derivados como la gelatina.",
    test: (r) => r.vegetarian,
  },
  {
    id: "vegan",
    n: "Vegana",
    why: "Sin ningún ingrediente de origen animal, tampoco huevo, lácteos ni miel.",
    test: (r) => r.vegan,
  },
  {
    id: "quick",
    n: "En 20 minutos",
    why: "Veinte minutos o menos de principio a fin.",
    test: (r) => r.minutes <= 20,
  },
];

function emptyMacros(): Macros {
  return { kcal: 0, prot: 0, carb: 0, fat: 0, fib: 0, sug: 0, sat: 0, sod: 0 };
}

export function scaleMacros(m: Pick<Food, keyof Macros>, grams: number): Macros {
  const k = grams / 100;
  const mul = (v: number | null) => (v == null ? null : v * k);
  return {
    kcal: m.kcal * k,
    prot: m.prot * k,
    carb: m.carb * k,
    fat: m.fat * k,
    fib: m.fib * k,
    sug: mul(m.sug),
    sat: mul(m.sat),
    sod: mul(m.sod),
  };
}

export function buildRecipe(src: RecipeSource, foodById: Record<string, Food> = FOOD_BY_ID): Recipe | null {
  const servings = Math.max(1, src.servings || 1);
  const ing: Recipe["ing"] = [];
  let totalG = 0;
  const sum = emptyMacros();
  let sugOk = true,
    satOk = true,
    sodOk = true;
  let vegetarian = true,
    vegan = true;

  for (const item of src.items) {
    const f = foodById[item.foodId];
    if (!f) return null;
    const g = item.grams;
    const k = g / 100;
    sum.kcal += f.kcal * k;
    sum.prot += f.prot * k;
    sum.carb += f.carb * k;
    sum.fat += f.fat * k;
    sum.fib += f.fib * k;
    if (f.sug == null) sugOk = false;
    else sum.sug = (sum.sug || 0) + f.sug * k;
    if (f.sat == null) satOk = false;
    else sum.sat = (sum.sat || 0) + f.sat * k;
    if (f.sod == null) sodOk = false;
    else sum.sod = (sum.sod || 0) + f.sod * k;
    totalG += g;
    ing.push({ id: f.id, name: f.name, g, base: f.base, kcal: f.kcal * k });
    if (NON_VEGETARIAN_CATS.has(f.cat) || NON_VEGETARIAN_IDS.has(f.id)) vegetarian = false;
    if (NON_VEGAN_CATS.has(f.cat) || NON_VEGETARIAN_IDS.has(f.id) || NON_VEGAN_IDS.has(f.id)) vegan = false;
  }

  const per100: Macros = {
    kcal: totalG ? (sum.kcal * 100) / totalG : 0,
    prot: totalG ? (sum.prot * 100) / totalG : 0,
    carb: totalG ? (sum.carb * 100) / totalG : 0,
    fat: totalG ? (sum.fat * 100) / totalG : 0,
    fib: totalG ? (sum.fib * 100) / totalG : 0,
    sug: sugOk && totalG ? ((sum.sug || 0) * 100) / totalG : null,
    sat: satOk && totalG ? ((sum.sat || 0) * 100) / totalG : null,
    sod: sodOk && totalG ? ((sum.sod || 0) * 100) / totalG : null,
  };

  const recipe: Recipe = {
    ...src,
    vegetarian,
    vegan,
    totalG: round(totalG, 0),
    servingG: round(totalG / servings, 0),
    per100,
    perServing: {
      kcal: sum.kcal / servings,
      prot: sum.prot / servings,
      carb: sum.carb / servings,
      fat: sum.fat / servings,
      fib: sum.fib / servings,
      sug: sugOk ? (sum.sug || 0) / servings : null,
      sat: satOk ? (sum.sat || 0) / servings : null,
      sod: sodOk ? (sum.sod || 0) / servings : null,
    },
    badges: [],
    ing,
  };
  recipe.badges = RECIPE_FILTERS.filter((f) => f.test(recipe)).map((f) => f.id);
  return recipe;
}

const sources = recipesJson as RecipeSource[];
export const BASE_RECIPES: Recipe[] = sources.map((s) => buildRecipe(s)).filter((r): r is Recipe => !!r);
export const RECIPE_BY_ID: Record<string, Recipe> = {};
for (const r of BASE_RECIPES) RECIPE_BY_ID[r.id] = r;

export function recipeAsFood(r: Recipe): Food {
  return {
    id: r.id,
    name: r.name,
    cat: "receta_base",
    builtinRecipe: true,
    kcal: r.per100.kcal,
    prot: r.per100.prot,
    carb: r.per100.carb,
    fat: r.per100.fat,
    fib: r.per100.fib,
    sug: r.per100.sug,
    sat: r.per100.sat,
    sod: r.per100.sod,
    units: [{ name: "ración", g: r.servingG }],
    base: "g",
  };
}

export const RECIPE_FOODS = BASE_RECIPES.map(recipeAsFood);
for (const f of RECIPE_FOODS) FOOD_BY_ID[f.id] = f;

const BUILTIN_INDEX = buildFoodIndex([...BASE_FOODS, ...RECIPE_FOODS]);

export const RECIPE_CATS = [
  { id: "desayuno", n: "Desayunos" },
  { id: "principal", n: "Platos principales" },
  { id: "guarnicion", n: "Guarniciones y cremas" },
  { id: "batido", n: "Batidos" },
  { id: "snack", n: "Snacks" },
  { id: "postre", n: "Postres" },
];

export type Routine = {
  id: string;
  name: string;
  purposes: string[];
  level: string;
  days: number;
  minutes: number;
  blurb: string;
  sessions: { name: string; exercises: { name: string; rx: string; rest: string }[] }[];
};

export const ROUTINES = routinesJson as Routine[];
export const ROUTINE_LEVELS = [
  { id: "inicio", n: "Principiante" },
  { id: "medio", n: "Intermedio" },
  { id: "alto", n: "Avanzado" },
];

export const PANTRY_BASIC_CATS = new Set(["especia", "grasa"]);
export const PANTRY_BASIC_IDS = new Set(["f305", "f304", "f303", "f240", "f279", "f048", "f034"]);

export function isPantryBasic(f: Food | undefined): boolean {
  return !!(f && (PANTRY_BASIC_CATS.has(f.cat) || PANTRY_BASIC_IDS.has(f.id)));
}

export type CatalogContext = {
  customFoods: Food[];
  recipes: UserRecipe[];
};

function ctxFoods(ctx: CatalogContext): Food[] {
  const custom = ctx.customFoods.map((f) => ({ ...f, custom: true, cat: "propio" as const }));
  const userRecipes: Food[] = ctx.recipes.map((r) => ({
    id: r.id,
    name: r.name,
    cat: "receta",
    recipe: true,
    kcal: r.per100.kcal,
    prot: r.per100.prot,
    carb: r.per100.carb,
    fat: r.per100.fat,
    fib: r.per100.fib,
    sug: null,
    sat: null,
    sod: null,
    units: [{ name: "ración", g: r.servingG }],
    base: "g" as const,
  }));
  return [...custom, ...userRecipes];
}

export function allFoods(ctx: CatalogContext): Food[] {
  return [...BASE_FOODS, ...RECIPE_FOODS, ...ctxFoods(ctx)];
}

export function getFood(id: string, ctx: CatalogContext): Food | undefined {
  const custom = ctx.customFoods.find((f) => f.id === id);
  if (custom) return { ...custom, custom: true, cat: "propio" };
  const ur = ctx.recipes.find((r) => r.id === id);
  if (ur) {
    return {
      id: ur.id,
      name: ur.name,
      cat: "receta",
      recipe: true,
      kcal: ur.per100.kcal,
      prot: ur.per100.prot,
      carb: ur.per100.carb,
      fat: ur.per100.fat,
      fib: ur.per100.fib,
      sug: null,
      sat: null,
      sod: null,
      units: [{ name: "ración", g: ur.servingG }],
      base: "g",
    };
  }
  return FOOD_BY_ID[id];
}

export function defaultServing(food: Food): { grams: number; qty: number; unitName: string } {
  const u = food.units[0];
  if (u) return { grams: u.g, qty: 1, unitName: u.name };
  return { grams: 100, qty: 100, unitName: food.base };
}

export function searchFoods(q: string, cat: string | null, ctx: CatalogContext, limit = 80): Food[] {
  return searchIndexed(q, cat, BUILTIN_INDEX, ctxFoods(ctx), limit);
}

export function filterName(id: string): string {
  return RECIPE_FILTERS.find((f) => f.id === id)?.n ?? id;
}

export function parseRestSeconds(rest: string): number {
  const str = String(rest);
  const min = str.match(/(\d+)\s*min/i);
  if (min) return Number(min[1]) * 60;
  const sec = str.match(/(\d+)\s*s/i);
  return sec ? Number(sec[1]) : 0;
}
