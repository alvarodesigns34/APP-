> Documento de trabajo para Claude. **No forma parte de la app.**
> Rama: `docs/prompt-claude-siguiente-ronda`. No mergear a `main`.
> Repo: https://github.com/alvarodesigns34/APP-

# Prompt para Claude — Brío, siguiente ronda

Repo: https://github.com/alvarodesigns34/APP-
HEAD que audité: f26b67a (Fix accent-blind recipe search, auto-update stale installs, polish search UI, #31).
Clona main, verifica cada fallo. Si un archivo ya no coincide, sigue el código real, no este texto.

Eres Claude. Tienes el repo. Grok no va a tocar nada. Tú arreglas, pules y añades. Trabajo 100 % en GitHub.

## Cómo trabajar (obligatorio)

- Un subagente = una rama = un PR. No mezcles un bug de lógica con una feature nueva.
- Ficheros sin solapar. Antes de escribir, publica una tabla Agente → ficheros. Si dos agentes necesitan el mismo archivo, van en serie.
- CI verde (npm test, typecheck, lint, build) antes de merge. Un PR por merge. No dejes PRs abiertos.
- Español de España, tuteo. Offline-first. Sin backend, sin auth, sin cuentas.
- No borres funciones que el usuario ya ve. No toques src/data/** (foods/recipes/routines JSON) salvo que un bug P0 lo exija y no haya arreglo en código.
- No inventes códigos de barras ni macros de alimentos. No “optimices” la búsqueda otra vez (ya es accent-blind, #31).
- Tests de verdad en la función pura, no snapshots de UI. Si cambias números (kcal, macros, undo), el test tiene que romper si alguien lo revierte.
- Al final: un informe único. Qué se mergeó (nº de PR), qué se midió, qué se dejó. Nada de “ahora va mejor” sin cifra o sin test.
- APP_VERSION en src/lib/brio/types.ts está en 4.1.0 y el SW en brio-v4.4. Súbela a 4.2.0 en el último PR de esta ronda y alinea el comentario si tocas el SW.

## Lo que ya está y NO debes rehacer

Calendario mensual, tendencias de macros, recordatorios locales, escalar recetas, búsquedas recientes, copiar un día, semana vs anterior, ficha de alimento, objetivos por día de entreno, atajos 1–5/N/?, barcode, undo Ctrl+Z, CSV, fuzzy search, PWA, gráfico de peso + MA7, despensa, ayuno, rachas, alimentos propios, activityAdjust.

---

# Parte A — Fallos (arreglar primero)

Severidad: P0 pérdida de datos / crash, P1 números o flujos rotos, P2 UX clara, P3 pulido.

### P1 — números y datos

1. Los macros no siguen al objetivo del día.
   kcalGoalFor en src/lib/brio/selectors.ts:60-68 sí aplica weekdayPlan + activityAdjust. Las barras de prot/HC/grasa en src/components/screens/today.tsx:231-249 siguen usando snap.goals.prot/carb/fat fijos. En un lunes de entreno el anillo dice ~2464 kcal y la proteína sigue en 138 g (el % ya no es el de Ajustes).
   Arreglo: macroGoalsFor(s, key) que reparta prot/carb/fat con settings.macroPct sobre las kcal de ese día (tras weekday, antes o después de activityAdjust: elige uno, documéntalo, test). Úsalo en Hoy, sugerencias (selectors-catalog.ts:10 remProt) y línea de meta de tendencias si el día concreto entra en la gráfica. Test: base 2200 / 25-45-30, lunes entreno, prot escala.

2. Hoy no dice que el objetivo ha cambiado.
   Con weekdayPlan.enabled el usuario no ve “Hoy es descanso · 1980 kcal” ni “Entreno · 2464 kcal”. El anillo simplemente “está raro”.
   Arreglo: una línea bajo los anillos en Hoy cuando el plan está activo. En Ajustes, preview de los 7 días (L→D), no solo lunes y domingo (settings.tsx:436-438).

3. activityAdjust + días de entreno se apilan.
   El lunes ya lleva base×1.12 y encima se suman las kcal del entreno y los pasos. Un día de gym puede disparar el objetivo sin que se entienda.
   Arreglo: no lo apagues. En Hoy y en Ajustes, desglose: “Base 2200 → entreno 2464 → actividad +320 → 2784”. Si el desglose no cabe, un tap en las kcal del anillo abre el desglose. Test del desglose, no de una política nueva inventada.

4. Copiar ayer duplica y no se deshace.
   copyDayMeals en src/lib/brio/store.ts:281-298 añade encima. Pulsar dos veces duplica el día. El botón «Copiar ayer» en food.tsx:110-111 no tiene Deshacer; «Copiar otro día» sí (food.tsx:304-311). copyDayMeals no usa recordUndo.
   Arreglo: recordUndo en el store (o el mismo patrón de ids que CopyOtherDaySheet) en los dos botones. Si el destino ya tiene comidas, confirma: “Añadir a lo de hoy” vs “Sustituir”. Test: copiar, undo, el día destino vuelve atrás.

5. Undo a medias.
   Tienen recordUndo: add/remove meal, water, workout, peso.
   No tienen: duplicateMeal, moveMeal, updateMeal, setSteps, setSleep, setNote, copyMeal/cloneMealEntries, toggle favorito/despensa.
   Duplicar en food.tsx:175 solo hace toast.success("Duplicado") sin acción.
   Arreglo: recordUndo en duplicate/move/updateMeal/copyMeal/setSteps/setSleep como mínimo. Test de duplicate+undo y move+undo.

6. «Última vez» de la ficha no es la última.
   lastLogged en src/lib/brio/food-detail.ts:53-74 recorre MEALS en orden desayuno→snack y se queda con la primera del día más reciente, no con la última comida de ese día. Si lo registraste en desayuno y cena, dice desayuno.
   Arreglo: dentro del día, recorre comidas y entradas en sentido inverso. Test con dos logs el mismo día.

7. La ficha no ve recetas del usuario.
   food-detail.tsx:26-28 solo pasa BASE_RECIPES. store.recipes (UserRecipe) existe y addUserRecipe está en el store (store.ts:489-492) sin ninguna UI.
   Arreglo (este PR de ficha): incluir recetas del usuario en “En recetas”. La UI de crear receta es la feature F1, otro agente.

8. Ficha solo desde el buscador.
   En Comida, el alimento ya registrado (food.tsx:155-169) solo abre editar cantidad. No hay ficha.
   Arreglo: acción «Ficha» junto a Duplicar/Mover, o tap-hold, sin romper el tap = editar.

9. Hojas anidadas al mismo z-index.
   Sheet usa z-50 overlay+content (src/components/ui/sheet.tsx:21-22). FoodDetailSheet se abre dentro de FoodLogSheet (food-log.tsx). Dos vaul a z-50: overlay, cierre y scroll se pisan.
   Arreglo: zIndex / nested en Sheet, o portal con z-60 en la ficha. Verificar que cerrar la ficha no cierra el registro, y que el fondo de la ficha tapa el log.

### P1 — deploy / fuentes (verificar en build Pages)

10. @font-face con ruta absoluta.
    src/styles.css usa url("/fonts/outfit-latin-wght.woff2"). El SW precachea ./fonts/… (bien). Vite base en Pages es /APP-/ (vite.config.ts:13). Un url("/fonts/…") en el CSS compilado no lleva el prefijo y en GitHub Pages las fuentes 404. index.html preload /fonts/… sí lo reescribe Vite; el CSS a menudo no.
    Arreglo: rutas relativas (../ o url("./fonts/…") desde public importado como asset). npm run build:pages y comprueba que el CSS de dist pide /APP-/fonts/… o un hash de Vite, nunca /fonts/… en la raíz del dominio.

### P2 — lógica y producto

11. «Esta semana» no es la semana laboral.
    week-compare.ts + trends.tsx usan rangeKeys(todayKey(), 7) (últimos 7 días). En español “esta semana vs. la anterior” es lunes–hoy vs. lunes–domingo pasados. Un sábado compara sáb-vie con los 7 días previos, no con la semana natural.
    Arreglo: semana lun–dom. Etiqueta “5–11 ago vs. 29 jul–4 ago”. Test un miércoles: this=lun–mié (3 días), prev=lun–dom anteriores (7). Las medias de kcal siguen siendo solo días con comida.

12. MealEntry no tiene hora.
    types.ts:82-89 vs WaterEntry.t. No se puede ordenar de verdad ni decir “lo registraste a las 14:12”.
    Arreglo: campo opcional t?: number (Date.now al añadir). migrate no rompe entradas viejas. La ficha y el diario pueden mostrar la hora si existe. No migres datos inventados.

13. Skip del onboarding.
    skipOnboarding (store.ts:142-145) deja perfil hombre 175 cm / 70 kg / 2200 kcal. finish() usa birth || "1995-01-01" para el BMR pero guarda birth: "" (onboarding.tsx:44, 67).
    Arreglo: skip pide confirmación (“usar valores de ejemplo”). Si no hay fecha, no finjas 1995 en silencio: o la pides o usas edad 30 y lo dices.

14. Recalcular TDEE es un botón escondido.
    upsertWeight no toca profile.weight ni goals. Cambiar actividad/propósito en Ajustes (settings.tsx:235, 249) no recalcula. Solo el botón Recalcular (settings.tsx:93).
    Arreglo: no auto-cambies las metas (el usuario puede haberlas editado a mano). Tras un peso nuevo o un cambio de propósito, un toast o banner: “Has marcado 72,4 kg. ¿Recalcular objetivos?”. Si las metas ya no coinciden con computeGoals, muéstralo.

15. Recordatorio de agua y tentempiés.
    Agua: primer disparo = 08:00 + intervalo (reminders.ts:112-118), no a las 08:00. Tentempiés no existe en MEAL_SLOTS.
    Arreglo: primer vaso a las 08:00 (o a peso/desayuno si quieres un solo “inicio del día”), luego cada N min. Slot opt-in de tentempiés. Test del primer fire a las 08:00.

16. CSV y Excel.
    csvEscape (export-csv.ts:67) no neutraliza =, +, -, @ al inicio. Un alimento propio =cmd|… es fórmula. App local, pero es barato. Prefijo '.

17. Versión visible.
    Ajustes enseña 4.1.0. SW brio-v4.4. Mentira para el usuario. Súbela cuando cierres la ronda.

### P3 — no bloquees la ronda por esto, pero sí si el agente de estética pasa por ahí

- Chips L–D de objetivos: h-10 min-w-10 = 40 px (settings.tsx:428). Mínimo 44.
- Vaso de agua: [glass, 200, 500] (log-sheets.tsx:80) duplica el botón si el vaso es 200.
- Lista de vasos no muestra la hora aunque WaterEntry.t existe.
- addCustomFood no tiene undo.
- Ayuda de atajos (?) no menciona agua/pasos. Si añades W agua y P peso, actualiza la ayuda. No robes teclas al escribir.

---

# Parte B — Lógica a mejorar (no son crashes, sí hacen la app más honesta)

1. Un solo sitio para “objetivo de hoy”. Hoy, Tendencias, sugerencias, racha (goalsMet) y recordatorios de comida deben leer las mismas funciones (kcalGoalFor, macroGoalsFor). Nada de snap.goals.kcal suelto para el día en curso.
2. Racha / calendario: goalsMet usa banda 85–115 % de kcal. Con weekday+actividad la banda se mueve: está bien si es a propósito. Añade un test con plan activo para un lunes vs un domingo.
3. Escalar receta vs registrar: recipe-browser.tsx registra scaled.grams con recipeAsFood (por 100 g). Comprueba con test de integración que 2 raciones ≠ 2× un bug de servingG. Si hay desfase de 1–2 kcal por redondeo, documenta; si hay desfase grande, arréglalo.
4. Despensa “Casi listas” (pantry-shop.tsx:33-40) recorre todas las recetas builtin en cada render. Barato hoy (211); si tocas el archivo, useMemo sobre ids de despensa está bien. No hagas un índice nuevo sin necesidad.
5. Backup: brio.search-prefs y brio.reminders.fired están en AUX_STORE_KEYS (se borran al reset). El JSON exportado no lleva las búsquedas recientes. Decídelo: o las metes en el backup o un texto en Ajustes “las búsquedas no se exportan”. No dejes el silencio.

---

# Parte C — Estética y pulido

Hazlo después de A, o en paralelo si no tocas los mismos ficheros.

Objetivo: que se sienta un producto, no un panel de componentes. Referencia: la app ya usa Fraunces en títulos, Outfit en UI, radio 2xl, color --brio-primary verde.

1. Onboarding. 3–4 pantallas con un solo foco cada una (nombre → cuerpo → ritmo → metas calculadas grandes). Anillos de muestra con las metas reales. “Saltar” menos visible que “Empezar”. Nada de inglés.
2. Hoy. Jerarquía: saludo + fecha, anillos, kcal restantes en un número grande, luego registro rápido. Si weekdayPlan está on, chip “Entreno” / “Descanso”. El bloque “Resumen” de barras no debe parecer un segundo dashboard: más aire, labels enteros (“Proteína”, no “Prot” si cabe).
3. Comida. Cada comida como tarjeta, total de la comida a la derecha del título. Acciones Duplicar/Mover/Quitar en un overflow ⋯ si hay más de 2, para no llenar de chips. Estado vacío de una comida: una línea, no tres botones apilados.
4. Tendencias. Comparativa semana vs semana como 4 mini-tarjetas (kcal / prot / pasos / ejercicio) con delta en verde/rojo neutro (el rojo no significa “mal” en kcal si está perdiendo grasa: usa un color de delta, no --brio-bad, o flecha sin moralina). Gráficas: no toques Recharts lazy.
5. Ajustes. Agrupa Perfil / Metas / Plan semanal / Recordatorios / Datos. El plan semanal con los 7 números visibles. Peligro (borrar, importar) al final, en tono destructivo.
6. Hojas (vaul). Más padding inferior safe-area, título + una línea de contexto, CTA primario a ancho. Ficha de alimento: la barra de split energético con leyenda de color (prot / HC / grasa), no tres grises.
7. Oscuro. Revisa --brio-* para contraste de muted-foreground sobre card. Los chips bg-muted en oscuro no pueden perder el borde.
8. Vacío. Tendencias sin datos ya tiene Empty. Actividad sin entrenos está bien. Comida en un día futuro: “Nada previsto” en vez de “Añadir a comida” agresivo… o déjalo si el usuario planifica. Sé consistente.
9. Microcopy. Unifica “Tentempiés” (MEALS) vs “snack” interno. Nada de “log”, “sheet”, “OK”. Toasts cortos: “Copiado · Deshacer”.

No rediseñes el sistema de color. No cambies la fuente. No añadas librerías de UI nuevas.

---

# Parte D — Funciones nuevas (cliente, sin servidor)

Prioridad: las que apoyan lo que ya hay. Una feature por agente/PR.

F1. Crear receta propia (el store ya existe).
UserRecipe + addUserRecipe están muertos. UI: Comida → Recetas → “Nueva receta”. Nombre, raciones, añadir alimentos del catálogo con gramos, pasos opcionales. Guardar. Que salgan en el buscador de recetas y como alimento cat: receta. Editar / borrar. Undo al borrar. No pidas foto.

F2. Plato guardado (plantilla de una comida).
Desde una comida con ≥2 alimentos: “Guardar como plato”. Lista simple en el store (nuevo array, migrate). Un tap la vuelve a meter. No es una receta con pasos; es un macro-duplicar. Distinto de F1.

F3. Lista de la compra por pasillo.
La hoja de compra ya existe. Agrupa por CATEGORIES, checkbox que no borra despensa hasta “Pasar a despensa”. Partir de recetas favoritas o de un plato F2. Persistencia en brio.v4 (no otra clave suelta, o si usas una, métela en AUX_STORE_KEYS y en el reset).

F4. Fibra / azúcar / sodio del día.
Los MealEntry ya traen fib/sug/sat/sod. En Hoy, bajo las macros, 3 números. Si sug/sat/sod es null en muchos alimentos, no finjas un total: “Sodio: — (faltan datos)”. Test de suma ignorando null.

F5. Modo cocina.
En el detalle de receta, “Cocinar”: pasos a pantalla completa, números grandes, ingredientes ya escalados, “Siguiente”. No bloquea el apagado de pantalla si navigator.wakeLock existe; si no, no pidas permisos raros. Atrás vuelve al detalle.

F6. Recalcular metas desde el peso (banner).
Ver A.14. Feature + arreglo. Un solo agente.

F7. Comparar dos alimentos.
Desde la ficha: “Comparar”. Elegir otro. Tabla por 100 g y por ración habitual (lastPortion / primera unidad). No más de dos.

F8. Semana natural en Tendencias.
Ver A.11. Mismo agente que el fix de week-compare.

No hagas: red social, login, sincronizar con Apple Salud/Google Fit, recetas con IA, anuncios, paywall, inglés.

---

# Parte E — Reparto en subagentes

Publica esta tabla antes de codear. Ajústala si el HEAD cambió. Serie donde hay conflicto.

Orden | Agente | Qué | Ficheros (aprox.) | No tocar
1 | METAS | A.1, A.2, A.3, B.1, B.2 | weekday-goals.ts, selectors.ts, selectors-catalog.ts, today.tsx, settings.tsx (preview 7 días), tests | food-log, store undo, trends
1 | UNDO | A.4, A.5 | store.ts, food.tsx (toasts copiar/duplicar), undo tests | today.tsx, settings
1 | FICHA | A.6, A.7, A.8, A.9 | food-detail.ts(x), food-log.tsx, food.tsx solo si UNDO aún no lo tiene — si UNDO pisa food.tsx, FICHA espera | store mutations
1 | PAGES | A.10 fuentes/base | styles.css, index.html si hace falta, test o script que falle si el CSS Pages apunta a /fonts/ | runtime de negocio
2 | SEMANA | A.11 + F8 | week-compare.ts, trends.tsx | today
2 | DATOS | A.12 hora en MealEntry, A.16 CSV, migrate | types.ts, persist.ts, export-csv.ts, store.addMeal | pantallas grandes
2 | AVISOS | A.15 | reminders.ts, reminders-boot.tsx, settings.tsx solo si METAS ya mergeó | today
3 | ONBOARD | A.13 + C.1 | onboarding.tsx | store salvo skip copy
3 | ESTETICA | C.2–C.9 | pantallas que queden libres tras METAS/FICHA/SEMANA | no reescribir lógica
3 | F6 | A.14 + F6 banner peso | log-sheets.tsx peso, settings.tsx si está libre, componente banner |
4 | F1 receta propia | nuevo recipe-editor.tsx, recipe-browser.tsx, store ya tiene add | no catalog JSON
4 | F2 platos | store + food.tsx / meals |
4 | F3 compra | pantry-shop.tsx |
4 | F4 fibra/azúcar/sodio | today.tsx (después de METAS y ESTETICA) |
4 | F5 modo cocina | recipe-browser.tsx (después de F1 si F1 lo toca) |
4 | F7 comparar | food-detail.tsx (después de FICHA) |
último | VERSION | APP_VERSION 4.2.0 | types.ts |

Si dos agentes quieren food.tsx o today.tsx o settings.tsx, el segundo espera al merge del primero. No resuelvas conflictos a ciegas.

Tras cada merge: main limpio, 0 PRs abiertos, tests subiendo no bajando.

---

# Parte F — Informe final (un solo mensaje)

- Tabla PR → qué
- Tests: de cuántos a cuántos
- Fuentes en Pages: evidencia (ruta en dist)
- Metas del día: un ejemplo numérico lunes vs domingo con activityAdjust on/off
- Qué no hiciste y por qué
- Nada pendiente disfrazado de “futuro”

Empieza ahora: clona, confirma HEAD, publica la tabla de agentes, lanza la oleada 1 (METAS, UNDO, FICHA, PAGES).

---

# Suplemento de auditoría (añadir al prompt)

HEAD verificado: f26b67a. Extrae esto en la oleada 1, no lo dejes para estética.

## Más P1 (código, no opiniones)

13. Manifest de PWA roto en GitHub Pages.
    public/manifest.webmanifest: start_url: "/" e iconos "/icon-192.png". Vite no reescribe el manifest. En Pages la app vive en /APP-/. Instalarla abre user.github.io/, no Brío.
    Arreglo: start_url: "./", iconos relativos ./icon-192.png, ./icon-512.png, ./icon-180.png. Test que falle si el manifest mergeado a main tiene start_url absoluto /. Agente PAGES.

14. SW sin el JS hasheado.
    public/sw.js PRECACHE: HTML, fuentes, JSON, iconos. Cero assets/index-HASH.js. Cache-first del resto. Primera visita + refresh offline puede ser HTML cacheado + chunk 404 → pantalla blanca.
    Arreglo: o inyectas los hashes del build en el SW (plugin / import.meta no vale: el SW es estático), o network-first para *.js/*.css con fallback al shell, o precache del manifest de Vite (vite-plugin-pwa solo si no reescribes la app). No auto-reload silencioso: toast “Nueva versión → Recargar” (main.tsx:31-38 mata hojas abiertas). Test del SW de navegación y de controllerchange (el commit #31 lo prometió y no hay test de main.tsx). Agente PAGES.

15. Vaul anidado de verdad está roto.
    Todas las hojas z-50 (sheet.tsx:21-25). FoodLogSheet monta tres Drawer.Root hermanos (scan, crear, ficha) y traga el onOpenChange del padre (food-log.tsx:276-277, 531-554). RecipeBrowser desmonta la lista y monta el detalle ya abierto (recipe-browser.tsx:48-61) → la animación no existe y el overlay se queda. Hoy monta el log ya abierto (today.tsx:81-94, 293-296) → vaul no ve false→true.
    Arreglo: una sola Drawer.Root por flujo; ficha/detalle/escáner = vista interna, no otro drawer. Montar con open={false} y abrir en el siguiente frame. z-60 solo si no hay más remedio. Agente FICHA (log) + el que toque recipe-browser después. No dos agentes a la vez en sheet.tsx.

16. Preview de objetivos miente con el switch apagado.
    settings.tsx:436-438 llama kcalForWeekday aunque weekdayPlan.enabled sea false. El usuario ve lunes ≠ domingo sin haber activado nada. Hoy sí respeta enabled (selectors.ts:62-64).
    Arreglo: si !enabled, los 7 días = goals.kcal. Agente METAS.

17. Comparativa con esta semana vacía de comida.
    WeekCompareBlock solo trata la semana anterior vacía (trends.tsx:100, 110-111). Si hay pasos/peso, hasAny es true y salen 0 · 1850 · −100 % de kcal.
    Arreglo: si curr.foodDays===0, “Esta semana aún no tiene comidas”; no deltas de kcal/prot. Agente SEMANA.

18. Texto de receta vs raciones que registras.
    recipe-browser.tsx:192-214: subtítulo mezcla raciones de la receta con kcal ya escaladas. Eliges 1 ración de una receta de 4 y pone “4 raciones · 450 kcal” (450 es 1).
    Arreglo: “Receta para N · registras X raciones → Y kcal”. Chips: “Yo como…”. El que toque recipe-browser después de FICHA.

19. Importar JSON sin confirmar.
    settings.tsx:540-551 + store.ts:493-496: JSON.parse + importAll sustituye comidas, peso y ajustes, borra el undo, sin diálogo. Borrar datos sí tiene ConfirmDialog.
    Arreglo: el mismo confirm: “Esto sustituye comidas, peso y ajustes.” Agente UNDO o el de Ajustes cuando esté libre.

20. Omitir onboarding + Recalcular = edad 10.
    Skip solo pone onboarded: true (store.ts:142-145). birth: "". Recalcular hace ageFrom("")===0 → clamp 10 años (domain.ts:101, format.ts:35-37) y baja el TDEE.
    Arreglo: Recalcular sin fecha de nacimiento no calcula; pide la fecha. Skip no deje un perfil fantasma. Agente ONBOARD.

21. “Repetir el de ayer” ensucia el undo.
    food.tsx:84-86 deshace con removeMeal, que también hace recordUndo("Comida quitada"). Tormenta de toasts. Copiar otro día usa applyUndo bien.
    Arreglo: los undos de copia/repetir van por applyUndo, no por removeMeal crudo. Agente UNDO.

22. Chips de deporte < 44 px.
    log-sheets.tsx:261 py-1 text-xs ~24 px. routines.tsx:53 igual. Agente ESTETICA o el de Actividad si lo abres.

## Tests que faltan (obligatorios en el PR del arreglo, no un PR de “más tests”)

- recipesUsingFood contra BASE_RECIPES de verdad (p. ej. un foodId de public/data/recipes.json), no stubs.
- kcalGoalFor + macroGoalsFor lunes vs domingo, con y sin activityAdjust.
- Manifest start_url no es "/".
- copyDayMeals + undo; duplicateMeal + undo.
- Persist de save viejo: activityAdjust y fasting tienen default sano (hoy el spread crudo no los coerce, persist.ts:173).

## No hagas

- No instales vite-plugin-pwa si puedes parchear sw.js + manifest en 40 líneas.
- No reescribas el catálogo JSON.
- No toques la búsqueda accent-blind (#31).
- No auto-recalcules metas al pesar.

Oleada 1 sigue siendo: METAS, UNDO, FICHA, PAGES (PAGES ahora incluye manifest + SW + fuentes). SEMANA en oleada 2 con el empty-state. ONBOARD en oleada 3.

---

# Suplemento 2 — fallos extra (auditar y arreglar)

Verifica en main. Si ya está hecho, no lo reescribas.

## P1 nuevos

23. El toast «Deshacer» deshace otra cosa.
    recordUndo (store.ts:106-114) pone el toast a undoLast(). Añades A, añades B, pulsas Deshacer del toast de A → se deshace B.
    Arreglo: el toast llama a esa inversa (y la saca de la pila), no a undoLast(). Test: dos addMeal, toast del primero, queda B. Agente UNDO.

24. Dos pestañas se pisan el localStorage.
    No hay listener de storage. La pestaña B persist() borra lo de A.
    Arreglo: al evento storage de STORE_KEY, loadState() al store. No hace falta lock. Agente UNDO o uno PERSIST en serie con UNDO (store.ts + persist.ts).

25. activityAdjust se enciende solo al migrar.
    Default true (persist.ts:52). Un save viejo sin la clave hereda true y de pronto suma entrenos al TDEE.
    Arreglo: si la clave no existe, false. Solo true explícito. Test de migrate. Agente METAS o PERSIST.

26. Comidas/entrenos basura → NaN en los anillos.
    persist.ts:207-219 guarda cualquier objeto. sumEntries hace t.kcal += e.kcal → NaN. goals.kcal: null en el JSON: null + 300 === 300.
    Arreglo: parsear números; tirar filas inválidas; num() en cada meta. Test con {foo:1} y kcal: null. Agente PERSIST.

27. Kcal de la receta ≠ kcal registradas.
    El botón enseña scaleRecipe().macros. addMeal usa scaleMacros(recipeAsFood, scaled.grams) y servingG está redondeado a entero (catalog.ts:132). Si totalG % servings !== 0, el diario no coincide con el botón.
    Arreglo: registrar las macros de scaleRecipe (o gramos sin redondear totalG/servings * N). Test con una receta real cuyo totalG no sea múltiplo. El que toque recipe-browser después de FICHA.

28. Agua: lastFired.water no es por día.
    Comidas: ${day}:desayuno. Agua: un timestamp suelto. A las 08:00 del día siguiente el intervalo ya pasó → dispara en el arranque de la ventana, no a las 08:00+N.
    Arreglo: clave ${day}:water (o last sintético a las 08:00 cada día). Test: ayer a las 21:00, hoy 08:00, no dispares hasta el intervalo. Agente AVISOS.

29. Activar recordatorios a las 22:00 dispara desayuno+comida+cena.
    mins >= t y sin lastFired.
    Arreglo: al activar, marca como disparados los huecos ya pasados; o solo dispara en una ventana corta tras t. Agente AVISOS.

30. Vegetariano/vegano mal en recetas con caldo.
    catalog.ts solo excluye carne/pescado/lácteo + 4 ids. f943 caldo de pescado, f539 caldo de pollo, f818 gelatina: no están. rc147 Fideuá de marisco puede salir vegetariana.
    Arreglo en código (NON_VEGETARIAN_IDS / NON_VEGAN_IDS), no en el JSON de recetas. Test buildRecipe de rc147. Agente pequeño CATÁLOGO-FLAGS, solo catalog.ts + test. No toques foods.json/recipes.json.

31. updateMeal con 0 g deja macros viejas.
    e.grams ? scale : e (store.ts:196-210): 0 es falsy.
    Arreglo: si grams es 0, no escribas o usa food. Agente UNDO (mismo store.ts).

## P2 que no bloquean la oleada 1

- TDEE ya mete el factor de actividad (1.2–1.9) y activityAdjust vuelve a sumar el entreno. El desglose de A.3 debe decirlo. No cambies la fórmula a ciegas: o TDEE sedentario + logs, o factor sin logs. Elige una, test, copy en Ajustes.
- Suelo 1000 kcal del plan semanal vs kcalFloor 1200/1500. Usa el suelo del sexo.
- N en Actividad/Tendencias/Ajustes no hace nada. O navega a Comida y abre, o quítalo de la ayuda.
- En Comida, N abre siempre el hueco "comida", no slotForQuickAdd.
- Recetas: fuzzy como en alimentos (brocoi → brócoli). No rehacer #31; solo el mismo fuzzyMatch en search-recipes.ts.
- Custom foods escondidos hasta que carga el JSON builtin.
- Al activar avisos, no marques lastFired antes de que showNotification cumpla.
- No hay periodicsync en el SW: los avisos mueren si no hay pestaña. Dilo en Ajustes si no puedes un Periodic Sync real. No finjas un cron.

## Conflicto de ficheros (actualiza la tabla)

Extra | Quién | Archivos
23, 24, 31 | UNDO | store.ts, undo.ts, food.tsx
25, 26 | PERSIST (nuevo, oleada 1 después de UNDO si ambos tocan store/persist) | persist.ts, persist.test.ts
27, 18 | RECETA-LOG oleada 2 | recipe-browser.tsx, scale-recipe.ts
28, 29 | AVISOS oleada 2 | reminders.ts, reminders-boot.tsx
30 | CATÁLOGO-FLAGS oleada 1, aislado | catalog.ts, catalog.test.ts

persist.ts no lo toquen METAS y PERSIST a la vez. PERSIST mergea primero si UNDO no lo necesita.

Sigue sin tocar src/data/**. Oleada 1: METAS, UNDO, FICHA, PAGES, CATÁLOGO-FLAGS. PERSIST en serie con UNDO.
