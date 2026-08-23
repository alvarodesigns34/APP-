import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchOffSearch,
  findFoodByBarcode,
  foodDraftHasMacros,
  gs1ChecksumOk,
  isValidEan,
  isWellFormedEan,
  mapOffProduct,
  mapOffSearch,
  normalizeEan,
  offProductUrl,
  offSearchUrl,
  pickDetectedCode,
} from "./barcode";
import type { Food } from "./types";

const NUTELLA = "3017620422003";

const offNutella = {
  code: NUTELLA,
  status: 1,
  status_verbose: "product found",
  product: {
    product_name: "Nutella",
    product_name_es: "Crema de avellanas con cacao",
    serving_quantity: 15,
    nutriments: {
      "energy-kcal_100g": 539,
      energy_100g: 2252,
      proteins_100g: 6.3,
      carbohydrates_100g: 57.5,
      fat_100g: 30.9,
      fiber_100g: 0,
      sugars_100g: 56.3,
      "saturated-fat_100g": 10.6,
      sodium_100g: 0.0428,
      salt_100g: 0.107,
    },
  },
};

function custom(partial: Partial<Food> & Pick<Food, "id" | "name">): Food {
  return {
    cat: "propio",
    kcal: 100,
    prot: 1,
    carb: 10,
    fat: 1,
    fib: 0,
    sug: null,
    sat: null,
    sod: null,
    units: [],
    base: "g",
    custom: true,
    ...partial,
  };
}

describe("normalizeEan", () => {
  it("strips spaces, hyphens and other non-digits", () => {
    expect(normalizeEan(" 3017 6204 2200 3 ")).toBe(NUTELLA);
    expect(normalizeEan("301-762-042-200-3")).toBe(NUTELLA);
    expect(normalizeEan("ean: 3017.6204.2200.3")).toBe(NUTELLA);
    expect(normalizeEan(NUTELLA)).toBe(NUTELLA);
  });

  it("returns empty for strings without digits", () => {
    expect(normalizeEan("")).toBe("");
    expect(normalizeEan("abc")).toBe("");
    expect(normalizeEan(null)).toBe("");
  });
});

describe("isValidEan", () => {
  it("accepts a known EAN-13 with spaces", () => {
    expect(isValidEan(NUTELLA)).toBe(true);
    expect(isValidEan(" 3017 6204 2200 3 ")).toBe(true);
    expect(gs1ChecksumOk(NUTELLA)).toBe(true);
  });

  it("rejects invalid EAN values", () => {
    expect(isValidEan("")).toBe(false);
    expect(isValidEan("abc")).toBe(false);
    expect(isValidEan("12345")).toBe(false);
    expect(isValidEan("1234567")).toBe(false);
    expect(isValidEan("3017620422004")).toBe(false);
    expect(isWellFormedEan("3017620422004")).toBe(true);
    expect(isWellFormedEan("12345")).toBe(false);
  });

  it("accepts well-formed 8 and 12 digit codes with a valid checksum", () => {
    expect(isValidEan("40123455")).toBe(true);
    expect(isValidEan("012345678905")).toBe(true);
    expect(isValidEan("40123454")).toBe(false);
  });
});

describe("pickDetectedCode", () => {
  it("prefers checksum-valid codes from the detector", () => {
    expect(pickDetectedCode(NUTELLA)).toBe(NUTELLA);
    expect(pickDetectedCode(" 3017620422003 ")).toBe(NUTELLA);
    expect(pickDetectedCode("nope")).toBeNull();
  });
});

describe("mapOffProduct", () => {
  it("maps OFF nutriments per 100g to kcal/prot/carb/fat/fib", () => {
    const draft = mapOffProduct(offNutella, NUTELLA);
    expect(draft).not.toBeNull();
    expect(draft!.name).toBe("Crema de avellanas con cacao");
    expect(draft!.kcal).toBe(539);
    expect(draft!.prot).toBe(6.3);
    expect(draft!.carb).toBe(57.5);
    expect(draft!.fat).toBe(30.9);
    expect(draft!.fib).toBe(0);
    expect(draft!.sug).toBe(56.3);
    expect(draft!.sat).toBe(10.6);
    expect(draft!.sod).toBe(43);
    expect(draft!.base).toBe("g");
    expect(draft!.barcode).toBe(NUTELLA);
    expect(draft!.units).toEqual([{ name: "ración", g: 15 }]);
    expect(foodDraftHasMacros(draft!)).toBe(true);
  });

  it("falls back to kJ when kcal is missing", () => {
    const draft = mapOffProduct(
      {
        status: 1,
        product: {
          product_name: "Agua con gas",
          nutriments: { energy_100g: 1674, proteins_100g: 0, carbohydrates_100g: 0, fat_100g: 0 },
        },
      },
      "0000000000000",
    );
    expect(draft).not.toBeNull();
    expect(draft!.kcal).toBe(400.1);
  });

  it("falls back to kJ per 100 ml on a drink listed only that way", () => {
    // The per-100-ml kJ key sat behind a condition that could only be false by
    // the time it was read, so this came out as a 0 kcal food.
    const draft = mapOffProduct(
      {
        status: 1,
        product: {
          product_name: "Refresco de cola",
          nutriments: { "energy-kj_100ml": 180, proteins_100ml: 0, carbohydrates_100ml: 10.6, fat_100ml: 0 },
        },
      },
      "0000000000000",
    );
    expect(draft).not.toBeNull();
    expect(draft!.kcal).toBe(43);
    expect(draft!.base).toBe("ml");
    expect(draft!.carb).toBe(10.6);
  });

  it("keeps kcal per 100 ml over kJ and marks the food as a liquid", () => {
    const draft = mapOffProduct(
      {
        status: 1,
        product: {
          product_name: "Leche entera",
          nutriments: { "energy-kcal_100ml": 64, proteins_100ml: 3.1, carbohydrates_100ml: 4.7, fat_100ml: 3.6 },
        },
      },
      "0000000000000",
    );
    expect(draft!.kcal).toBe(64);
    expect(draft!.base).toBe("ml");
  });

  it("returns null when the product is missing or status is 0", () => {
    expect(mapOffProduct({ status: 0, status_verbose: "product not found" }, NUTELLA)).toBeNull();
    expect(mapOffProduct({ status: 1 }, NUTELLA)).toBeNull();
    expect(mapOffProduct(null, NUTELLA)).toBeNull();
    expect(mapOffProduct("nope", NUTELLA)).toBeNull();
  });

  it("reads numeric strings and prefers 100ml when there is no 100g energy", () => {
    const draft = mapOffProduct(
      {
        status: "1",
        product: {
          product_name: "Leche",
          nutriments: {
            "energy-kcal_100ml": "46",
            proteins_100ml: "3.4",
            carbohydrates_100ml: "4.8",
            fat_100ml: "1.6",
          },
        },
      },
      "8410128000046",
    );
    expect(draft).not.toBeNull();
    expect(draft!.kcal).toBe(46);
    expect(draft!.prot).toBe(3.4);
    expect(draft!.base).toBe("ml");
  });
});

describe("findFoodByBarcode", () => {
  it("matches custom foods by barcode field or by digits in the name", () => {
    const byField = custom({ id: "cf-1", name: "Crema cacao", barcode: NUTELLA });
    const byName = custom({ id: "cf-2", name: `Producto ${NUTELLA}` });
    const other = custom({ id: "cf-3", name: "Yogur" });
    expect(findFoodByBarcode(" 3017 6204 2200 3 ", [other, byField])?.id).toBe("cf-1");
    expect(findFoodByBarcode(NUTELLA, [byName])?.id).toBe("cf-2");
    expect(findFoodByBarcode(NUTELLA, [other])).toBeUndefined();
  });
});

describe("offProductUrl", () => {
  it("builds the public v2 URL without an API key", () => {
    expect(offProductUrl(` ${NUTELLA} `)).toBe(`https://world.openfoodfacts.org/api/v2/product/${NUTELLA}.json`);
  });
});

describe("decodeBarcodeZXing", () => {
  // ZXing decodifica píxeles de verdad, así que no se puede probar de forma
  // significativa aquí sin un canvas real (jsdom no lo tiene) — la
  // decodificación de una imagen real se verifica en navegador, no en este
  // archivo. Lo que sí se puede fijar sin eso es el contrato: qué hace esta
  // función con lo que el lector le devuelve o le lanza.
  beforeEach(() => {
    vi.resetModules();
  });

  it("pasa el texto decodificado por pickDetectedCode, no lo devuelve tal cual", async () => {
    vi.doMock("@zxing/browser", () => ({
      BrowserMultiFormatReader: class {
        decode() {
          // Con espacios y guiones, como puede venir de un lector real —
          // pickDetectedCode es quien limpia esto, no decodeBarcodeZXing.
          return { getText: () => "3017 6204 2200-3" };
        }
      },
    }));
    const { decodeBarcodeZXing } = await import("./barcode");
    const el = {} as HTMLImageElement;
    await expect(decodeBarcodeZXing(el)).resolves.toBe("3017620422003");
  });

  it("un código con formato de EAN pero checksum inválido no se descarta: pickDetectedCode ya lo acepta como 'bien formado'", async () => {
    vi.doMock("@zxing/browser", () => ({
      BrowserMultiFormatReader: class {
        decode() {
          return { getText: () => "1111111111111" };
        }
      },
    }));
    const { decodeBarcodeZXing } = await import("./barcode");
    await expect(decodeBarcodeZXing({} as HTMLImageElement)).resolves.toBe("1111111111111");
  });

  it("un texto que no tiene forma de EAN/UPC se descarta", async () => {
    vi.doMock("@zxing/browser", () => ({
      BrowserMultiFormatReader: class {
        decode() {
          return { getText: () => "https://ejemplo.com" }; // un QR, por ejemplo
        }
      },
    }));
    const { decodeBarcodeZXing } = await import("./barcode");
    await expect(decodeBarcodeZXing({} as HTMLImageElement)).resolves.toBeNull();
  });

  it("no encontrar nada en un fotograma es null, no un error que haya que capturar fuera", async () => {
    vi.doMock("@zxing/browser", () => ({
      BrowserMultiFormatReader: class {
        decode() {
          throw new Error("NotFoundException");
        }
      },
    }));
    const { decodeBarcodeZXing } = await import("./barcode");
    await expect(decodeBarcodeZXing({} as HTMLVideoElement)).resolves.toBeNull();
  });

  it("memoriza el lector: el import dinámico solo se paga una vez", async () => {
    let constructed = 0;
    vi.doMock("@zxing/browser", () => ({
      BrowserMultiFormatReader: class {
        constructor() {
          constructed += 1;
        }
        decode() {
          return { getText: () => "3017620422003" };
        }
      },
    }));
    const { decodeBarcodeZXing } = await import("./barcode");
    await decodeBarcodeZXing({} as HTMLImageElement);
    await decodeBarcodeZXing({} as HTMLVideoElement);
    await decodeBarcodeZXing({} as HTMLImageElement);
    expect(constructed).toBe(1);
  });
});

describe("búsqueda en Open Food Facts por nombre", () => {
  function producto(over: Record<string, unknown> = {}) {
    return {
      code: "8410128750121",
      product_name: "Garbanzos cocidos",
      nutriments: { "energy-kcal_100g": 120, proteins_100g: 7, carbohydrates_100g: 16, fat_100g: 2.5 },
      ...over,
    };
  }

  it("pide solo los campos que se usan", () => {
    const url = new URL(offSearchUrl("garbanzos"));
    expect(url.searchParams.get("search_terms")).toBe("garbanzos");
    expect(url.searchParams.get("json")).toBe("1");
    // La respuesta completa de OFF ronda cientos de kB por producto.
    expect(url.searchParams.get("fields")).toContain("nutriments");
    expect(url.searchParams.get("fields")).not.toContain("images");
  });

  it("escapa la consulta", () => {
    const url = new URL(offSearchUrl("queso & jamón"));
    expect(url.searchParams.get("search_terms")).toBe("queso & jamón");
  });

  it("mapea los resultados con el mismo mapeo que el código de barras", () => {
    const hits = mapOffSearch({ products: [producto()] });
    expect(hits).toHaveLength(1);
    expect(hits[0].name).toBe("Garbanzos cocidos");
    expect(hits[0].kcal).toBe(120);
    expect(hits[0].barcode).toBe("8410128750121");
  });

  it("prefiere el nombre en español, como el escáner", () => {
    const hits = mapOffSearch({ products: [producto({ product_name_es: "Garbanzos de bote" })] });
    expect(hits[0].name).toBe("Garbanzos de bote");
  });

  it("hereda la conversión de kJ y el sodio a partir de la sal", () => {
    const hits = mapOffSearch({
      products: [producto({ nutriments: { "energy-kj_100g": 418.4, proteins_100g: 7, salt_100g: 1 } })],
    });
    expect(hits[0].kcal).toBe(100);
    expect(hits[0].sod).toBe(400);
  });

  it("descarta lo que no se puede registrar", () => {
    const hits = mapOffSearch({
      products: [
        producto({ nutriments: {} }), // sin macros
        producto({ code: "111", product_name: "" }), // sin nombre real
        producto(),
      ],
    });
    expect(hits.map((h) => h.name)).toEqual(["Garbanzos cocidos"]);
  });

  it("quita duplicados por código", () => {
    expect(mapOffSearch({ products: [producto(), producto()] })).toHaveLength(1);
  });

  it("respeta el límite", () => {
    const muchos = Array.from({ length: 30 }, (_, i) => producto({ code: `840012375012${i}` }));
    expect(mapOffSearch({ products: muchos }, 5)).toHaveLength(5);
  });

  it("no se rompe con una respuesta rara", () => {
    expect(mapOffSearch(null)).toEqual([]);
    expect(mapOffSearch({})).toEqual([]);
    expect(mapOffSearch({ products: "no soy una lista" })).toEqual([]);
    expect(mapOffSearch({ products: [null, 3, "x"] })).toEqual([]);
  });

  it("aborta a los 8 s, como la consulta por código", async () => {
    const fetchImpl = ((_u: string, init?: RequestInit) =>
      new Promise((_res, rej) => {
        init?.signal?.addEventListener("abort", () => rej(new Error("abortada")));
      })) as unknown as typeof fetch;
    vi.useFakeTimers();
    const p = fetchOffSearch("garbanzos", fetchImpl);
    const assertion = expect(p).rejects.toThrow("abortada");
    await vi.advanceTimersByTimeAsync(8000);
    await assertion;
    vi.useRealTimers();
  });

  it("una respuesta no-ok es un error, no una lista vacía", async () => {
    const fetchImpl = (async () => new Response("", { status: 503 })) as unknown as typeof fetch;
    await expect(fetchOffSearch("x", fetchImpl)).rejects.toThrow("off 503");
  });
});
