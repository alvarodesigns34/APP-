import { describe, expect, it } from "vitest";
import { highlightParts } from "./highlight";

/** Compact view of the split: matched runs wrapped in [brackets]. */
const show = (text: string, q: string) =>
  highlightParts(text, q)
    .map((p) => (p.hit ? `[${p.text}]` : p.text))
    .join("");

/** The parts must always reassemble into the original string, untouched. */
function assertLossless(text: string, q: string) {
  expect(highlightParts(text, q).map((p) => p.text).join("")).toBe(text);
}

describe("highlightParts", () => {
  it("highlights a plain match", () => {
    expect(show("Pollo asado", "pollo")).toBe("[Pollo] asado");
  });

  it("highlights accented text typed without accents, keeping the accents on screen", () => {
    expect(show("Plátano", "platano")).toBe("[Plátano]");
    expect(show("Salmón al limón", "salmon")).toBe("[Salmón] al limón");
    expect(show("Café con leche", "cafe")).toBe("[Café] con leche");
  });

  it("is case-insensitive and preserves the original casing", () => {
    expect(show("Pechuga de POLLO", "pollo")).toBe("Pechuga de [POLLO]");
  });

  it("highlights every word of a multi-word query", () => {
    expect(show("Pollo asado con limón", "pollo limon")).toBe("[Pollo] asado con [limón]");
  });

  it("prefers the longest needle so a short token does not split a longer match", () => {
    expect(show("Pollo asado", "pollo asado")).toBe("[Pollo asado]");
  });

  it("highlights repeated occurrences", () => {
    expect(show("Arroz con arroz", "arroz")).toBe("[Arroz] con [arroz]");
  });

  it("returns the text untouched when nothing matches", () => {
    expect(show("Pollo asado", "zzz")).toBe("Pollo asado");
  });

  it("returns the text untouched for an empty or blank query", () => {
    expect(show("Pollo asado", "")).toBe("Pollo asado");
    expect(show("Pollo asado", "   ")).toBe("Pollo asado");
  });

  it("never loses or reorders characters", () => {
    for (const [text, q] of [
      ["Plátano", "platano"],
      ["Salmón al limón", "salmon limon"],
      ["Arroz con arroz", "arroz"],
      ["Pollo asado", ""],
      ["Pollo asado", "zzz"],
      ["Champiñones", "champinones"],
      ["", "pollo"],
    ] as [string, string][]) {
      assertLossless(text, q);
    }
  });

  it("handles a query longer than the text", () => {
    expect(show("Pan", "pan integral de centeno")).toBe("[Pan]");
  });
});
