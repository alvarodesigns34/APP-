# Brío

App de salud y fitness: nutrición, movimiento, agua, sueño y peso. Los datos viven en el dispositivo (sin cuentas).

## Arquitectura

SPA con **Vite + TanStack Router** (no TanStack Start). La app es 100 % cliente (`localStorage`, `matchMedia`, sin servidor de datos). El documento HTML vive en `index.html`; `__root.tsx` solo monta el shell.

```
npm install
npm run dev
npm run build
npm test
```

PWA: `public/manifest.webmanifest`, iconos 180/192/512 y un service worker
(`public/sw.js`) que precachea el shell, los datos del catálogo y los chunks de
las cinco pantallas. Esa última lista la inyecta en el build el plugin
`brio-sw-precache` de `vite.config.ts`, porque los nombres llevan hash y
`public/` se copia tal cual. Tras el primer `build` + visita, las cinco
pantallas abren sin red; las gráficas de Tendencias (Recharts, ~420 kB) y el
escáner de códigos (ZXing, ~450 kB) se quedan fuera del precache a propósito y
degradan solos cuando no hay conexión.

## v4.8

- Las cinco pantallas abren sin red, no solo Hoy
- La hora a la que registraste cada comida, junto a la cantidad
- Evolución de cada medida corporal, no solo la última
- Editar y compartir la lista de la compra
- La gráfica de peso deja ver los cambios de peso
- Deshacer devuelve el estado anterior, no uno parecido
- Toda la interfaz cumple AA de contraste, medido en las cinco pantallas

## v4.7

- 719 alimentos, 211 recetas, 12 rutinas
- Alimentos y recetas propias: crear, editar y borrar, con undo
- Registro de comidas, despensa y lista de la compra de verdad (pasillos,
  fusión de cantidades al repetir un producto, marcar comprado)
- Al vuelo, comidas habituales, marcas de entreno
- Ventana de ayuno 12:12 / 14:10 / 16:8 / 18:6, con hora de inicio elegible
- Objetivos de calorías, macros (con objetivo de fibra) y plan distinto para
  días de entreno y de descanso
- Peso, composición corporal y medidas (cintura, pecho, cadera, brazo,
  muslo), con el índice cintura/altura
- Modo cocina: pasos de una receta uno a uno, con la pantalla encendida
- 17 logros calculados solos con lo ya registrado
- Anillos, racha, recap semanal y mensual, y proyección de peso
- Color principal elegible (8 acentos), tema claro/oscuro/auto sin destello
- Unidades métricas o imperiales (altura imperial en pies y pulgadas)
- Exportar e importar JSON, y CSV
- Búsqueda insensible a acentos en alimentos **y** recetas, con la coincidencia
  resaltada y el número de resultados
- Recetas ordenables por relevancia, calorías, proteína o tiempo
- La app avisa cuando se publica una versión nueva (desde v4.8 no se recarga sola)

Brío no sustituye el consejo de un profesional sanitario.

## Código

```
src/
  routes/           Hoy, Comida, Actividad, Tendencias, Ajustes
  components/       pantallas, hojas, anillos, recetas
  lib/brio/         dominio, catálogo, persistencia, store
  data/             alimentos, recetas, rutinas, MET
```
