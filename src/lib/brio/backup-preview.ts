import { migrate } from "./persist";
import { DATE_KEY } from "./dates";
import { MEALS } from "./types";

export type BackupPreview = {
  name: string;
  days: number;
  meals: number;
  firstDate: string | null;
  lastDate: string | null;
  weights: number;
  customFoods: number;
  recipes: number;
  looksEmpty: boolean;
};

export function previewBackup(raw: unknown): BackupPreview {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("invalid backup");
  }
  const s = migrate(raw);
  let meals = 0;
  const logged: string[] = [];
  for (const [key, day] of Object.entries(s.days)) {
    if (!DATE_KEY.test(key)) continue;
    let n = 0;
    for (const m of MEALS) n += day.meals[m.id].length;
    meals += n;
    const has =
      n > 0 ||
      day.water.length > 0 ||
      day.steps > 0 ||
      day.workouts.length > 0 ||
      !!day.sleep ||
      !!day.note;
    if (has) logged.push(key);
  }
  logged.sort();
  const mealDates = logged.filter((k) => {
    const d = s.days[k];
    if (!d) return false;
    return MEALS.some((m) => d.meals[m.id].length > 0);
  });
  return {
    name: s.profile.name.trim(),
    days: logged.length,
    meals,
    firstDate: mealDates[0] ?? null,
    lastDate: mealDates.length ? mealDates[mealDates.length - 1]! : null,
    weights: s.weights.length,
    customFoods: s.customFoods.length,
    recipes: s.recipes.length,
    looksEmpty: logged.length === 0 && s.weights.length === 0 && s.customFoods.length === 0 && s.recipes.length === 0,
  };
}

function dmy(key: string): string {
  const [y, m, d] = key.split("-");
  return `${Number(d)}/${Number(m)}/${y}`;
}

export function formatBackupPreview(p: BackupPreview): string {
  const lines = ["Esto sustituye los datos de este dispositivo.", ""];
  if (p.looksEmpty) {
    lines.push("Este archivo no tiene comidas ni peso. Igual sustituirá lo que hay ahora.");
    return lines.join("\n");
  }
  const bits: string[] = [];
  if (p.name) bits.push(p.name);
  bits.push(p.days === 1 ? "1 día con registro" : `${p.days} días con registro`);
  lines.push(bits.join(" · ") + ".");
  if (p.firstDate && p.lastDate) {
    lines.push(
      p.firstDate === p.lastDate
        ? `Comidas el ${dmy(p.firstDate)}.`
        : `Comidas del ${dmy(p.firstDate)} al ${dmy(p.lastDate)}.`,
    );
  }
  const extra: string[] = [];
  if (p.weights) extra.push(p.weights === 1 ? "1 pesaje" : `${p.weights} pesajes`);
  if (p.customFoods) extra.push(p.customFoods === 1 ? "1 alimento propio" : `${p.customFoods} alimentos propios`);
  if (p.recipes) extra.push(p.recipes === 1 ? "1 receta" : `${p.recipes} recetas`);
  if (extra.length) lines.push(extra.join(" · ") + ".");
  return lines.join("\n");
}
