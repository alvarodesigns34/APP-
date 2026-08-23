import { describe, expect, it } from "vitest";
import { defaultState, migrate } from "./persist";
import { DEFAULT_REMINDERS } from "./reminders";
import { DEFAULT_WEEKDAY_PLAN } from "./weekday-goals";

describe("migrate", () => {
  it("returns defaults for garbage input", () => {
    const s = migrate("not json object");
    expect(s.profile.weight).toBe(70);
    expect(s.customFoods).toEqual([]);
    expect(s.recipes).toEqual([]);
    expect(s.favorites).toEqual([]);
  });

  it("drops malformed customFoods, recipes and id lists", () => {
    const s = migrate({
      customFoods: [
        null,
        1,
        { id: "bad" },
        {
          id: "ok",
          name: "Yogur",
          cat: "propio",
          kcal: 80,
          prot: 4,
          carb: 6,
          fat: 3,
          fib: 0,
          sug: null,
          sat: null,
          sod: null,
          units: [{ name: "unidad", g: 125 }],
          base: "g",
          barcode: " 3017 6204 2200 3 ",
        },
      ],
      recipes: [
        "nope",
        { id: "r1" },
        {
          id: "r-ok",
          name: "Tostada",
          items: [{ foodId: "pan", grams: 40 }],
          servings: 1,
          servingG: 40,
          per100: { kcal: 250, prot: 8, carb: 40, fat: 4, fib: 3 },
        },
      ],
      favorites: [1, "f1", null, ""],
      favRecipes: ["rec-1", 4],
      pantry: { salt: true },
      recents: ["a", "b", 3],
    });
    expect(s.customFoods).toHaveLength(1);
    expect(s.customFoods[0].id).toBe("ok");
    expect(s.customFoods[0].barcode).toBe("3017620422003");
    expect(s.recipes).toHaveLength(1);
    expect(s.recipes[0].id).toBe("r-ok");
    expect(s.favorites).toEqual(["f1"]);
    expect(s.favRecipes).toEqual(["rec-1"]);
    expect(s.pantry).toEqual([]);
    expect(s.recents).toEqual(["a", "b"]);
  });

  it("fills reminder defaults when migrating an old save and keeps the rest", () => {
    const s = migrate({
      onboarded: true,
      profile: {
        name: "Ana",
        sex: "m",
        birth: "1990-01-01",
        height: 160,
        weight: 58,
        activity: "mod",
        purpose: "perder",
      },
      settings: { theme: "dark", units: "imp", glass: 300, pantryBasics: false },
      goals: { kcal: 1800, water: 2200 },
      weights: [{ date: "2026-08-20", kg: 58 }],
      favorites: ["manzana"],
    });
    expect(s.onboarded).toBe(true);
    expect(s.profile.name).toBe("Ana");
    expect(s.profile.weight).toBe(58);
    expect(s.settings.theme).toBe("dark");
    expect(s.settings.units).toBe("imp");
    expect(s.settings.glass).toBe(300);
    expect(s.settings.pantryBasics).toBe(false);
    expect(s.goals.kcal).toBe(1800);
    expect(s.goals.water).toBe(2200);
    expect(s.weights).toEqual([{ date: "2026-08-20", kg: 58 }]);
    expect(s.favorites).toEqual(["manzana"]);
    expect(s.settings.reminders).toEqual(DEFAULT_REMINDERS);
    expect(s.settings.reminders.enabled).toBe(false);
  });

  it("replaces garbage reminders with defaults", () => {
    const s = migrate({
      settings: { theme: "light", reminders: "nope" },
    });
    expect(s.settings.theme).toBe("light");
    expect(s.settings.reminders).toEqual(DEFAULT_REMINDERS);
  });

  it("fills weekdayPlan defaults when migrating an old save", () => {
    const s = migrate({
      onboarded: true,
      settings: { theme: "dark" },
    });
    expect(s.settings.weekdayPlan).toEqual(DEFAULT_WEEKDAY_PLAN);
    expect(s.settings.weekdayPlan.enabled).toBe(false);
    expect(s.settings.weekdayPlan.training).toEqual([false, true, true, true, true, true, false]);
  });

  it("parses weekdayPlan from a save", () => {
    const training = [true, false, false, false, false, false, true];
    const s = migrate({
      settings: { weekdayPlan: { enabled: true, training } },
    });
    expect(s.settings.weekdayPlan.enabled).toBe(true);
    expect(s.settings.weekdayPlan.training).toEqual(training);
  });

  it("replaces garbage weekdayPlan with defaults", () => {
    const s = migrate({
      settings: { theme: "light", weekdayPlan: "nope" },
    });
    expect(s.settings.theme).toBe("light");
    expect(s.settings.weekdayPlan).toEqual(DEFAULT_WEEKDAY_PLAN);
  });

  describe("activityAdjust", () => {
    it("defaults a save from before this setting existed to off, not the new-install default", () => {
      const s = migrate({ settings: { theme: "dark", units: "imp" } });
      expect(s.settings.activityAdjust).toBe(false);
    });

    it("respects an explicit false the same save already had", () => {
      const s = migrate({ settings: { activityAdjust: false } });
      expect(s.settings.activityAdjust).toBe(false);
    });

    it("respects an explicit true the same save already had", () => {
      const s = migrate({ settings: { activityAdjust: true } });
      expect(s.settings.activityAdjust).toBe(true);
    });

    it("treats garbage as absent and defaults to off", () => {
      const s = migrate({ settings: { activityAdjust: "yes" } });
      expect(s.settings.activityAdjust).toBe(false);
    });
  });

  describe("workouts", () => {
    it("drops malformed workout entries and keeps valid ones", () => {
      const s = migrate({
        days: {
          "2026-08-22": {
            workouts: [
              null,
              "nope",
              { id: "w1" },
              { id: "w2", type: "correr", min: -5, intensity: "media", kcal: 300 },
              { id: "w3", type: "correr", min: 30, intensity: "rara", kcal: 300 },
              { id: "w4", type: "correr", min: 30, intensity: "alta", kcal: 300 },
            ],
          },
        },
      });
      const workouts = s.days["2026-08-22"].workouts;
      expect(workouts).toHaveLength(1);
      expect(workouts[0]).toEqual({ id: "w4", type: "correr", min: 30, intensity: "alta", kcal: 300 });
    });
  });

  describe("meal entries", () => {
    const good = {
      id: "e1",
      foodId: "f001",
      name: "Manzana",
      qty: 1,
      unitName: "unidad",
      grams: 180,
      t: 1787415741804,
      kcal: 93.6,
      prot: 0.5,
      carb: 24.8,
      fat: 0.4,
      fib: 4.3,
      sug: 18.7,
      sat: 0.1,
      sod: 1.8,
    };

    it("drops entries with a missing or non-numeric macro instead of letting NaN through", () => {
      const s = migrate({
        days: {
          "2026-08-22": {
            meals: {
              comida: [
                null,
                "nope",
                {},
                { ...good, id: "no-kcal", kcal: undefined },
                { ...good, id: "text-kcal", kcal: "muchas" },
                { ...good, id: "no-food", foodId: "" },
                good,
              ],
            },
          },
        },
      });
      const entries = s.days["2026-08-22"].meals.comida;
      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe("e1");
      const total = entries.reduce((a, e) => a + e.kcal, 0);
      expect(Number.isFinite(total)).toBe(true);
      expect(total).toBe(93.6);
    });

    it("keeps a usable entry when only the cosmetic fields are missing", () => {
      const s = migrate({
        days: {
          "2026-08-22": {
            meals: { cena: [{ foodId: "f002", kcal: 100, prot: 1, carb: 2, fat: 3, fib: 0 }] },
          },
        },
      });
      const e = s.days["2026-08-22"].meals.cena[0];
      expect(e.kcal).toBe(100);
      expect(e.name).toBe("f002");
      expect(e.qty).toBe(1);
      expect(e.grams).toBe(0);
      expect(e.id.length).toBeGreaterThan(0);
      expect(e.sug).toBeNull();
    });

    it("un `sug`/`sat`/`sod` explícitamente null se queda en null, no se convierte en 0", () => {
      // `Number(null)` es `0`, y `0` es un número finito: el `macro()` que
      // valida kcal/prot/etc convertía un null explícito (lo que guarda
      // JSON.parse cuando Open Food Facts no trae el dato) en un 0 real. Eso
      // hacía que dayFoodTotals sumara "cero azúcar" de un alimento del que
      // en realidad no se sabe nada, en vez de tratarlo como ausente.
      const s = migrate({
        days: {
          "2026-08-22": {
            meals: {
              cena: [{ foodId: "f003", kcal: 100, prot: 1, carb: 2, fat: 3, fib: 0, sug: null, sat: null, sod: null }],
            },
          },
        },
      });
      const e = s.days["2026-08-22"].meals.cena[0];
      expect(e.sug).toBeNull();
      expect(e.sat).toBeNull();
      expect(e.sod).toBeNull();
    });

    it("un `sug`/`sat`/`sod` que sí es 0 se queda en 0, no se pierde", () => {
      const s = migrate({
        days: {
          "2026-08-22": {
            meals: { cena: [{ foodId: "f004", kcal: 100, prot: 1, carb: 2, fat: 3, fib: 0, sug: 0, sat: 0, sod: 0 }] },
          },
        },
      });
      const e = s.days["2026-08-22"].meals.cena[0];
      expect(e.sug).toBe(0);
      expect(e.sat).toBe(0);
      expect(e.sod).toBe(0);
    });
  });

  describe("numeric goals and profile", () => {
    it("falls back on non-numeric or negative goals rather than storing them", () => {
      const s = migrate({ goals: { kcal: "muchas", steps: -500, water: null, weight: 0 } });
      expect(s.goals.kcal).toBe(2200);
      expect(s.goals.steps).toBe(8000);
      expect(s.goals.water).toBe(2000);
      expect(s.goals.weight).toBe(70);
    });

    it("keeps zero, which is how Ajustes switches a goal off", () => {
      const s = migrate({ goals: { steps: 0, water: 0 } });
      expect(s.goals.steps).toBe(0);
      expect(s.goals.water).toBe(0);
    });

    it("falls back on a non-positive height or weight", () => {
      const s = migrate({ profile: { height: -175, weight: "setenta", name: 42 } });
      expect(s.profile.height).toBe(175);
      expect(s.profile.weight).toBe(70);
      expect(s.profile.name).toBe("");
    });
  });
});

describe("weights", () => {
  it("drops rows without a usable date or weight", () => {
    const s = migrate({
      weights: [null, "nope", { date: "2026-08-22" }, { kg: 70 }, { date: "2026-08-22", kg: -70 }, { date: "2026-08-22", kg: 70 }],
    });
    expect(s.weights).toEqual([{ date: "2026-08-22", kg: 70 }]);
  });

  it("keeps body composition only when it is a sane percentage", () => {
    const s = migrate({
      weights: [
        { date: "2026-08-20", kg: 70, fat: 18.4, muscle: 41 },
        { date: "2026-08-21", kg: 70, fat: 250, muscle: -3 },
        { date: "2026-08-22", kg: 70, fat: "mucha" },
      ],
    });
    expect(s.weights[0]).toEqual({ date: "2026-08-20", kg: 70, fat: 18.4, muscle: 41 });
    expect(s.weights[1]).toEqual({ date: "2026-08-21", kg: 70 });
    expect(s.weights[2]).toEqual({ date: "2026-08-22", kg: 70 });
  });

  it("sorts by date ascending, which latestWeight relies on", () => {
    const s = migrate({
      weights: [
        { date: "2026-08-22", kg: 70 },
        { date: "2026-08-01", kg: 72 },
        { date: "2026-08-10", kg: 71 },
      ],
    });
    expect(s.weights.map((w) => w.date)).toEqual(["2026-08-01", "2026-08-10", "2026-08-22"]);
  });
});

/**
 * Todos estos son datos que la propia app nunca escribe, pero que sí llegan al
 * importar una copia editada a mano o generada por otra herramienta. La regla
 * es la misma en todos: un hueco (`null`, `""`, ausente) no es un cero.
 */
describe("migrate: datos de fuera que no son de fiar", () => {
  it("descarta un entreno con minutos o kcal en null en vez de guardarlo a cero", () => {
    const s = migrate({
      days: {
        "2026-08-22": {
          workouts: [
            { id: "w1", type: "correr", min: null, intensity: "media", kcal: 300 },
            { id: "w2", type: "correr", min: 30, intensity: "media", kcal: null },
            { id: "w3", type: "correr", min: 30, intensity: "media", kcal: 300 },
          ],
        },
      },
    });
    // Un entreno de 0 min contaría como sesión en los logros y en las marcas.
    expect(s.days["2026-08-22"].workouts.map((w) => w.id)).toEqual(["w3"]);
  });

  it("descarta una comida con un macro obligatorio en null", () => {
    const s = migrate({
      days: {
        "2026-08-22": {
          meals: {
            comida: [
              { id: "a", foodId: "f1", kcal: null, prot: 10, carb: 2, fat: 3, fib: 0 },
              { id: "b", foodId: "f1", kcal: 100, prot: null, carb: 2, fat: 3, fib: 0 },
              { id: "c", foodId: "f1", kcal: 100, prot: 10, carb: 2, fat: 3, fib: 0 },
            ],
          },
        },
      },
    });
    // Guardarlas daría "0 g de proteína" como afirmación, no como hueco.
    expect(s.days["2026-08-22"].meals.comida.map((e) => e.id)).toEqual(["c"]);
  });

  it("no deja pasar un tamaño de vaso que no sea un número positivo", () => {
    expect(migrate({ settings: { glass: "mucho" } }).settings.glass).toBe(250);
    expect(migrate({ settings: { glass: -50 } }).settings.glass).toBe(250);
    expect(migrate({ settings: { glass: 0 } }).settings.glass).toBe(250);
    expect(migrate({ settings: { glass: 330 } }).settings.glass).toBe(330);
  });

  it("no deja pasar pasos ni agua en negativo", () => {
    const s = migrate({
      days: { "2026-08-22": { steps: -5000, water: [{ id: "w", t: 1, ml: -500 }] } },
    });
    expect(s.days["2026-08-22"].steps).toBe(0);
    expect(s.days["2026-08-22"].water[0].ml).toBe(0);
  });

  it("ignora las claves de día que no son una fecha", () => {
    const s = migrate({
      days: {
        "no soy una fecha": { steps: 100 },
        "2026-8-2": { steps: 100 },
        "2026-08-22": { steps: 100 },
      },
    });
    expect(Object.keys(s.days)).toEqual(["2026-08-22"]);
  });

  it("un aviso de agua ausente cae en el intervalo por defecto, no en el suelo", () => {
    expect(migrate({ settings: { reminders: { aguaEveryMin: null } } }).settings.reminders.aguaEveryMin).toBe(120);
    expect(migrate({ settings: { reminders: { aguaEveryMin: 90 } } }).settings.reminders.aguaEveryMin).toBe(90);
  });
});

describe("el ajuste de actividad no cuenta dos veces de salida", () => {
  it("un usuario nuevo arranca con el ajuste apagado", () => {
    // El aviso de Ajustes dice que el nivel de actividad ya cuenta el
    // movimiento habitual. Con esto en `true` por defecto y el nivel Ligero,
    // todo usuario nuevo empezaba sumando los entrenos otra vez, sin haber
    // visto nunca ese aviso — y quien omitía el onboarding, sin haber
    // contestado nada.
    expect(defaultState().settings.activityAdjust).toBe(false);
  });

  it("respeta un valor guardado explícitamente", () => {
    expect(migrate({ settings: { activityAdjust: true } }).settings.activityAdjust).toBe(true);
    expect(migrate({ settings: { activityAdjust: false } }).settings.activityAdjust).toBe(false);
  });

  it("un guardado antiguo sin la clave sigue cayendo en apagado", () => {
    expect(migrate({ settings: {} }).settings.activityAdjust).toBe(false);
  });
});
