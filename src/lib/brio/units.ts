import { nf, round } from "./format";

export type UnitSystem = "met" | "imp";

export function kgToDisplay(kg: number, units: UnitSystem): number {
  return units === "imp" ? round(kg * 2.20462, 1) : round(kg, 1);
}

export function displayToKg(v: number, units: UnitSystem): number {
  return units === "imp" ? v / 2.20462 : v;
}

export function cmToDisplay(cm: number, units: UnitSystem): number {
  return units === "imp" ? round(cm / 2.54, 1) : Math.round(cm);
}

export function displayToCm(v: number, units: UnitSystem): number {
  return units === "imp" ? v * 2.54 : v;
}

export function mlToDisplay(ml: number, units: UnitSystem): number {
  return units === "imp" ? round(ml / 29.5735, 1) : Math.round(ml);
}

export function displayToMl(v: number, units: UnitSystem): number {
  return units === "imp" ? v * 29.5735 : v;
}

export function weightUnit(units: UnitSystem): string {
  return units === "imp" ? "lb" : "kg";
}

export function heightUnit(units: UnitSystem): string {
  return units === "imp" ? "in" : "cm";
}

export function volumeUnit(units: UnitSystem): string {
  return units === "imp" ? "fl oz" : "ml";
}

export function fmtWeight(kg: number, units: UnitSystem): string {
  return `${nf(kgToDisplay(kg, units), 1)} ${weightUnit(units)}`;
}

export function fmtVolume(ml: number, units: UnitSystem): string {
  return units === "imp" ? `${nf(mlToDisplay(ml, units), 1)} fl oz` : `${nf(ml)} ml`;
}
