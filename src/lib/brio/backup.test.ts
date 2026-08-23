import { describe, expect, it } from "vitest";
import {
  DEFAULT_BACKUP,
  MIN_DAYS_LOGGED,
  SNOOZE_DAYS,
  STALE_DAYS,
  daysSinceBackup,
  parseBackup,
  shouldSuggestBackup,
} from "./backup";

const DAY = 86_400_000;
const NOW = new Date(2026, 7, 23, 12, 0).getTime();
const ago = (days: number) => NOW - days * DAY;

describe("parseBackup", () => {
  it("acepta lo que escribe la propia app", () => {
    expect(parseBackup({ at: 1000, snoozed: 2000 })).toEqual({ at: 1000, snoozed: 2000 });
  });

  it("descarta cualquier basura sin romperse", () => {
    // Misma política que el resto de la carga: lo que no es un número usable
    // es "no lo sé", no un cero.
    expect(parseBackup(null)).toEqual(DEFAULT_BACKUP);
    expect(parseBackup("hola")).toEqual(DEFAULT_BACKUP);
    expect(parseBackup({ at: "ayer" })).toEqual(DEFAULT_BACKUP);
    expect(parseBackup({ at: 0 })).toEqual(DEFAULT_BACKUP);
    expect(parseBackup({ at: -5 })).toEqual(DEFAULT_BACKUP);
    expect(parseBackup({ at: Number.NaN })).toEqual(DEFAULT_BACKUP);
  });
});

describe("daysSinceBackup", () => {
  it("cuenta días enteros", () => {
    expect(daysSinceBackup({ at: ago(3), snoozed: null }, NOW)).toBe(3);
    expect(daysSinceBackup({ at: NOW, snoozed: null }, NOW)).toBe(0);
  });

  it("null cuando no se ha exportado nunca", () => {
    expect(daysSinceBackup(DEFAULT_BACKUP, NOW)).toBeNull();
  });

  it("no devuelve negativos con un reloj movido hacia atrás", () => {
    expect(daysSinceBackup({ at: NOW + 5 * DAY, snoozed: null }, NOW)).toBe(0);
  });
});

describe("shouldSuggestBackup", () => {
  const bastante = MIN_DAYS_LOGGED;

  it("calla mientras hay poco que perder", () => {
    // Pedir copia a quien lleva dos días usando la app es ruido.
    expect(shouldSuggestBackup(DEFAULT_BACKUP, MIN_DAYS_LOGGED - 1, NOW)).toBe(false);
  });

  it("avisa con historial y sin ninguna copia hecha", () => {
    expect(shouldSuggestBackup(DEFAULT_BACKUP, bastante, NOW)).toBe(true);
  });

  it("calla si la copia es reciente", () => {
    expect(shouldSuggestBackup({ at: ago(STALE_DAYS - 1), snoozed: null }, bastante, NOW)).toBe(false);
  });

  it("vuelve a avisar cuando la copia vence", () => {
    expect(shouldSuggestBackup({ at: ago(STALE_DAYS), snoozed: null }, bastante, NOW)).toBe(true);
  });

  it("respeta un «ahora no» reciente", () => {
    expect(shouldSuggestBackup({ at: null, snoozed: ago(SNOOZE_DAYS - 1) }, bastante, NOW)).toBe(false);
  });

  it("vuelve a preguntar cuando el «ahora no» caduca", () => {
    expect(shouldSuggestBackup({ at: null, snoozed: ago(SNOOZE_DAYS) }, bastante, NOW)).toBe(true);
  });

  it("el «ahora no» manda sobre una copia vencida, no al revés", () => {
    // Si no, decir "ahora no" no significaría nada para quien tiene una copia
    // vieja: es justo el caso en el que se dice.
    expect(shouldSuggestBackup({ at: ago(90), snoozed: ago(1) }, bastante, NOW)).toBe(false);
  });
});
