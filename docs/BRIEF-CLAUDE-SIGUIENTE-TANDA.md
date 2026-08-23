# Brief para Claude — siguiente tanda de Brío

> De Grok, 2026-08-23. Rama: `docs/brief-claude-siguiente-tanda`.
> Léelo entero antes de tocar código. Empieza por §2 (bugs P0). No reimplementes lo que ya existe (§1).

Repo: https://github.com/alvarodesigns34/APP-
App: **Brío** (PWA de salud/fitness, 100 % cliente, datos en el dispositivo, español).
HEAD reciente: `main` (commits hasta ~2026-08-23, PRs #30–#56).

Este documento es una revisión del repo entero. Úsalo como encargo. No es un dump de ideas: está priorizado, con archivos concretos, y con lo que **no** debes rehacer.

---

## 0. Cómo trabajar (obligatorio)

- Offline-first, sin cuentas, sin backend, sin `localStorage` de datos personales en un servidor. No añadas auth, sync en la nube, ni IA que envíe comidas a un API de pago.
- Español de España en toda la UI. Números con `nf()`. Plurales con `plural()`.
- Cada decisión de producto que no sea obvia va en un test, como ya hace el repo (`weightTrend` vs cambio de hora, `mergeQty`, `macroGoalsFor`, `weightExtra` debería haber tenido uno).
- Verifica en navegador real los flujos que toques. Los tests no ven z-index, teclado, ni cámara.
- Commits en español, con el *por qué*, no el *qué*. El estilo de `048f813` / `230972d` es el listón.
- No gold-plating. Tres líneas iguales > abstracción prematura. No refactorices pantallas enteras «de paso».
- `npm test`, `npm run typecheck`, `npm run lint` verdes. Si tocas persistencia, cubre migrate/undo.
- Sube `APP_VERSION` en `src/lib/brio/types.ts` **y** el nombre de caché en `public/sw.js` juntos cuando el cambio afecte a usuarios ya instalados. Hoy están desfasados (app `4.1.0`, SW `brio-v4.5`).
- No toques `public/__grok/` ni nada de Grok App Builder: este repo no es ese sandbox.

---

## 1. Qué es Brío hoy (para no redescubrirlo)

SPA Vite + TanStack Router + Zustand + Tailwind v4. PWA en GitHub Pages bajo `/APP-/`.

Pantallas: Hoy, Comida, Actividad, Tendencias, Ajustes.

Ya existe y está bien hecho — **no lo reimplementes**:

| Área | Qué hay |
|---|---|
| Nutrición | 719 alimentos, 211 recetas, alimentos/recetas propias, barcode → Open Food Facts, despensa, lista de la compra con pasillos y merge de cantidades, modo cocina + wake lock, copiar día/comida, habituales, quick-add, planificación a 7 días |
| Macros | kcal/prot/carb/fat/fib, presets, plan lun–dom, suelo kcal por sexo, `activityAdjust` con aviso de doble conteo |
| Cuerpo | peso, grasa, músculo, cintura/pecho/cadera/brazo/muslo, índice cintura/altura, tendencia kg/semana DST-safe |
| Movimiento | pasos (manual), entrenos por deporte+min+intensidad MET, 12 rutinas de plantilla, temporizador de descanso absoluto, historial, volumen 14 días |
| Hábitos | agua, sueño, ayuno con hora de inicio, racha, 17 logros derivados (no persistidos), recordatorios, recap semanal y mensual |
| Datos | backup JSON con preview, CSV (inyección de fórmulas sanitizada), undo con panel en Ajustes, migrate defensivo |
| App | tema claro/oscuro/auto sin flash de página, 8 acentos con tests de contraste, PWA + SW + shortcuts, hotkeys, i18n de formato es-ES |

La nutrición y el pulido de producto van **muy por delante** del entrenamiento. El hueco grande no es «otra gráfica de calorías».

---

## 2. Bugs reales (hazlos primero)

### P0 — Deshacer un pesaje tira las medidas corporales

`src/lib/brio/store.ts` → `weightExtra()`:

```ts
function weightExtra(w: WeightEntry): { fat?: number; muscle?: number } | undefined {
  if (w.fat == null && w.muscle == null) return undefined;
  return { fat: w.fat, muscle: w.muscle };
}
```

`upsertWeight` / `deleteWeight` restauran el undo con eso. `MEASURES` (waist, chest, hip, arm, thigh) se añadieron después y **no entran**. Quien apunta cintura, guarda, y deshace/rehace, pierde la cinta.

Arreglo: `weightExtra` debe copiar `fat`, `muscle` y todas las `MeasureId`. Derívalo de `MEASURES` para no volver a olvidar una. Test que deje un pesaje con cintura, haga undo del delete, y compruebe que `waist` sigue ahí.

### P0 — El escáner de barras no funciona en iPhone

`food-log.tsx` + `barcode.ts`: cámara en vivo y foto exigen `BarcodeDetector`. En Safari iOS no está. El fallback es «escribe el EAN a mano». En el móvil objetivo de una PWA de comida, el botón de escanear es humo.

Haz un fallback WASM (`@zxing/browser` o similar) cuando `hasBarcodeDetector()` sea false:

- cámara en vivo si hay `getUserMedia`
- lectura de foto del carrete (el `<input type="file">` ya existe)
- el camino BarcodeDetector nativo se queda para Chromium, que es más rápido

Lazy-load de la librería: no la metas en el chunk inicial. Testea `detectBarcodeFromImage` con un fixture, no solo el detector nativo.

### P1 — `theme-color` del chrome sigue en verde al arrancar

`index.html` tiene `<meta name="theme-color" content="#2F6F4E" />`. El script inline aplica clase `dark` y `data-accent`, pero **no** toca el meta. `AppShell.applyTheme` lo corrige después de hidratar. En iOS, la barra de estado parpadea verde (o verde-claro sobre tema oscuro) en cada cold start. El script inline debe leer `--brio-bg` resuelto — o, más simple, escribir crema `#f4f1ea` / oscuro según `pref` — igual que el manifest.

### P1 — Versión de producto vs caché del SW

- `APP_VERSION` = `"4.1.0"` en `types.ts` y `package.json`
- SW cache = `brio-v4.5`
- README sigue en «v4.1» y no menciona medidas, logros, recap mensual, modo cocina, color elegible, lista de la compra de verdad

Alinea versión (sugiero `4.6.0` o el siguiente semver que toque), README, y `CACHE`. Un usuario con la PWA instalada no ve features nuevas si olvidas subir el nombre de caché; un README mentiroso hace que el siguiente agente reimplemente lo que ya hay.

### P1 — JSON del catálogo duplicado

`src/data/{foods,recipes,routines}.json` y `public/data/` son copias byte-idénticas a mano. `catalog.ts` fetchea `/data/*`. Si alguien edita solo `src/data`, el build de Pages sirve el público y se desincroniza.

Una sola fuente: o bien el build copia `src/data` → `dist/data` (y dejas de commitear `public/data`), o un test `cmp` que falle si divergen. No dejes las dos como verdad.

### P2 — No se puede editar un entreno ya registrado

Hay `addWorkout` / `removeWorkout` / `restoreWorkout`. No hay `updateWorkout`. Corregir minutos o intensidad obliga a borrar y crear otro, y se pierde el sitio en el historial. Añade edición desde la fila del día (misma hoja, con undo).

### P2 — Azúcar, saturada y sodio se guardan y no se ven en el día

`MealEntry` lleva `sug` / `sat` / `sod`. `dayFoodTotals` solo suma kcal/prot/carb/fat/fib. En la ficha del alimento sí salen. Quien registra un ultraprocesado no ve el sodio del día en ningún sitio.

Suma los tres (tratando `null` como «no aporta», no como 0) y muéstralos en Hoy o en Comida como línea secundaria, no como un quinto anillo. Sin objetivo de sodio de momento — un número suelto ya vale; un aro más es ruido.

---

## 3. Deuda técnica (después de los P0, o en el mismo PR si tocas esos archivos)

1. **`TodayScreen` / `ActivityScreen` / `FoodScreen` se suscriben a un slice enorme** (`days`, `weights`, `customFoods`, `recipes`, `pantry`, `favorites`…). Tachar un ítem de la compra no debería, pero un vaso de agua sí repinta Hoy entero. Usa `useShallow` sobre lo que la pantalla lee de verdad, o selectores por `viewDate`. `SelectorState` ya existe para esto.

2. **God files.** No los reescribas enteros; pártelos solo si vas a tocarlos:
   - `food-log.tsx` (~28 kB) — el escáner puede ser `barcode-sheet.tsx`
   - `settings.tsx` (~29 kB) — bloques Apariencia / Perfil / Objetivos / Recordatorios / Datos
   - `store.ts` (~25 kB) — acciones de shopping y de recetas propias pueden vivir al lado

3. **`localStorage` no escala.** Un año de comidas + agua + entrenos en un JSON único. `saveState` ya avisa si falla, pero no hay compactación, ni IndexedDB, ni recorte de días viejos. Cuando toques persistencia:
   - no cambies el formato a la ligera (schema 4, migrate ya es denso)
   - si pasas a IndexedDB, el JSON de backup tiene que seguir importando/exportando igual
   - un aviso en Ajustes cuando el blob pase de ~2 MB («exporta una copia») es barato y útil

4. **Recharts ~420 kB** en Tendencias, ya lazy. No lo sustituyas en esta tanda salvo que sobre tiempo. Si lo haces, las series (real / ma7 / meta / banda) tienen que quedar iguales; hay tests de dominio, no de SVG.

5. **Pantallas de Actividad montan 7 sheets siempre.** Hoy las monta on-demand. Unifica al patrón de Hoy cuando toques Actividad.

6. **No hay tests E2E.** Vitest cubre dominio. Los bugs de z-index, campos numéricos y barcode se colaron porque nadie recorrió el flujo. Un Playwright mínimo (onboarding → registrar comida → ver kcal en Hoy → backup preview) evitaría regresiones de producto. Solo si el resto de P0 está hecho.

7. **`toggleFavorite` / `toggleFavRecipe` / `togglePantry` no tienen undo.** Menor. Si tocas el store, añádelo con el mismo `recordUndo`.

---

## 4. Funciones nuevas — por orden

Haz **una tanda coherente**, no las doce. Lo marcado como «esta tanda» es lo que más mueve el producto ahora. Lo demás es backlog explícito para no inventar alcance.

### Esta tanda (después de los bugs)

#### A. Entrenamiento de verdad, no solo «45 min de pesas»

Hoy `WorkoutEntry` es `{ type, min, intensity, kcal }`. Las 12 rutinas son texto: «Registrar sesión» apunta un bloque MET y se acaba. No hay series, kilos, ni progreso.

Modelo mínimo (no un Strong/Hevy completo):

```ts
type WorkoutSet = { reps: number; kg: number | null; done: boolean };
type WorkoutExercise = { name: string; sets: WorkoutSet[] };
type WorkoutEntry = {
  id: string;
  type: string;          // deporte / rutina
  min: number;
  intensity: IntensityId;
  kcal: number;
  exercises?: WorkoutExercise[];  // opcional: los entrenos viejos siguen válidos
};
```

Comportamiento:

- Desde una rutina, «Empezar sesión» abre un flujo: ejercicios de esa sesión, sets con reps/kg, rest timer que ya existe, wake lock que ya existe, al terminar se guarda el `WorkoutEntry` con los ejercicios y los minutos reales.
- «Registrar rápido» (lo de ahora) se queda para un cardio o un partido.
- Historial de un ejercicio: últimas cargas, para no ir a ciegas. Una línea «la última vez: 4×8 a 40 kg» al abrir el set.
- migrate: entradas sin `exercises` son válidas.
- Undo de la sesión completa, no set a set.
- No hace falta crear rutinas propias todavía si el flujo de las 12 plantillas + un «entreno libre» (añadir ejercicios a mano) cubre el 90 %.

Esto es el salto de producto que la nutrición ya dio y el movimiento no.

#### B. Búsqueda de Open Food Facts por nombre

El catálogo son 719 alimentos. En un súper español la mayoría de lo que compras no está. El barcode cubre paquetes **si el escáner funciona**. Falta buscar «yogur natural hacendado» contra OFF (`https://world.openfoodfacts.org/cgi/search.pl` o v2 search), mapear con `mapOffProduct` que ya tienes, y guardar como alimento propio.

- Solo cuando el usuario pulsa buscar (no en cada tecla contra OFF).
- Timeout como el de barcode (8 s). Offline → mensaje, no spinner eterno.
- Prefiere `product_name_es` (ya lo hace `mapOffProduct`).
- No cachees el catálogo mundial entero.

#### C. Aviso de copia de seguridad

Sin cuentas, el riesgo real es borrar el sitio / perder el teléfono. En Ajustes, si no se ha exportado en N días (p. ej. 14) y hay más de X días con comida, una tarjeta «Exporta una copia». Guardar `lastBackupAt` en settings al exportar JSON/CSV. No un modal cada arranque.

### Backlog (no esta tanda, para que no se te vaya la mano)

- Rutinas propias (crear/editar plantillas).
- Widget / live activity: no se puede bien en PWA. No lo finjas.
- HealthKit / Google Fit / Web Bluetooth de báscula: fuera de alcance web serio; un «importar CSV de pasos» sí sería coherente más adelante.
- Fotos de platos: pesa, no aporta kcal fiables sin modelo, y rompe el «nada sale del dispositivo» si usas un API.
- Plan semanal de menús automático.
- Cafeína, alcohol como módulo, ciclo menstrual, medicación.
- Multiperfil en el mismo dispositivo.
- i18n inglés.
- Sustituir Recharts.
- Periodic Background Sync para recordatorios con la PWA cerrada: soporte miserable, sobre todo iOS; el copy de Ajustes ya lo dice. No prometas lo que el navegador no hace.
- Red social / feed / amigos.

---

## 5. Mejoras de producto pequeñas (coge 3–4 si vas sobrado)

- **Atajo PWA de entreno** (`./actividad?entreno=1`), simétrico a comida/agua/peso.
- **Editar el vaso de agua del día** ya se puede quitar vaso a vaso; falta un «deshacer el último» visible en la hoja, no solo el toast global.
- **Comida: repetir el mismo desayuno de lunes a viernes** — `copyMeal` existe; un «aplicar a laborables» ahorra toques.
- **Hoy, el remaining negativo** («te has pasado 340 kcal») ya se ve; una frase según propósito (`perder` vs `ganar`) evita que un superávit intencionado se lea como fallo.
- **Filtro de alérgenos en recetas** (gluten, lactosa, frutos secos) a partir de ingredientes del catálogo. Los badges veg/veggie ya están. No inventes un campo nuevo en cada alimento si puedes derivarlo de `cat` + una lista corta de ids, igual que `NON_VEGAN_IDS` en `catalog.ts`.
- **Pasos: no hay podómetro.** Está bien que sean manuales. Un texto en la hoja («Brío no lee el sensor del teléfono; apúntalos al final del día») evita que parezca roto.
- **Onboarding: el skip deja sexo h, 175 cm, 70 kg.** Quien salta se encuentra un TDEE de hombre. O exige altura/peso mínimo, o deja los objetivos en 2200 sin pretender que son «suyos».
- **Nombre del repo `APP-` y Pages `/APP-/`.** No lo cambies en código salvo `base`; si el dueño renombra, `vite.config.ts` + `base-path.test.ts` son el contrato.

---

## 6. Orden de PRs sugerido

1. **Fix pack** (un PR): `weightExtra` + theme-color + versión/README/SW + test de divergencia del catálogo JSON. Sin features.
2. **Barcode iOS** (un PR): fallback ZXing lazy, foto y cámara, tests del mapper que ya tienes intactos.
3. **Entrenamiento con series** (un PR, el grande): modelo + migrate + UI de sesión + historial de carga + editar entreno. No mezcles nutrición aquí.
4. **OFF search por nombre** (un PR).
5. **Sodio/azúcar del día + aviso de backup** (un PR pequeño).

No abras el 3 hasta que 1 y 2 estén en `main`. El 3 toca `types`, `persist`, `store`, `routines`, `log-sheets`, `workout-history`: es el que más puede romper.

---

## 7. Archivos de entrada (mapa rápido)

```
src/lib/brio/types.ts          modelo
src/lib/brio/persist.ts        migrate, defaultState, saveState
src/lib/brio/store.ts          acciones + undo  ← weightExtra
src/lib/brio/domain.ts         Mifflin, MET, macros, fibra
src/lib/brio/selectors.ts      totales del día, racha, kcalGoalFor
src/lib/brio/barcode.ts        OFF + EAN
src/lib/brio/catalog.ts        fetch /data/*.json
src/components/brio/food-log.tsx
src/components/brio/log-sheets.tsx     agua/pasos/sueño/entreno/peso
src/components/brio/routines.tsx       plantillas + rest timer
src/components/screens/{today,food,activity,trends,settings}.tsx
public/sw.js                   CACHE + precache
index.html                     theme boot
docs/baseline.md, docs/carga.md
```

Contrato de producto ya escrito en comentarios del código: léelos antes de contradecirlos (doble conteo de actividad, medias del recap mensual, ayuno que cruza medianoche, etc.).

---

## 8. Criterio de «hecho»

- Los P0 no se pueden reproducir: undo de pesaje con cintura; escanear (o foto) en un contexto sin `BarcodeDetector`.
- Un entreno de una rutina se puede completar set a set y se ve al día siguiente con las cargas.
- `npm test && npm run typecheck && npm run lint && npm run build` verdes.
- README y `APP_VERSION` describen lo que la app hace de verdad.
