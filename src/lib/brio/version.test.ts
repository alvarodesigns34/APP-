import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import SW from "../../../public/sw.js?raw";
import { APP_VERSION } from "./types";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const README = read("../../../README.md");
const PACKAGE_JSON = JSON.parse(read("../../../package.json")) as { version: string };

/**
 * `APP_VERSION`, la caché del service worker y `package.json` se
 * desalinearon en silencio durante toda una tanda de funciones nuevas: el
 * número que ve el usuario en Ajustes decía 4.1.0 mientras la caché ya iba
 * por brio-v4.5. Sin un test, nada avisa cuando uno de los tres se olvida —
 * y olvidar el de la caché es el peor de los tres: un usuario con la PWA ya
 * instalada no ve ninguna función nueva hasta que el navegador decide
 * revisar el service worker por su cuenta, que puede tardar días.
 *
 * El contrato: `brio-v{major}.{minor}` sigue a `APP_VERSION`. No se exige
 * que suban en el mismo commit — algunos cambios no afectan a lo que ya está
 * instalado — pero si `APP_VERSION` sube de minor, la caché tiene que llevar
 * ese mismo major.minor, o un cambio que sí afecta a un usuario instalado
 * puede quedarse sin servir.
 */
describe("versión, caché del service worker y README alineados", () => {
  it("package.json coincide con APP_VERSION", () => {
    expect(PACKAGE_JSON.version).toBe(APP_VERSION);
  });

  it("la caché del service worker sigue a APP_VERSION en major.minor", () => {
    const [major, minor] = APP_VERSION.split(".");
    const m = SW.match(/const CACHE = "brio-v(\d+)\.(\d+)"/);
    expect(m, "no se encuentra `const CACHE = \"brio-vX.Y\"` en public/sw.js").not.toBeNull();
    expect(`${m![1]}.${m![2]}`).toBe(`${major}.${minor}`);
  });

  it("el README no se ha quedado en una versión antigua", () => {
    const [major, minor] = APP_VERSION.split(".");
    expect(README).toContain(`## v${major}.${minor}`);
  });
});
