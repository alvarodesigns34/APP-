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

PWA: `public/manifest.webmanifest`, iconos 180/192/512 y un service worker (`public/sw.js`) que precachea el shell. Tras el primer `build` + visita, abre sin red.

## v4.1

- 719 alimentos, 211 recetas, 12 rutinas
- Registro de comidas, recetas, despensa y lista de compra
- Al vuelo, comidas habituales, marcas de entreno
- Ventana de ayuno 12:12 / 14:10 / 16:8 / 18:6
- Anillos, rachas, tendencias y proyección de peso
- Unidades métricas o imperiales (altura imperial en pies y pulgadas)
- Exportar e importar JSON

Brío no sustituye el consejo de un profesional sanitario.

## Código

```
src/
  routes/           Hoy, Comida, Actividad, Tendencias, Ajustes
  components/       pantallas, hojas, anillos, recetas
  lib/brio/         dominio, catálogo, persistencia, store
  data/             alimentos, recetas, rutinas, MET
```
