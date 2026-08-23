import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ACCENTS, DEFAULT_ACCENT, isAccentId } from "./accent";
import { STORE_KEY } from "./types";

// Read straight off disk, not imported: vitest short-circuits CSS imports to an
// empty string, and the whole point is to assert on the bytes the app ships.
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const CSS = read("../../styles.css");
const HTML = read("../../../index.html");

/**
 * The accent values deliberately live in styles.css and nowhere else, so the
 * only way to check them is to read that file. Parsing it here is the point:
 * it means these assertions guard the colours the app actually ships, not a
 * copy of them that could quietly drift.
 */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function blocks(css: string): Map<string, string> {
  const out = new Map<string, string>();
  // Comments go first: everything between one `}` and the next `{` is taken as
  // the selector, so a comment sitting above a rule would otherwise become part
  // of its key and no lookup would ever match.
  for (const m of stripComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    out.set(m[1].replace(/\s+/g, " ").trim(), m[2]);
  }
  return out;
}

const BLOCKS = blocks(CSS);

function declOf(selector: string, prop: string): string {
  const body = BLOCKS.get(selector);
  if (body == null) throw new Error(`No existe el bloque CSS \`${selector}\` en styles.css`);
  const m = body.match(new RegExp(`${prop}\\s*:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`\`${selector}\` no define ${prop} como un hex de 6 dígitos`);
  return m[1];
}

function srgbToLin(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const h = hex.slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The chromatic axes of CIE-Lab, where "same colour family" actually lives. */
function lab(hex: string): { a: number; b: number } {
  const h = hex.slice(1);
  const [r, g, bl] = [0, 2, 4].map((i) => srgbToLin(parseInt(h.slice(i, i + 2), 16)));
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f((0.4124 * r + 0.3576 * g + 0.1805 * bl) / 0.95047);
  const fy = f(0.2126 * r + 0.7152 * g + 0.0722 * bl);
  const fz = f((0.0193 * r + 0.1192 * g + 0.9505 * bl) / 1.08883);
  return { a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

function chroma(hex: string): number {
  const { a, b } = lab(hex);
  return Math.hypot(a, b);
}

function hueApart(x: string, y: string): number {
  const hue = (hex: string) => {
    const { a, b } = lab(hex);
    return ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  };
  const d = Math.abs(hue(x) - hue(y)) % 360;
  return Math.min(d, 360 - d);
}

const SURFACES = {
  light: {
    selector: (id: string) => `[data-accent="${id}"]`,
    // `--brio-primary` is used as a filled background with primary-foreground
    // text on it, and as text/icons directly on a card or the page. All three
    // pairings have to be readable, so all three are checked.
    against: { fg: declOf(":root", "--brio-primary-fg"), card: declOf(":root", "--brio-card"), bg: declOf(":root", "--brio-bg") },
  },
  dark: {
    selector: (id: string) => `.dark[data-accent="${id}"], .dark [data-accent="${id}"]`,
    against: { fg: declOf(".dark", "--brio-primary-fg"), card: declOf(".dark", "--brio-card"), bg: declOf(".dark", "--brio-bg") },
  },
} as const;

describe("paleta de acentos", () => {
  it("define todos los acentos en ambos temas", () => {
    for (const a of ACCENTS) {
      expect(() => declOf(SURFACES.light.selector(a.id), "--brio-primary")).not.toThrow();
      expect(() => declOf(SURFACES.dark.selector(a.id), "--brio-primary")).not.toThrow();
    }
  });

  it("no deja bloques [data-accent] huérfanos en el CSS", () => {
    // Un bloque para un id que ya no existe en ACCENTS sería color muerto que
    // nadie puede elegir; un id de ACCENTS sin bloque cae al verde de :root sin
    // avisar. Las dos listas tienen que coincidir exactamente.
    const inCss = new Set([...stripComments(CSS).matchAll(/\[data-accent="([^"]+)"\]/g)].map((m) => m[1]));
    expect([...inCss].sort()).toEqual(ACCENTS.map((a) => a.id).sort());
    for (const id of inCss) expect(isAccentId(id)).toBe(true);
  });

  it.each(ACCENTS.map((a) => a.id))("«%s» cumple AA (4.5:1) sobre texto, tarjeta y fondo en ambos temas", (id) => {
    for (const mode of ["light", "dark"] as const) {
      const primary = declOf(SURFACES[mode].selector(id), "--brio-primary");
      for (const [surface, hex] of Object.entries(SURFACES[mode].against)) {
        const ratio = contrast(primary, hex);
        expect(ratio, `${id} ${mode} sobre ${surface}: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it.each(ACCENTS.map((a) => a.id))("«%s» no se confunde con los otros dos aros de Hoy", (id) => {
    // `--brio-kcal` es el aro exterior de Hoy y convive con los de Pasos y
    // Ejercicio, que no cambian. Al elegir la paleta a ojo se colaron un
    // «Océano» y un «Terracota» que sobre la pantalla eran *el mismo color*
    // que Pasos y que Ejercicio: los aros se fundían y los puntos de la
    // leyenda eran indistinguibles.
    //
    // La distancia total (ΔE) no sirve de criterio: «Grafito» está a ΔE 24 de
    // Pasos y se lee perfectamente, porque es acromático. Lo que decide es el
    // TONO, y solo cuando el color tiene croma suficiente para tener tono.
    // El umbral sale de comparar capturas reales: 4° y 23° se confundían, 37°
    // y 40° se distinguían sin esfuerzo.
    const MIN_HUE_APART = 35;
    const NEUTRAL_CHROMA = 12;
    for (const mode of ["light", "dark"] as const) {
      const primary = declOf(SURFACES[mode].selector(id), "--brio-primary");
      if (chroma(primary) < NEUTRAL_CHROMA) continue;
      for (const [ring, prop] of [
        ["Pasos", "--brio-steps"],
        ["Ejercicio", "--brio-move"],
      ] as const) {
        const apart = hueApart(primary, declOf(mode === "light" ? ":root" : ".dark", prop));
        expect(apart, `${id} ${mode} vs ${ring}: ${apart.toFixed(0)}° de tono`).toBeGreaterThanOrEqual(MIN_HUE_APART);
      }
    }
  });

  it("mantiene el aro de calorías en sintonía con el color principal", () => {
    // `--brio-kcal` pinta el aro grande de Hoy, que es el elemento con más peso
    // visual de la app: si no siguiera al acento, elegir «Ciruela» dejaría la
    // pantalla principal verde y parecería que el ajuste no ha hecho nada.
    for (const a of ACCENTS) {
      for (const mode of ["light", "dark"] as const) {
        const sel = SURFACES[mode].selector(a.id);
        expect(declOf(sel, "--brio-kcal")).toBe(declOf(sel, "--brio-primary"));
      }
    }
  });
});

describe("arranque sin destello", () => {
  it("el script en línea lee la misma clave de almacenamiento que la app", () => {
    // index.html no puede importar STORE_KEY, así que lo lleva escrito. Si el
    // esquema sube de versión y ese literal se queda atrás, el script no
    // encuentra nada, no aplica el tema y vuelve el destello claro — en
    // silencio, que es justo lo que este test evita.
    expect(HTML).toContain(`localStorage.getItem("${STORE_KEY}")`);
  });

  it("el script en línea cae en el acento por defecto real", () => {
    expect(HTML).toContain(`: "${DEFAULT_ACCENT}"`);
  });
});
