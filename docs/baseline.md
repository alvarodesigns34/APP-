# Fase 0 — Baseline de Brío

Artefacto de aceptación. **Este PR no cambia runtime en `src/`.** Solo mide, documenta y aplica el punto 1.5 (`manualChunks` de vendor estable en `vite.config.ts`).

**Los números de partida que los agentes de Fase 1 deben batir son los de la tabla «tras 1.5 manualChunks»** (segunda tabla), no los de HEAD `8c461a7`. El split de vendor no reduce el JS inicial (sigue ~661 kB / ~179 kB gzip); Fase 1 tiene que bajar bytes del arranque (catálogo, fuentes, pantallas, recharts) de verdad.

HEAD medido: `8c461a7` (`Merge pull request #12 from alvarodesigns34/feat/barcode`).

---

## Cómo se midió

Clon limpio, `npm install`, `npm run build` (Vite 6.4.3).

```bash
git clone https://github.com/alvarodesigns34/APP- /tmp/brio-baseline
cd /tmp/brio-baseline
# HEAD 8c461a7
npm install
npm run build
```

Tamaños:

- **bytes disco** = `stat` del archivo en `dist/assets/`.
- **gzip** = `zlib.gzipSync` de Node (el mismo criterio que imprime Vite). `kB Vite` = bytes / 1000, 2 decimales.
- Catálogo embebido: se buscaron **los 719 ids de `foods.json` y los 211 ids de `recipes.json`** en cada `*.js` de `dist/assets`.
- Visualizer: `npm run analyze` (`ANALYZE=true vite build` + `scripts/bundle-summary.mjs`). Escribe `dist/stats.html` (treemap, no se commitea) y `docs/bundle-stats.txt`.

Lighthouse (sí se pudo medir):

```bash
npm run build && npm run preview -- --host 127.0.0.1 --port 4173
CHROME_PATH=/opt/pw-browsers/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell \
  npx lighthouse@12.6.1 http://127.0.0.1:4173 \
    --form-factor=mobile \
    --throttling-method=simulate \
    --chrome-flags="--headless --no-sandbox" \
    --only-categories=performance
```

No había `google-chrome` / `chromium` de sistema. Se usó **Chrome for Testing headless-shell 151.0.7922.34** (Playwright). Lighthouse **12.6.1**. En esta versión el audit `interactive` (TTI) sigue existiendo; también se reportan LCP y TBT. Se corrió **antes y después** de `manualChunks`. Las cifras oficiales son el par consecutivo con `benchmarkIndex` parecido (~2600), para no mezclar carga de CPU.

Calidad de este PR: `npm test` (78), `npm run typecheck`, `npm run lint`, `npm run build` — todos verdes.

---

## Tabla 1 — HEAD `8c461a7` (antes de este PR)

Carga inicial en `dist/index.html`: solo `index-X5PE6vRA.js` + `index-DY-DmR-y.css`. **Un único JS de arranque.**

| archivo | bytes disco | gzip | kB Vite | gzip kB |
|---|---:|---:|---:|---:|
| section-CdEhfw1W.js | 1066 | 470 | 1.07 | 0.47 |
| units-w6f7HaSF.js | 1666 | 717 | 1.67 | 0.72 |
| log-sheets-FTnPnvSL.js | 5731 | 2048 | 5.73 | 2.05 |
| comida-CvUsGij3.js | 10767 | 3738 | 10.77 | 3.74 |
| actividad-Dng0ZLL8.js | 11518 | 3638 | 11.52 | 3.64 |
| index-D0iQXhnL.js | 15783 | 5294 | 15.78 | 5.29 |
| ajustes-B6RU-wX5.js | 16854 | 6046 | 16.85 | 6.05 |
| recipe-browser-FMdV2dYu.js | 20775 | 6730 | 20.78 | 6.73 |
| sheet-DH2vms-K.js | 31528 | 9795 | 31.53 | 9.80 |
| index-BaBTzwiV.js | 39274 | 13244 | 39.27 | 13.24 |
| tendencias-COWn_8vI.js | 424869 | 114875 | 424.87 | 114.88 |
| **index-X5PE6vRA.js (start)** | **662388** | **179481** | **662.39** | **179.48** |

CSS inicial (no JS): `index-DY-DmR-y.css` 29694 B / gzip 6282 B (29.69 / 6.28 kB).

**JS inicial (start): 662388 B disco / 179481 B gzip.** Disco en KiB: 662388 / 1024 = **646.9 KiB**.

`vite.config.ts` no tenía `manualChunks`. Cero `lazy(`, `Suspense`, `import(` en `src/`. TanStack Router sí tiene `autoCodeSplitting: true` y `defaultPreload: "intent"`: las rutas `/comida`, `/actividad`, `/tendencias`, `/ajustes` y la pantalla de `/` salen en chunks propios, pero el catálogo **no**.

Identidad aproximada de chunks (no hace falta memorizarla):

- `index-X5PE6vRA.js` — entry (`main` + `AppShell` + `store` + **todo el catálogo** + lucide del shell).
- `index-D0iQXhnL.js` — ruta `/` (`TodayScreen`).
- `index-BaBTzwiV.js` — primitivos Radix compartidos.
- `tendencias-*.js` — Recharts (~425 kB). No se toca en este PR.
- `sheet-*`, `log-sheets-*`, `recipe-browser-*` — UI compartida, lazy respecto al start.

---

## Catálogo embebido en el chunk inicial

En `index-X5PE6vRA.js` (y, tras 1.5, en `index-DcNC132d.js`; **nunca** en los vendor):

| fuente | bytes JSON | items | presentes en el start |
|---|---:|---:|---|
| `src/data/foods.json` | 130157 | 719 | **719 / 719** (ids y nombres) |
| `src/data/recipes.json` | 118655 | 211 | **211 / 211** (ids y nombres) |
| `src/data/routines.json` | 15240 | 12 | embebido vía `catalog.ts` |

Una muestra 60/60 alimentos y 40/40 recetas también está entera; la cifra real es el catálogo completo, no un subconjunto.

JSON en disco (sin minificar, el bundle los incrusta ya procesados): 130157 + 118655 + 15240 = **263052 B** de datos de catálogo tirando del arranque.

---

## Grafo de imports que mete el catálogo en el start

Cadena que **no se code-splitea** (vive en el root / entry):

```
main.tsx
  → router.tsx          (defaultPreload: "intent")
    → routes/__root.tsx
      → AppShell
        → store.ts
          → catalog.ts  ← foods.json + recipes.json + routines.json
          → selectors.ts
            → catalog.ts
```

Cadenas extra (la ruta `/` está en su propio chunk, pero importan el mismo módulo `catalog`, que Rollup ya colocó en el start):

```
routes/index.tsx
  → today.tsx
      → RECIPE_BY_ID          ← catalog.ts
      → selectors.ts          ← catalog.ts
      → FoodLogSheet, QuickAddStrip, RecipeDetail   (estáticos)
```

`store.ts` importa `getFood` y `scaleMacros` de `catalog.ts`. `selectors.ts` importa `BASE_RECIPES`, `defaultServing`, `getFood`, `isPantryBasic`. Con que **una** de esas importaciones estáticas cuelgue del shell, el JSON entero viaja en el primer JS.

`catalog.ts` hace trabajo a nivel de módulo, en el arranque, antes de hidratar:

- `FOOD_BY_ID` — bucle sobre `BASE_FOODS`.
- `BASE_RECIPES = sources.map(buildRecipe)`.
- `RECIPE_FOODS` y se vuelven a meter en `FOOD_BY_ID`.
- `BUILTIN_INDEX = buildFoodIndex(...)`.

---

## Observaciones (reportadas, no corregidas en Fase 0)

- **`today.tsx`** monta 7 sheets como `{open ? <Sheet … open={true} /> : null}` (`FoodLog`, `Water`, `Steps`, `Sleep`, `Workout`, `Weight`, `Streak`). La nota del día sí queda montada siempre. `RecipeDetail` también es condicional.
- **`activity.tsx` ya las deja montadas** (`<StepsSheet open={steps} … />` etc., 7 sheets siempre en el árbol). No se unifica aquí.
- **`AppShell`**: `if (!hydrated) return <div className="min-h-dvh bg-background" aria-busy="true" />` — div vacío, sin skeleton. El `<main>` tiene `overflow-y-auto` (scroll interior).
- **`index.html`**: stylesheet bloqueante de Google Fonts (Fraunces + Outfit) con `preconnect` + `display=swap`. No se toca.
- **`styles.css`** importa `tw-animate-css`. Cero usos de `animate-in` / `fade-in` / `slide-in` / `zoom-in` en `src/`.
- Router: `defaultPreload: "intent"` ya está. Cero `lazy(` / `Suspense` / `import(` en `src/`.
- `vite.config.ts` original: sin `manualChunks`.

---

## Lighthouse (mobile, throttling simulate)

Chrome headless-shell 151 + Lighthouse 12.6.1. URL `http://127.0.0.1:4173/` (tras 1.5) y `:4174` (HEAD, mismo `dist` copiado). Par consecutivo:

| | FCP | LCP | TBT | TTI (`interactive`) | Speed Index | perf | benchmarkIndex |
|---|---|---|---|---|---|---:|---:|
| HEAD `8c461a7` | **3.3 s** (3342 ms) | 3.6 s (3569 ms) | 30 ms | **3.6 s** (3581 ms) | 3.3 s | 0.83 | 2673.5 |
| tras 1.5 | **3.2 s** (3189 ms) | 3.4 s (3416 ms) | 20 ms | **3.4 s** (3416 ms) | 3.2 s | 0.85 | 2607.5 |

Corridas previas (más ruido de CPU; `benchmarkIndex` 2227 vs 2619): HEAD FCP 3.3 s / TTI 3.9 s / TBT 180 ms; tras 1.5 FCP 3.1 s / TTI 3.3 s / TBT 40 ms. No usar ese delta de TBT como “victoria” de 1.5.

Interpretación: **1.5 no mejora de forma material FCP/TTI** (el JS inicial gzip sigue ~179 kB). El valor es cachear `react-vendor` y `router-vendor` entre deploys. Fase 1 tiene que bajar el start (catálogo, fuentes, trabajo síncrono de `catalog.ts`, sheets).

---

## Tabla 2 — tras 1.5 `manualChunks`

`manualChunks` en `vite.config.ts` **solo**:

- `react-vendor` ← `react` + `react-dom` + `scheduler`
- `router-vendor` ← `@tanstack/*` (se separa limpio)
- **El JSON de alimentos/recetas no entra en vendor** (sigue 719/719 y 211/211 en el chunk de app `index-DcNC132d.js`; 0/719 en ambos vendor).

No se cambiaron plugins existentes, alias ni Tailwind. `tanstackRouter({ autoCodeSplitting: true })` se mantiene. El plugin `visualizer` solo se inyecta si `ANALYZE=true`.

Carga inicial en `dist/index.html`:

- `index-DcNC132d.js` (script)
- `react-vendor-CEDpW-Gg.js` (modulepreload)
- `router-vendor-_3H3I-rZ.js` (modulepreload)
- `index-DY-DmR-y.css`

| archivo | bytes disco | gzip | kB Vite | gzip kB |
|---|---:|---:|---:|---:|
| section-BuD2iRzF.js | 1106 | 490 | 1.11 | 0.49 |
| units-CSP6Gcnu.js | 1705 | 739 | 1.71 | 0.74 |
| log-sheets-DVHhzw1_.js | 5766 | 2063 | 5.77 | 2.06 |
| comida-CsDOcmPM.js | 10838 | 3771 | 10.84 | 3.77 |
| actividad-BtOFKG8L.js | 11604 | 3679 | 11.60 | 3.68 |
| index-CCg0vhvZ.js | 15864 | 5329 | 15.86 | 5.33 |
| ajustes-BzG8PaJg.js | 16928 | 6081 | 16.93 | 6.08 |
| recipe-browser-Djlm9CX8.js | 20820 | 6750 | 20.82 | 6.75 |
| sheet-Cjbjj97r.js | 31567 | 9816 | 31.57 | 9.82 |
| index-BLmed83q.js | 39279 | 13244 | 39.28 | 13.24 |
| **router-vendor-_3H3I-rZ.js** | **82117** | **28495** | **82.12** | **28.50** |
| **react-vendor-CEDpW-Gg.js** | **194398** | **60781** | **194.40** | **60.78** |
| **index-DcNC132d.js (app start)** | **384791** | **90223** | **384.79** | **90.22** |
| tendencias-CkSJToZ_.js | 424942 | 114913 | 424.94 | 114.91 |

CSS: `index-DY-DmR-y.css` 29694 B / gzip 6282 B (igual).

**JS inicial (suma de lo que referencia `index.html`): 661306 B disco / 179499 B gzip**  
(384791 + 194398 + 82117) / (90223 + 60781 + 28495). Prácticamente el mismo total que HEAD (662388 / 179481). El chunk de app baja de 662 kB a 385 kB porque React y el router salieron; el catálogo sigue dentro.

Resumen compacto:

| métrica | HEAD `8c461a7` | tras 1.5 (partida Fase 1) |
|---|---:|---:|
| JS start disco | 662388 | **661306** (3 ficheros) |
| JS start gzip | 179481 | **179499** |
| chunk app (el del catálogo) | 662388 / 179481 | **384791 / 90223** |
| foods/recipes en start | 719/719 y 211/211 | **igual, y no están en vendor** |
| FCP mobile simulate | 3.3 s | 3.2 s |
| TTI mobile simulate | 3.6 s | 3.4 s |
| LCP / TBT | 3.6 s / 30 ms | 3.4 s / 20 ms |

### Estos son los números de partida que Fase 1 debe batir

Fase 1 gana si reduce **JS inicial gzip y/o FCP/TTI** respecto a **661306 B / 179499 B gzip, FCP 3.2 s, TTI 3.4 s**, sin meter el catálogo en un vendor eterno y sin romper tests. Sacar React a un chunk ya está hecho: no cuenta como victoria nueva.

---

## Claims del prompt que no cuadran del todo

| claim | medición |
|---|---|
| Disco del index «645 KB» | **662388 B = 646.9 KiB** (1024) = 662.39 kB Vite (1000). Misma pieza; 645 es redondeo. La verificación independiente decía 646.9 — coincide. |
| Gzip 179 | Coincide con Vite: **179.48 kB** (`gzipSync` 179481 B). |
| Muestra 60/60 foods y 40/40 recipes en el index | Cierto, y de hecho es **719/719 y 211/211**. |
| `tendencias` 424.87 kB / gzip 114.88 | Coincide en HEAD. Tras 1.5: 424.94 / 114.91 (el chunk ahora importa `react-vendor`; delta irrelevante). |

---

## Qué incluye este PR

- `rollup-plugin-visualizer` + script `npm run analyze` + `docs/bundle-stats.txt`.
- `docs/baseline.md` (este archivo).
- `manualChunks` de vendor estable en `vite.config.ts`.
- `.gitignore`: `stats.html` / `stats.json` por si se generan fuera de `dist/`.

No incluye: cambios en `src/`, `src/data/**`, borrado de features, “optimizar” catálogo / fuentes / recharts.
