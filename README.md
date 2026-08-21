# Brío

App de salud y fitness: nutrición, movimiento, agua, sueño y peso. Los datos viven en el dispositivo (sin cuentas).

## Estado

- **v4 (actual):** código React en `src/` — catálogo, pantallas, persistencia local.
- **v3 (legado):** `index.html` monolito original, conservado como referencia.

## Qué hay

- 719 alimentos, 211 recetas, 12 rutinas
- Registro de comidas (editar, duplicar, mover), recetas, despensa y lista de compra
- Alimentos propios, copiar ayer, sugerencias por macros que quedan
- Anillos de kcal / pasos / ejercicio, rachas, tendencias
- Unidades métricas o imperiales, temas claro/oscuro
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
