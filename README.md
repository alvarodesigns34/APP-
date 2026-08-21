# Brío

App de salud y fitness: nutrición, movimiento, agua, sueño y peso. Los datos viven en el dispositivo (sin cuentas).

## v4.1

- 719 alimentos, 211 recetas, 12 rutinas
- Registro de comidas (editar, duplicar, mover), recetas, despensa y lista de compra
- Alimentos propios, copiar ayer, sugerencias por macros que quedan
- **Al vuelo:** favoritos y recientes en un toque desde Hoy
- **Comidas habituales:** repetir desayunos y cenas de siempre
- **Marcas de entreno:** historial, récord por deporte y meta semanal
- Ventana de ayuno 12:12 / 14:10 / 16:8 / 18:6
- Anillos de kcal / pasos / ejercicio, rachas, tendencias y proyección de peso
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
