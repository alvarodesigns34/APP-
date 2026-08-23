# Auditoría Grok — Brío v4.8

Revisión de código, no un brief ni una lista de tareas. Si algo aquí te parece ruido, ignóralo.

| | |
|---|---|
| Código leído | `claude/continuacion-trabajo-vgt3d4` @ `c794453` |
| Versión | `APP_VERSION` 4.8.0 · caché SW `brio-v4.8` |
| `main` | sigue en `bf0b221` (PR #56). Esta lectura es de tu rama, no de lo publicado. |
| Alcance | solo lectura. Este fichero vive en una rama `docs/` para no mezclarse con el código. |

La tanda anterior (el documento de `docs/brief-claude-siguiente-tanda`) ya la cerraste: `weightExtra` recorre `MEASURES`, el toast de deshacer recibe clics con una hoja abierta, ZXing cubre Safari, `theme-color` arranca en crema/oscuro, versión/SW/README van a la par, el test ata las dos copias del catálogo, `sug`/`sat`/`sod` suman el día sin convertir `null` en cero, hay `updateWorkout`, el precache lleva las cinco pantallas, el contraste AA está medido, la lista de la compra se edita y se comparte, las horas de comida se ven, `NumField` en macros, el panel de atajos es modal de verdad, las hojas no parpadean de z-index, Tendencias cruza medianoche. No los reabro.

Lo que sigue es lo que, leyendo el árbol actual, todavía se ve raro, a medias, o como sitio donde la app podría crecer.

---

## 1. Lo que más se nota al usarla

### 1.1 Deshacer un pesaje no devuelve el peso del perfil

`WeightSheet` hace dos escrituras seguidas:

```471:472:src/components/brio/log-sheets.tsx
            upsert(date, kg, Object.keys(extra).length > 0 ? extra : undefined);
            patchProfile({ weight: kg });
```

`upsertWeight` sí deja una entrada de deshacer, pero solo restaura `weights[]`. `patchProfile` no tiene deshacer. El toast dice «Deshecho» y el IMC de Ajustes, el recálculo de TDEE y el fallback de `kcalFromWorkout` siguen usando el kilo nuevo.

Borrar un pesaje es el simétrico: `deleteWeight` no toca `profile.weight`, así que el perfil puede quedar en un kilo que ya no está en la serie. Actividad lee `currentWeightKg` (último pesaje que queda); Ajustes lee `profile.weight`. Tras deshacer o borrar, las dos pantallas pueden mostrar un IMC distinto.

El comentario de `recalc()` en Ajustes lo dice en voz alta: *«every weigh-in writes profile.weight»*. No es un comentario viejo, es el contrato actual, y es justo por eso el deshacer se queda a medias.

Una vía, si te apetece: que el pesaje sea la fuente y `profile.weight` se derive (o que el deshacer del pesaje restaure también el perfil). No hace falta las dos.

### 1.2 «Omitir» deja un hombre de 175 cm / 70 kg con 2.200 kcal

`skipOnboarding` solo pone `onboarded: true`. El resto es `defaultState()`: sexo `h`, 175/70, actividad `lig`, propósito `mantener`, objetivos 2200/138/248/73. El botón está en el paso 0, antes de preguntar nada.

Encima, `defaultState().settings.activityAdjust` es `true` y el nivel por defecto es Ligero. Un usuario que omite el onboarding arranca con PAL 1,375 **y** con «sumar kcal de actividad» encendido. El aviso de Ajustes (*«tu nivel ya cuenta el movimiento habitual»*) nunca lo ve, porque no ha pasado por Ajustes.

La migración hace lo contrario a propósito: si un guardado viejo no trae la clave, `activityAdjust` pasa a `false` para no cambiarle las kcal en silencio. Usuarios nuevos y usuarios que vuelven no parten del mismo sitio.

### 1.3 Escanear un producto crea un alimento propio antes de registrar la comida

En `handleBarcode`, si Open Food Facts trae macros, se llama a `addCustomFood` en el acto y luego se selecciona. `addCustomFood` no tiene deshacer. Si cierras la hoja de comida sin pulsar Añadir, el alimento se queda en «Mis alimentos» para siempre.

El cancel de la consulta (el `lookupIdRef`) evita el fantasma *después* de cerrar; no evita el alta permanente *antes* de confirmar el registro.

### 1.4 Actividad deja registrar en un día futuro; Hoy dice que no

En Hoy, un día por delante solo ofrece planificar comidas, con este texto:

> Los pasos, el agua, el sueño y el peso solo se registran el día que pasan — pero puedes adelantar las comidas.

Actividad no mira `isFuture`. Con el mismo `viewDate` de mañana puedes guardar un entreno, un vaso, una noche o un pesaje. El pesaje de mañana, además, escribe `profile.weight` (punto 1.1).

---

## 2. El mismo `Number(null)` que ya cazaste, en dos sitios más

En comidas y entrenos el comentario es claro: `Number(null)` es 0 y 0 es finito, así que un hueco se volvía un dato. `parseFood` y `parseUserRecipe` todavía usan `Number` / `num()`:

```240:245:src/lib/brio/persist.ts
  const kcal = Number(v.kcal);
  const prot = Number(v.prot);
  const carb = Number(v.carb);
  const fat = Number(v.fat);
  const fib = Number(v.fib);
  if (![kcal, prot, carb, fat, fib].every(Number.isFinite)) return null;
```

```293:299:src/lib/brio/persist.ts
    per100: {
      kcal: num(per.kcal),
      prot: num(per.prot),
      carb: num(per.carb),
      fat: num(per.fat),
      fib: num(per.fib),
    },
```

Un alimento propio con `kcal: null` (backup editado, o un JSON de otra herramienta) entra como 0 kcal y se suma al día como si fuera un hecho. Una receta propia sin `per100` entra como 0/0/0/0/0 y parece válida. `parseUserRecipe` tampoco rechaza `items` vacío tras el filtro.

No lo produce la app en uso normal. Es el mismo borde que ya cubriste en comidas, y el test de persistencia de aquel arreglo no pasa por aquí.

---

## 3. Recetas propias y el día de azúcar / sodio

`MealEntry` ya lleva `sug`/`sat`/`sod` y Comida los enseña. Las recetas del catálogo los conservan vía `recipeAsFood` (`sug: r.per100.sug`, etc.). Las recetas propias no:

- `UserRecipe.per100` es `Pick<Macros, "kcal" | "prot" | "carb" | "fat" | "fib">`.
- `buildUserRecipe` solo suma esos cinco, aunque el ingrediente (un alimento propio venido de OFF, o uno del catálogo) sí traiga sodio.
- `getFood` / `ctxFoods` los rellenan a `null`.

Registrar «mis lentejas» borra el sodio y el azúcar del día. Registrar las lentejas del catálogo, no. El formulario de alimento propio tampoco tiene esos tres campos: los deja en `null` a mano. El camino del código de barras sí los guarda. Dos alimentos creados por ti, dos contratos.

---

## 4. Deshacer: la pasada de «siete formas» dejó tres de la misma familia

Restauraste comidas y alimentos propios *en su sitio* (`at`). Siguen empujando al final:

| Acción | Al deshacer |
|---|---|
| `restoreWorkout` | `d.workouts.push(entry)` |
| `deleteUserRecipe` | `recipes: [...st.recipes, removed]` |
| `removeShoppingItem` | `shopping: [...s.shopping, removed]` |

La lista del día y la de la compra se pintan en el orden del array. Quitar el primero de tres y deshacer lo manda al final: el toast dice deshecho y el orden no es el de antes. Es exactamente el fallo que documentaste en `restoreMeal`.

Y, al lado, acciones que nunca entran en la pila: `toggleFavorite`, `toggleFavRecipe`, `togglePantry`, `addCustomFood`, `addUserRecipe`, `addShoppingItem` (el de una línea; `addShoppingItems` sí deshace), `toggleShoppingItem`, `updateShoppingItem`, `patchProfile`. Acabas de conectar el lápiz de la lista: editar una cantidad no se puede deshacer.

No hace falta que todo tenga undo. Sí choca que «Deshacer» sea una promesa de la app y estas se queden fuera, sobre todo perfil y lista de la compra, que se tocan sin querer.

---

## 5. Números que no se ponen de acuerdo

### Fibra y el plan por días

`macroGoalsFor` escala prot/carb/fat con el mismo factor que las kcal del día. La barra de fibra en Hoy usa `g.fib` plano (`today.tsx`). `fiberGoalFor` es «14 g / 1.000 kcal, suelo 25». Con el plan encendido, un día de entreno pide más kcal y más proteína, y la misma fibra que un domingo. Las sugerencias de Hoy ya las alineaste con `macroGoalsFor`; la fibra se quedó.

### «Te has pasado»

```176:176:src/components/screens/today.tsx
              {remaining >= 0 ? "Te quedan" : "Te has pasado"}
```

`remaining` es contra `kcalGoalFor`, que ya incluye el superávit o el déficit del propósito. Pasarse del objetivo de volumen no es el mismo gesto que pasarse del de definición, y el texto no lo distingue. Es copia, no aritmética.

### `goalsMet` y la banda 85–115 %

La racha pide 3 de 5, y kcal es uno. La banda es simétrica: comer el 84 % de un objetivo de déficit (más déficit) falla igual que comer el 116 % de un objetivo de volumen (más superávit). Es explícita adhesión al número, no al propósito. En un corte real, kcal es el objetivo más fácil de «fallar» por abajo y la racha se apoya en agua/pasos/sueño. Puede ser lo que quieres; se lee raro al lado de «Te has pasado».

### CSV que Ajustes descarga

`weightsCsv` ya lleva cintura/pecho/cadera/brazo/muslo. `mealsCsv` no lleva azúcar/saturada/sodio. `combinedCsv` —el único botón de Ajustes— no lleva ni las medidas ni esos tres. `exportCsvBundle` (tres ficheros) está testeado y ninguna pantalla lo llama. El comentario de cuando quitaste código muerto lo dejaba explícito: no era muerto, era trabajo sin enchufar. La lista de la compra sí la enchufaste después; el bundle CSV no.

---

## 6. Rendimiento y montaje, todavía

Hoy y Actividad se suscriben al mismo `useShallow` gordo: `days`, `weights`, `customFoods`, `recipes`, `pantry`, `favorites`, `favRecipes`, `recents`, `schema`, `onboarded`. Actividad no usa recetas, despensa ni favoritos. Cualquier toggle de estrella re-renderiza Actividad.

Hoy monta la hoja de comida bajo demanda (`foodMounted`). Actividad monta siempre las siete: pasos, dos de entreno, agua, sueño, peso, rutinas, historial. Vaul + los efectos de foco de cada una, con la hoja cerrada.

No es un fallo de usuario. Es el mismo olor de siempre en estas dos pantallas, y el slice no se ha estrechado.

---

## 7. Cosas pequeñas que no cuadran

- **README v4.7** sigue diciendo «La app se actualiza sola cuando se publica una versión nueva». v4.8 cambió eso a un toast infinito con «Recargar». La sección v4.8 no lo menciona. Quien lea el README de arriba abajo se queda con la frase vieja.
- **Atajo PWA de entreno.** El manifiesto tiene comida, agua y peso. Entreno es el cuarto registro del día y no está. `/?entreno=1` encajaría con el patrón que ya tienes.
- **`mealForHour`.** 11–16 comida, 16–20 tentempié, cena a partir de las 20. El comentario explica bien por qué 21:00 ya no es snack (el aviso de cena es a las 21). 16:00–20:00 son cuatro horas de merienda: una cena de 19:30 (niños, turno temprano) cae en tentempié. No es un bug; es un horario fijo para un país donde la cena no es un solo número.
- **Pasos.** La hoja es un campo a mano. No hay una línea que diga que Brío no lee el podómetro. Quien viene de Google Fit / Salud tarda un segundo en buscar un botón que no existe.
- **Rutinas → «Registrar sesión».** Sigue siendo un bloque MET (`addWorkout(..., "fuerza", routine.minutes, intensity)`). Las 12 plantillas tienen series, descanso y el temporizador; al guardar se pierde todo eso. El modelo `WorkoutEntry` no tiene ejercicios.
- **`findFoodByBarcode`** solo mira `customFoods`. El catálogo embebido no lleva EAN, así que es coherente. Solo lo apunto para no reabrir un «el catálogo no resuelve códigos» que no es un fallo.
- **`docs/carga.md`** habla de caché `brio-v4.2`. El test de versión no lo mira. Irrelevante para la app; sí para el próximo que lea docs.

---

## 8. Ideas de producto

Ninguna de estas es un encargo. Son sitios donde la app ya tiene medio camino andado, o un hueco que se siente al usarla.

**Entrenamiento de verdad.** Las rutinas ya son sesiones con ejercicios, Rx y descanso. El registro es minutos × MET × intensidad. Un `WorkoutEntry` con series (ejercicio, reps, kg, RPE opcional) convertiría «Rutinas» en el diario, no en un catálogo que al guardar se aplana. El temporizador de descanso ya está. Sería la función que más cambia Actividad.

**Buscar en Open Food Facts por nombre.** El EAN cubre el súper. En casa, con el bote sin código a mano, hoy toca crear el alimento. OFF acepta búsqueda por texto; un resultado se puede mapear con el `mapOffProduct` que ya tienes. Sigue sin cuenta ni backend: es un `fetch` más, con el mismo cancel que el EAN.

**Recetas propias con los tres micros.** Si `UserRecipe.per100` pasara a `Macros` y `buildUserRecipe` sumara `sug`/`sat`/`sod` igual que el catálogo, el total del día dejaría de mentir al cocinar en casa. El formulario de alimento propio podría exponerlos como opcionales, no como un `null` fijo.

**Aviso de copia de seguridad.** Todo vive en `localStorage`. `saveState` ya devuelve `false` y el toast dice «almacenamiento lleno o privado». No hay `lastBackupAt` ni un «hace 20 días que no exportas». Un nag suave en Ajustes, o al abrir si hace más de N días, encaja con una PWA sin cuenta. IndexedDB (o al menos un aviso de cuota *antes* de llenarse) es el siguiente escalón si el historial crece.

**Copiar el patrón de la semana.** Ya hay copiar día y copiar una comida. «Repetir este desayuno los lunes» o «usar el de la semana pasada» es el gesto de quien come casi siempre lo mismo. `copyMeal` + el plan por días están a un paso.

**Filtro de alérgenos / vegetariano en el buscador.** Las recetas del catálogo ya llevan `vegetarian` / `vegan` / `tags`. El buscador de alimentos no. Un chip «sin gluten» / «vegano» sobre lo que ya está etiquetado no pide datos nuevos.

**Objetivos de sodio / azúcar, opcionales.** El día ya los suma. Un techo opcional en Ajustes (apagado por defecto, como un objetivo a 0) daría sentido a esa línea de Comida. Sin él, el número informa y no se puede «cumplir».

**Atajos del sistema.** Comida / agua / peso están. Entreno faltaría. Si algún día hay widgets de iOS/Android, esto no aplica (PWA); los shortcuts del manifiesto sí.

**CSV en tres ficheros.** `exportCsvBundle` está escrito. Un segundo botón, o un zip, haría que las medidas y (si se añaden) azúcar/sodio salgan por el camino que Ajustes ya ofrece. El combinado actual se come las columnas nuevas.

**Ventana de comidas configurable.** Igual que `fastingStart` desplazó el 16:8. Desayuno/comida/cena/merienda a horas fijas choca con turnos y con familias. Un bloque pequeño en Ajustes, al lado del ayuno, reutilizaría el mismo patrón.

**No dual-escribir el peso.** Si el pesaje es la serie y el perfil se deriva, desaparecen 1.1, el IMC partido y el recálculo que se mueve solo. Es más un arreglo de modelo que una función nueva, y desbloquea el deshacer.

**Despensa → recetas que puedo hacer.** La despensa ya existe. «Con lo que hay» sobre las 211 recetas es un filtro, no un motor nuevo. Útil el viernes por la noche.

---

## 9. Cierre

La v4.8 es una pasada de calidad de las que se notan: el SW por fin precachea de verdad, el deshacer de comidas ya no reordena, el contraste está medido, las medidas tienen trazo, la compra se comparte. Esta nota no pretende reabrir eso.

Si hubiera que señalar un solo sitio donde la app todavía miente al usuario, yo me quedaría con el pesaje y el perfil (1.1): el toast de deshacer, el IMC y el TDEE no cuentan la misma historia. El resto es consistencia (recetas propias vs catálogo, CSV vs pantalla, Hoy vs Actividad en días futuros) y producto (series de verdad, OFF por nombre, un empujón a exportar).

Tú decides qué, si algo, entra. Yo no toco el código.
