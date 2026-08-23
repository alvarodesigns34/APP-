import { round } from "./format";
import { MEASURES, type MeasureId, type WeightEntry } from "./types";

/**
 * Rango aceptado al validar y al escribir, en centímetros. No pretende ser
 * fisiológico: solo descarta un dedo de más en el teclado (un 1750 por un 175)
 * y los negativos, que arruinarían la escala de la gráfica para siempre.
 */
export const MEASURE_MIN = 10;
export const MEASURE_MAX = 300;

export function isMeasureInRange(n: number): boolean {
  return Number.isFinite(n) && n >= MEASURE_MIN && n <= MEASURE_MAX;
}

export type MeasurePoint = { date: string; cm: number };

/** Los pesajes que traen esta medida, en orden, listos para pintar. */
export function measureSeries(weights: WeightEntry[], id: MeasureId): MeasurePoint[] {
  const out: MeasurePoint[] = [];
  for (const w of weights) {
    const cm = w[id];
    if (typeof cm === "number" && Number.isFinite(cm)) out.push({ date: w.date, cm });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export type MeasureChange = {
  id: MeasureId;
  n: string;
  last: number;
  /** Diferencia contra la primera vez que se apuntó. null si solo hay una. */
  delta: number | null;
};

/**
 * La última lectura de cada medida y cuánto se ha movido desde la primera.
 *
 * Solo devuelve las medidas que alguien ha llegado a apuntar: enseñar cinco
 * filas a cero a quien solo se mide la cintura sería ruido, y la hoja de
 * registro ya está para añadir las que falten.
 */
export function measureChanges(weights: WeightEntry[]): MeasureChange[] {
  const out: MeasureChange[] = [];
  for (const m of MEASURES) {
    const serie = measureSeries(weights, m.id);
    if (serie.length === 0) continue;
    const last = serie[serie.length - 1].cm;
    const first = serie[0].cm;
    out.push({ id: m.id, n: m.n, last, delta: serie.length > 1 ? round(last - first, 1) : null });
  }
  return out;
}

export type WaistRisk = { ratio: number; n: string; tone: "ok" | "warn" | "bad" };

/**
 * Índice cintura/altura, que la evidencia respalda mejor que el IMC para el
 * riesgo cardiometabólico porque distingue dónde está la grasa: el IMC no
 * separa músculo de grasa abdominal, y la cintura sí. La regla divulgativa es
 * «que tu cintura mida menos de la mitad de tu altura».
 *
 * Devuelve null sin los dos datos, en vez de inventar un cero que se leería
 * como un resultado buenísimo.
 */
export function waistToHeight(waistCm: number | undefined, heightCm: number): WaistRisk | null {
  if (waistCm == null || !Number.isFinite(waistCm) || waistCm <= 0) return null;
  if (!Number.isFinite(heightCm) || heightCm <= 0) return null;
  const ratio = round(waistCm / heightCm, 2);
  if (ratio < 0.5) return { ratio, n: "Dentro de lo saludable", tone: "ok" };
  if (ratio < 0.6) return { ratio, n: "Conviene vigilarlo", tone: "warn" };
  return { ratio, n: "Riesgo alto", tone: "bad" };
}

/** La cintura más reciente que se haya apuntado, para el índice de arriba. */
export function latestWaist(weights: WeightEntry[]): number | undefined {
  const serie = measureSeries(weights, "waist");
  return serie.length ? serie[serie.length - 1].cm : undefined;
}
