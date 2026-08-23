import { allSessions } from "./workouts";
import { measureChanges } from "./measures";
import type { SelectorState } from "./types";

export type AchievementGroup = "racha" | "constancia" | "actividad" | "peso" | "cocina";

export type Achievement = {
  id: string;
  n: string;
  /** Qué hace falta para conseguirlo, en una línea. */
  hint: string;
  group: AchievementGroup;
  done: boolean;
  /**
   * Cuánto llevas de lo que hace falta, para los que se cuentan. null en los
   * que se consiguen de una vez (crear tu primera receta), donde una barra de
   * 0/1 no diría nada que no diga ya el propio nombre.
   */
  at: number | null;
  of: number | null;
};

export const GROUP_NAMES: Record<AchievementGroup, string> = {
  racha: "Racha",
  constancia: "Constancia",
  actividad: "Actividad",
  peso: "Peso y cuerpo",
  cocina: "Cocina",
};

/**
 * Cuántos días distintos tienen alguna comida registrada.
 *
 * Cuenta días, no comidas: el logro es haber vuelto, no haber apuntado mucho
 * un día suelto.
 */
export function daysLogged(s: Pick<SelectorState, "days">): number {
  let n = 0;
  for (const d of Object.values(s.days)) {
    if (Object.values(d.meals).some((m) => m.length > 0)) n += 1;
  }
  return n;
}

function counted(
  id: string,
  n: string,
  hint: string,
  group: AchievementGroup,
  at: number,
  of: number,
): Achievement {
  return { id, n, hint, group, at, of, done: at >= of };
}

function once(id: string, n: string, hint: string, group: AchievementGroup, done: boolean): Achievement {
  return { id, n, hint, group, at: null, of: null, done };
}

/**
 * Los logros de la app, calculados enteros a partir de lo que ya hay guardado.
 *
 * No se persiste nada a propósito: un logro es una lectura de tus datos, no un
 * dato nuevo. Así no hay nada que migrar, nada que se pueda desincronizar, y
 * restaurar una copia de seguridad devuelve también los logros que tocan.
 *
 * `streak` se recibe hecho en vez de calcularlo aquí porque `currentStreak`
 * recorre hasta 400 días hacia atrás, y las pantallas que muestran logros ya
 * lo tienen calculado para otra cosa.
 */
export function achievements(s: SelectorState, streak: number): Achievement[] {
  const days = daysLogged(s);
  const sessions = allSessions(s).length;
  const measured = measureChanges(s.weights).length;
  const weights = [...s.weights].sort((a, b) => (a.date < b.date ? -1 : 1));
  const first = weights[0];
  const last = weights[weights.length - 1];

  // Progreso hacia la meta de peso, en la dirección que sea: quien quiere
  // ganar peso también avanza, y un logro que solo contase kilos perdidos no
  // valdría para la mitad de la app.
  const goal = s.goals.weight;
  let towardGoal = 0;
  if (first && last && goal > 0) {
    const started = Math.abs(first.kg - goal);
    const now = Math.abs(last.kg - goal);
    towardGoal = Math.max(0, started - now);
  }

  return [
    counted("racha-3", "Tres seguidos", "3 días seguidos cumpliendo objetivos", "racha", streak, 3),
    counted("racha-7", "Una semana", "7 días seguidos cumpliendo objetivos", "racha", streak, 7),
    counted("racha-14", "Dos semanas", "14 días seguidos cumpliendo objetivos", "racha", streak, 14),
    counted("racha-30", "Un mes entero", "30 días seguidos cumpliendo objetivos", "racha", streak, 30),

    counted("dias-7", "Primera semana", "Registra comida 7 días", "constancia", days, 7),
    counted("dias-30", "Un mes de registro", "Registra comida 30 días", "constancia", days, 30),
    counted("dias-100", "Cien días", "Registra comida 100 días", "constancia", days, 100),

    counted("entrenos-10", "Diez sesiones", "Registra 10 entrenos", "actividad", sessions, 10),
    counted("entrenos-50", "Cincuenta sesiones", "Registra 50 entrenos", "actividad", sessions, 50),
    counted("entrenos-100", "Cien sesiones", "Registra 100 entrenos", "actividad", sessions, 100),

    counted("pesajes-10", "Diez pesajes", "Pésate 10 veces", "peso", s.weights.length, 10),
    counted("peso-1", "Primer kilo", "1 kg más cerca de tu meta", "peso", Math.floor(towardGoal), 1),
    counted("peso-5", "Cinco kilos", "5 kg más cerca de tu meta", "peso", Math.floor(towardGoal), 5),
    once("medidas-1", "Cinta métrica", "Apunta una medida corporal", "peso", measured > 0),

    once("receta-1", "Receta propia", "Crea una receta tuya", "cocina", s.recipes.length > 0),
    counted("recetas-5", "Recetario", "Crea 5 recetas tuyas", "cocina", s.recipes.length, 5),
    once("alimento-1", "Alimento propio", "Crea un alimento tuyo", "cocina", s.customFoods.length > 0),
  ];
}

export function achievementsDone(list: Achievement[]): number {
  return list.filter((a) => a.done).length;
}

/**
 * Los que están más cerca de caer, para enseñar solo unos pocos.
 *
 * Ordena por fracción completada y no por lo que falta en bruto: «te faltan 2»
 * no es igual de cerca en un logro de 3 que en uno de 100. Los que aún no han
 * empezado quedan al final, que es donde ayudan menos.
 */
export function nextAchievements(list: Achievement[], limit = 3): Achievement[] {
  return list
    .filter((a) => !a.done)
    .map((a) => ({ a, frac: a.of != null && a.of > 0 ? (a.at ?? 0) / a.of : 0 }))
    .sort((x, y) => y.frac - x.frac)
    .slice(0, limit)
    .map((x) => x.a);
}
