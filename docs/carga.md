# Fase 1 CARGA — catálogo fuera del chunk inicial, Recharts lazy

Partida: `docs/baseline.md` tabla «tras 1.5» (HEAD `981dcd6`). **No se ha editado ningún campo de `src/data/**`.** Las copias en `public/data/` son byte-idénticas (`cmp`).

## Arquitectura

Offline-first con URLs estables para el SW:

1. Copia (sin editar) `src/data/{foods,recipes,routines}.json` → `public/data/` (`/data/foods.json` etc.).
2. `catalog.ts` **no** hace `import foodsJson from "@/data/foods.json"`. Exporta `ensureCatalog(): Promise<void>` que hace `fetch()` de los tres JSON, construye `FOOD_BY_ID`, `BASE_RECIPES` (`buildRecipe`), `RECIPE_FOODS` y `BUILTIN_INDEX`. Primera llamada gana; se cachea la promesa.
3. Getters síncronos (`getFood`, `BASE_FOODS`, `searchFoods`) leen un snapshot vacío hasta que `ensureCatalog` termina. La UI que necesita catálogo llama `useCatalog()` / `ensureCatalog()`.
4. Corte `store → catalog`:
   - `scaleMacros` vive en `src/lib/brio/scale-macros.ts` (cero JSON).
   - Selectores que usan `getFood` / `BASE_RECIPES` (`suggestRecipes`, `lastPortion`, `missingIngredients`) → `selectors-catalog.ts`.
   - `selectors.ts` no importa `catalog`. `store.ts` no importa `catalog`. `latestWeight` se queda en `selectors.ts`.
   - `addMeal` recibe un `Food` inyectado; `updateMeal` acepta `Food` opcional y si no, escala el entry. Call sites: `food-log`, `quick-add`, `recipe-browser` (`recipeAsFood`).
5. `public/sw.js`: PRECACHE incluye `/data/foods.json`, `/data/recipes.json`, `/data/routines.json`. Cache `brio-v4.2`. Tras el primer install, los tres JSON están en precache.

Recharts: `React.lazy` + `Suspense` en las cards de `trends.tsx`. Skeleton con las mismas alturas (`h-56` peso, `h-48` kcal, `h-44` el resto). Series real/trend/goal/band/ma7 intactas. El loader de `/tendencias` prefetcha el chunk de charts (el router ya tiene `defaultPreload: "intent"`).

Hoy: se quitó el `import { RECIPE_BY_ID }` estático. `QuickAddStrip`, `FoodLogSheet` y sugerencias de recetas van con `lazy()` + Suspense. No se ha cambiado el montaje `{foodOpen ? …}` de las otras sheets (agua/pasos/sueño/entreno/peso/racha).

## Cómo se midió

Mismo criterio que `docs/baseline.md`: `npm run build` (Vite 6.4.3), bytes disco = `stat`, gzip = `zlib.gzipSync`. Catálogo: ids y nombres de `foods.json` / `recipes.json` buscados en los JS que referencia `dist/index.html`. Nombres entre comillas (no substrings tipo `Col` dentro de `color`).

Lighthouse 12.6.1, Chrome headless-shell 151, mobile, `throttling-method=simulate`, `http://127.0.0.1:4175/`.

Calidad: `npm test` (81), `npm run typecheck`, `npm run lint`, `npm run build` — verdes.

## Tabla — JS de arranque

Carga inicial en `dist/index.html`:

- `index-BnB2Z9W1.js` (script)
- `react-vendor-CEDpW-Gg.js` (modulepreload)
- `router-vendor-_3H3I-rZ.js` (modulepreload)

| archivo | bytes disco | gzip | kB Vite | gzip kB |
|---|---:|---:|---:|---:|
| **router-vendor-_3H3I-rZ.js** | **82117** | **28495** | **82.12** | **28.50** |
| **index-BnB2Z9W1.js (app start)** | **113074** | **36239** | **113.07** | **36.24** |
| **react-vendor-CEDpW-Gg.js** | **194398** | **60781** | **194.40** | **60.78** |
| trends-charts-Cn4blf2y.js (lazy) | 420016 | 113101 | 420.02 | 113.10 |

**JS inicial (suma de lo que referencia `index.html`): 389589 B disco / 125515 B gzip**  
(113074 + 194398 + 82117) / (36239 + 60781 + 28495).

Catálogo en el start (react-vendor + router-vendor + app index):

| | tras 1.5 | CARGA |
|---|---:|---:|
| foods (nombres quoted, primeros 60) | 60/60 (de hecho 719/719) | **0/60** (0/719 quoted; el literal UI `"Agua"` no es el JSON) |
| recipes (nombres quoted, primeros 40) | 40/40 (211/211) | **0/40** (0/211) |
| food ids / recipe ids | 719 / 211 | **0 / 0** |

Los JSON viven en `/data/*.json` (130157 + 118655 + 15240 B) y se fetchean tras el primer paint.

## Lighthouse (mobile, throttling simulate)

Corrida con `benchmarkIndex` 2622.5 (partida Fase 1: 2607.5):

| | FCP | LCP | TBT | TTI (`interactive`) | Speed Index | perf | benchmarkIndex |
|---|---|---|---|---|---|---:|---:|
| tras 1.5 | **3.2 s** (3189 ms) | 3.4 s | 20 ms | **3.4 s** (3416 ms) | 3.2 s | 0.85 | 2607.5 |
| CARGA | **3.0 s** (2971 ms) | 3.1 s (3122 ms) | 0 ms | **3.1 s** (3122 ms) | 3.0 s | 0.88 | 2622.5 |

Segunda corrida (CPU más holgada, `benchmarkIndex` 2719.5): FCP 3.0 s / TTI 3.3 s / TBT 30 ms. No usar ese TBT como victoria.

## Resumen vs partida Fase 1

| métrica | tras 1.5 | CARGA | delta |
|---|---:|---:|---:|
| JS start disco | 661306 | **389589** | −271717 |
| JS start gzip | 179499 | **125515** | **−53984** |
| chunk app | 384791 / 90223 | **113074 / 36239** | −271717 / −53984 |
| foods/recipes en start | 719/719 y 211/211 | **0 y 0** | |
| FCP mobile simulate | 3.2 s | **3.0 s** | −0.2 s |
| TTI mobile simulate | 3.4 s | **3.1 s** | −0.3 s |
