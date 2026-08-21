import { nf, round } from "./format";

export type UnitSystem = "met" | "imp";

export function kgToDisplay(kg: number, units: UnitSystem): number {
  return units === "imp" ? round(kg * 2.20462, 1) : round(kg, 1);
}

export function displayToKg(v: number, units: UnitSystem): number {
  return units === "imp" ? round(v / 2.20462, 2) : round(v, 2);
}

export function cmToDisplay(cm: number, units: UnitSystem): number {
  return units === "imp" ? round(cm / 2.54, 1) : Math.round(cm);
}

export function displayToCm(v: number, units: UnitSystem): number {
  return units === "imp" ? round(v * 2.54, 1) : Math.round(v);
}

export function mlToDisplay(ml: number, units: UnitSystem): number {
  return units === "imp" ? round(ml / 29.5735, 1) : Math.round(ml);
}

export function displayToMl(v: number, units: UnitSystem): number {
  return units === "imp" ? Math.round(v * 29.5735) : Math.round(v);
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

/** Imperial height as 5'9", metric as 175 cm. */
export function fmtHeight(cm: number, units: UnitSystem): string {
  if (units !== "imp") return `${Math.round(cm)} cm`;
  const totalIn = Math.max(0, Math.round(cm / 2.54));
  const ft = Math.floor(totalIn / 12);
  const inches = totalIn % 12;
  return `${ft}'${inches}"`;
}
