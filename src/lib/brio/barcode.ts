import { round } from "./format";
import type { Food, FoodBase, FoodUnit } from "./types";

export const BARCODE_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"] as const;

export const OFF_PRODUCT_URL = "https://world.openfoodfacts.org/api/v2/product";

const OFF_TIMEOUT_MS = 8000;

export type OffFoodDraft = {
  name: string;
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
  fib: number;
  sug: number | null;
  sat: number | null;
  sod: number | null;
  units: FoodUnit[];
  base: FoodBase;
  barcode: string;
};

type DetectorInstance = {
  detect: (source: ImageBitmapSource) => Promise<{ rawValue?: string }[]>;
};

type DetectorCtor = {
  new (opts?: { formats?: string[] }): DetectorInstance;
  getSupportedFormats?: () => Promise<string[]>;
};

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function asNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function asStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Keep digits only (spaces, hyphens and other noise dropped). */
export function normalizeEan(raw: string | number | null | undefined): string {
  return String(raw ?? "").replace(/\D/g, "");
}

/** GS1 check digit: rightmost data digit is weighted ×3. */
export function gs1ChecksumOk(digits: string): boolean {
  if (!/^\d{8}$|^\d{12}$|^\d{13}$/.test(digits)) return false;
  const nums = digits.split("").map(Number);
  const check = nums.pop();
  if (check == null) return false;
  let sum = 0;
  for (let i = 0; i < nums.length; i++) {
    const fromRight = nums.length - 1 - i;
    sum += (nums[i] ?? 0) * (fromRight % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10 === check;
}

export function isWellFormedEan(raw: string | number | null | undefined): boolean {
  const d = normalizeEan(raw);
  return d.length === 8 || d.length === 12 || d.length === 13;
}

/** Manual entry: 8 / 12 / 13 digits and a valid GS1 checksum. */
export function isValidEan(raw: string | number | null | undefined): boolean {
  const d = normalizeEan(raw);
  return gs1ChecksumOk(d);
}

export function findFoodByBarcode(ean: string, foods: Food[]): Food | undefined {
  const code = normalizeEan(ean);
  if (!code) return undefined;
  return foods.find((f) => {
    if (f.barcode && normalizeEan(f.barcode) === code) return true;
    if (normalizeEan(f.name) === code) return true;
    return f.name.includes(code);
  });
}

export function foodDraftHasMacros(draft: Pick<OffFoodDraft, "kcal" | "prot" | "carb" | "fat">): boolean {
  return draft.kcal > 0 || draft.prot > 0 || draft.carb > 0 || draft.fat > 0;
}

function nutriment(n: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const v = asNum(n[key]);
    if (v != null) return v;
  }
  return null;
}

function optMacro(n: number | null, digits = 1): number | null {
  if (n == null) return null;
  return round(n, digits);
}

/**
 * Map an Open Food Facts v2 product payload to a custom-food draft (per 100 g/ml).
 * Prefers Spanish names. Sodium is converted from grams to mg to match the catalog.
 */
export function mapOffProduct(payload: unknown, ean: string): OffFoodDraft | null {
  if (!isObj(payload)) return null;
  const status = payload.status;
  if (status === 0 || status === "0") return null;
  const product = isObj(payload.product) ? payload.product : null;
  if (!product) return null;

  const code = normalizeEan(ean) || normalizeEan(asStr(payload.code) || asStr(product.code) || asStr(product.id));
  const nutriments = isObj(product.nutriments) ? product.nutriments : {};

  const name =
    asStr(product.product_name_es) ||
    asStr(product.product_name) ||
    asStr(product.generic_name_es) ||
    asStr(product.generic_name) ||
    (code ? `Producto ${code}` : "");
  if (!name) return null;

  const kcal100g = nutriment(nutriments, ["energy-kcal_100g", "energy-kcal", "energy_kcal_100g"]);
  const kcal100ml = nutriment(nutriments, ["energy-kcal_100ml", "energy_kcal_100ml"]);
  const kj100g = nutriment(nutriments, ["energy-kj_100g", "energy_100g", "energy-kj"]);
  const kj100ml = nutriment(nutriments, ["energy-kj_100ml", "energy_100ml"]);
  // kJ only when no kcal figure is published. The per-100-ml kJ key used to sit
  // behind a condition that this branch had already ruled out, so it was never
  // read: a drink listed only as kJ/100 ml came through as a 0 kcal food.
  const kjKcal = kj100g != null ? kj100g / 4.184 : kj100ml != null ? kj100ml / 4.184 : null;
  const kcal = kcal100g ?? kcal100ml ?? kjKcal;

  const prot = nutriment(nutriments, ["proteins_100g", "proteins_100ml", "proteins"]) ?? 0;
  const carb = nutriment(nutriments, ["carbohydrates_100g", "carbohydrates_100ml", "carbohydrates"]) ?? 0;
  const fat = nutriment(nutriments, ["fat_100g", "fat_100ml", "fat"]) ?? 0;
  const fib = nutriment(nutriments, ["fiber_100g", "fibre_100g", "fiber_100ml", "fiber"]) ?? 0;
  const sug = nutriment(nutriments, ["sugars_100g", "sugars_100ml", "sugars"]);
  const sat = nutriment(nutriments, ["saturated-fat_100g", "saturated-fat_100ml", "saturated-fat"]);
  const sodiumG = nutriment(nutriments, ["sodium_100g", "sodium_100ml", "sodium"]);
  const saltG = nutriment(nutriments, ["salt_100g", "salt_100ml", "salt"]);
  const sodMg = sodiumG != null ? sodiumG * 1000 : saltG != null ? saltG * 400 : null;

  // A liquid is one whose only energy figure is a per-100-ml key, in kcal or kJ.
  const perMl = kcal100g == null && kj100g == null && (kcal100ml != null || kj100ml != null);
  const base: FoodBase = perMl ? "ml" : "g";
  const serving = asNum(product.serving_quantity) ?? asNum(product.serving_quantity_g);
  const units: FoodUnit[] = serving != null && serving > 0 ? [{ name: "ración", g: round(serving, 1) }] : [];

  return {
    name,
    kcal: round(kcal ?? 0, 1),
    prot: round(prot, 1),
    carb: round(carb, 1),
    fat: round(fat, 1),
    fib: round(fib, 1),
    sug: optMacro(sug),
    sat: optMacro(sat),
    sod: sodMg == null ? null : round(sodMg, 0),
    units,
    base,
    barcode: code,
  };
}

export function offProductUrl(ean: string): string {
  return `${OFF_PRODUCT_URL}/${encodeURIComponent(normalizeEan(ean))}.json`;
}

export async function fetchOffProduct(ean: string, fetchImpl: typeof fetch = fetch): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), OFF_TIMEOUT_MS);
  try {
    const res = await fetchImpl(offProductUrl(ean), {
      method: "GET",
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`off ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export function getBarcodeDetectorCtor(): DetectorCtor | null {
  if (typeof window === "undefined") return null;
  const ctor = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
  return ctor ?? null;
}

export function hasBarcodeDetector(): boolean {
  return getBarcodeDetectorCtor() != null;
}

export async function createBarcodeDetector(): Promise<DetectorInstance | null> {
  const Ctor = getBarcodeDetectorCtor();
  if (!Ctor) return null;
  try {
    const supported = Ctor.getSupportedFormats ? await Ctor.getSupportedFormats() : null;
    const formats = supported ? BARCODE_FORMATS.filter((f) => supported.includes(f)) : [...BARCODE_FORMATS];
    if (formats.length === 0) return new Ctor();
    return new Ctor({ formats: [...formats] });
  } catch {
    try {
      return new Ctor();
    } catch {
      return null;
    }
  }
}

/**
 * Se aceptan los códigos bien formados aunque el dígito de control no cuadre:
 * hay etiquetas impresas con el checksum mal, y Open Food Facts dirá que no lo
 * conoce, que es un fallo mucho más benigno que negarse a buscarlo.
 *
 * Había dos ramas, `isValidEan` primero y `isWellFormedEan` después, y el test
 * se titulaba "prefiere los códigos con checksum válido" — pero las dos
 * devolvían lo mismo y la primera está contenida en la segunda (la comprobación
 * de checksum ya exige 8/12/13 dígitos), así que no había preferencia ninguna.
 */
export function pickDetectedCode(raw: string | undefined): string | null {
  if (!raw) return null;
  const digits = normalizeEan(raw);
  return isWellFormedEan(digits) ? digits : null;
}

export async function detectBarcodeFromImage(source: ImageBitmapSource): Promise<string | null> {
  const detector = await createBarcodeDetector();
  if (!detector) return null;
  const codes = await detector.detect(source);
  for (const code of codes) {
    const ean = pickDetectedCode(code.rawValue);
    if (ean) return ean;
  }
  return null;
}

type ZXingReader = { decode: (el: HTMLVideoElement | HTMLImageElement) => { getText: () => string } };

/**
 * `BarcodeDetector` no existe en Safari — que es el navegador de cualquiera
 * que instale esta PWA en un iPhone, no un caso raro — así que sin esto el
 * botón de escanear era humo ahí: ni la cámara en vivo ni la foto
 * funcionaban, solo escribir el número a mano. ZXing decodifica igual por JS
 * puro, más lento por fotograma pero sin depender de una API que ahí no está.
 *
 * Import dinámico y memoizado en un módulo, no en el componente: quien sí
 * tiene el detector nativo (Chrome/Android, la mayoría de instalaciones)
 * nunca paga el coste de esta librería, y quien la necesita solo la carga
 * una vez aunque abra la hoja de escanear varias veces.
 */
let zxingReaderPromise: Promise<ZXingReader> | null = null;

export function loadZXingReader(): Promise<ZXingReader> {
  if (!zxingReaderPromise) {
    zxingReaderPromise = import("@zxing/browser").then(
      ({ BrowserMultiFormatReader }) => new BrowserMultiFormatReader() as ZXingReader,
    );
  }
  return zxingReaderPromise;
}

/**
 * Decodifica un solo fotograma (vídeo) o una imagen estática con ZXing.
 * `null` significa "no hay código en esto", igual que la ruta nativa — no
 * encontrar nada en un fotograma suelto es lo normal mientras se enfoca, no
 * un fallo que haya que reportar.
 */
export async function decodeBarcodeZXing(el: HTMLVideoElement | HTMLImageElement): Promise<string | null> {
  try {
    const reader = await loadZXingReader();
    return pickDetectedCode(reader.decode(el).getText());
  } catch {
    return null;
  }
}
