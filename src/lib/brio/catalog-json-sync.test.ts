import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

/**
 * `src/data/{foods,recipes,routines}.json` y `public/data/{...}.json` son dos
 * copias mantenidas a mano de lo mismo. Solo `public/data` se usa en
 * producción — `catalog.ts` hace `fetch("/data/…json")` contra eso — así que
 * la copia en `src/data` no tiene ningún consumidor en el código; sirve como
 * respaldo/histórico, y no se toca (regla del repo: nunca src/data/**).
 *
 * El riesgo real: si alguien edita solo una de las dos copias, el build
 * sigue sirviendo la otra en silencio — el catálogo desplegado deja de
 * coincidir con lo que hay en el repo, y nadie se entera hasta que alguien
 * busca un alimento que "debería estar". Este test es la alternativa que no
 * toca `src/data`: falla si las dos copias divergen, en vez de intentar que
 * una sea la única fuente de verdad.
 */
describe("catálogo: src/data y public/data no han divergido", () => {
  it.each(["foods.json", "recipes.json", "routines.json"])("%s es idéntico en las dos copias", (name) => {
    const a = read(`../../data/${name}`);
    const b = read(`../../../public/data/${name}`);
    expect(a).toBe(b);
  });
});
