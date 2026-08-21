import { describe, expect, it } from "vitest";
import {
  findFoodByBarcode,
  foodDraftHasMacros,
  gs1ChecksumOk,
  isValidEan,
  isWellFormedEan,
  mapOffProduct,
  normalizeEan,
  offProductUrl,
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
