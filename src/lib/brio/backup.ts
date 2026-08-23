/**
 * Cuándo fue la última copia de seguridad, y cuándo conviene recordarlo.
 *
 * Todo lo de Brío vive en `localStorage`: no hay cuenta ni servidor, así que
 * borrar los datos del navegador, cambiar de móvil o quedarse sin espacio se
 * lleva meses de registros y no hay forma de recuperarlos. Exportar era un
 * botón escondido en Ajustes que nadie recuerda pulsar.
 *
 * Va en su propia clave, fuera del estado principal, por la misma razón que
 * las preferencias de búsqueda: no es un dato del usuario, es andamiaje de la
 * app, y no tiene sentido que viaje dentro de la copia que describe — al
 * importarla en otro móvil diría que ya hiciste copia cuando ahí no la has
 * hecho nunca.
 */
export const BACKUP_KEY = "brio.backup";

export type BackupState = {
  /** ms epoch de la última exportación, o null si no se ha hecho ninguna. */
  at: number | null;
  /** ms epoch del último "ahora no". */
  snoozed: number | null;
};

export const DEFAULT_BACKUP: BackupState = { at: null, snoozed: null };

const DAY = 86_400_000;
/** Con menos historial que esto no merece la pena dar la lata. */
export const MIN_DAYS_LOGGED = 14;
/** Una copia más vieja que esto se considera vencida. */
export const STALE_DAYS = 30;
/** Un "ahora no" aguanta esto antes de volver a preguntar. */
export const SNOOZE_DAYS = 14;

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function msOrNull(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return null;
  return v;
}

export function parseBackup(raw: unknown): BackupState {
  if (!isObj(raw)) return { ...DEFAULT_BACKUP };
  return { at: msOrNull(raw.at), snoozed: msOrNull(raw.snoozed) };
}

export function loadBackup(): BackupState {
  if (typeof localStorage === "undefined") return { ...DEFAULT_BACKUP };
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    if (!raw) return { ...DEFAULT_BACKUP };
    return parseBackup(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_BACKUP };
  }
}

function save(next: BackupState): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(next));
  } catch {
    // Misma política que search-prefs: quedarse sin cuota aquí no puede
    // reventar una exportación que ya ha funcionado.
  }
}

/** Se llama al exportar, sea JSON o CSV: las dos valen como copia. */
export function markBackupDone(now = Date.now()): void {
  save({ ...loadBackup(), at: now });
}

export function snoozeBackup(now = Date.now()): void {
  save({ ...loadBackup(), snoozed: now });
}

/** Días enteros transcurridos desde la última copia, o null si no hay ninguna. */
export function daysSinceBackup(state: BackupState, now = Date.now()): number | null {
  if (state.at == null) return null;
  return Math.max(0, Math.floor((now - state.at) / DAY));
}

/**
 * Si toca sugerir una copia.
 *
 * Tres condiciones, y las tres tienen que darse: que haya historial que perder,
 * que la última copia esté vencida (o no exista), y que no se haya dicho "ahora
 * no" hace poco. Sin la primera, la app pediría copia a alguien que lleva dos
 * días usándola; sin la tercera, "ahora no" no significaría nada.
 */
export function shouldSuggestBackup(state: BackupState, daysLogged: number, now = Date.now()): boolean {
  if (daysLogged < MIN_DAYS_LOGGED) return false;
  if (state.snoozed != null && now - state.snoozed < SNOOZE_DAYS * DAY) return false;
  if (state.at == null) return true;
  return now - state.at >= STALE_DAYS * DAY;
}
