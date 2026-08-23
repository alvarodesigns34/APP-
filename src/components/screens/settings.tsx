import { useRef, useState, type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Card, Screen, SectionLabel, Title } from "@/components/brio/section";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  ACTIVITY_FACTORS,
  MACRO_PRESETS,
  PURPOSES,
  bmi,
  bmiCategory,
  clampMacroPct,
  computeGoals,
  kcalFloor,
  macrosFromKcal,
  pctForPreset,
} from "@/lib/brio/domain";
import {
  APP_NAME,
  APP_VERSION,
  FASTING_PRESETS,
  type ActivityId,
  type FastingId,
  type MacroPresetId,
  type PurposeId,
  type ReminderSettings,
  type Sex,
  type ThemePref,
  type WeekdayPlan,
} from "@/lib/brio/types";
import { ACCENTS, accentName } from "@/lib/brio/accent";
import { useBrioStore } from "@/lib/brio/store";
import { clockToMinutes, minutesToClock } from "@/lib/brio/dates";
import { combinedCsv } from "@/lib/brio/export-csv";
import { nf, parseNum } from "@/lib/brio/format";
import { DEFAULT_WEEKDAY_PLAN, MIN_DAY_KCAL, kcalForWeekday } from "@/lib/brio/weekday-goals";
import { formatBackupPreview, previewBackup, type BackupPreview } from "@/lib/brio/backup-preview";
import { useUndoList } from "@/lib/brio/undo";
import {
  cmToDisplay,
  displayToCm,
  displayToKg,
  displayToMl,
  fmtHeight,
  heightUnit,
  kgToDisplay,
  mlToDisplay,
  volumeUnit,
  weightUnit,
  type UnitSystem,
} from "@/lib/brio/units";
import { cn } from "@/lib/utils";

type GoalKey = "kcal" | "prot" | "fib" | "steps" | "water" | "weight" | "sleep" | "activityMin";

/** Lower bounds applied when a goal field loses focus. */
const GOAL_MIN: Partial<Record<GoalKey, number>> = {
  kcal: MIN_DAY_KCAL,
  prot: 0,
  fib: 0,
  steps: 0,
  water: 0,
  weight: 1,
  sleep: 0,
  activityMin: 0,
};

/**
 * Every editable goal, with its own display conversion.
 *
 * The weight, sleep and weekly-exercise targets used to be unreachable from
 * here even though all three are shown as goals elsewhere — the weight target
 * could only move by pressing "Recalcular", and sleep and exercise not at all.
 * Sleep is stored in minutes but asked for in hours, which is how people think
 * about it.
 */
const GOAL_FIELDS: {
  key: GoalKey;
  label: (u: UnitSystem) => string;
  toDisplay: (v: number, u: UnitSystem) => number;
  toStore: (v: number, u: UnitSystem) => number;
}[] = [
  { key: "kcal", label: () => "Calorías (kcal)", toDisplay: (v) => v, toStore: (v) => Math.round(v) },
  { key: "prot", label: () => "Proteína (g)", toDisplay: (v) => v, toStore: (v) => Math.round(v) },
  { key: "fib", label: () => "Fibra (g)", toDisplay: (v) => v, toStore: (v) => Math.round(v) },
  { key: "steps", label: () => "Pasos", toDisplay: (v) => v, toStore: (v) => Math.round(v) },
  {
    key: "water",
    label: (u) => `Agua (${volumeUnit(u)})`,
    toDisplay: (v, u) => mlToDisplay(v, u),
    toStore: (v, u) => displayToMl(v, u),
  },
  {
    key: "weight",
    label: (u) => `Peso objetivo (${weightUnit(u)})`,
    toDisplay: (v, u) => kgToDisplay(v, u),
    toStore: (v, u) => displayToKg(v, u),
  },
  {
    key: "sleep",
    label: () => "Sueño (horas)",
    toDisplay: (v) => Math.round((v / 60) * 10) / 10,
    toStore: (v) => Math.round(v * 60),
  },
  { key: "activityMin", label: () => "Ejercicio a la semana (min)", toDisplay: (v) => v, toStore: (v) => Math.round(v) },
];

/**
 * Descarga un blob y suelta la url.
 *
 * Sin el `revokeObjectURL`, cada exportación deja una copia entera del estado
 * viva en memoria hasta que se recargue el documento — y esto es una PWA que
 * se queda abierta días. Con un histórico largo son varios MB por pulsación.
 */
function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  // En el mismo turno el navegador aún no ha empezado a leer la url.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function SettingsScreen() {
  const profile = useBrioStore((s) => s.profile);
  const settings = useBrioStore((s) => s.settings);
  const goals = useBrioStore((s) => s.goals);
  const patchProfile = useBrioStore((s) => s.patchProfile);
  const patchGoals = useBrioStore((s) => s.patchGoals);
  const patchSettings = useBrioStore((s) => s.patchSettings);
  const importAll = useBrioStore((s) => s.importAll);
  const resetAll = useBrioStore((s) => s.resetAll);
  const undoLast = useBrioStore((s) => s.undoLast);
  const undoList = useUndoList();
  const exportSlice = useBrioStore(
    useShallow((s) => ({
      schema: s.schema,
      onboarded: s.onboarded,
      profile: s.profile,
      settings: s.settings,
      goals: s.goals,
      days: s.days,
      weights: s.weights,
      customFoods: s.customFoods,
      recipes: s.recipes,
      favorites: s.favorites,
      favRecipes: s.favRecipes,
      pantry: s.pantry,
      recents: s.recents,
      shopping: s.shopping,
    })),
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const units = settings.units;
  const activeFasting = FASTING_PRESETS.find((p) => p.id === settings.fasting && p.id !== "off");
  const b = bmi(profile.weight, profile.height);
  const cat = bmiCategory(b);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<BackupPreview | null>(null);
  const [importRaw, setImportRaw] = useState<unknown>(null);

  function recalc() {
    const g = computeGoals({ ...profile, pct: settings.macroPct });
    // Deliberately not `weight`. computeGoals derives it as current × 0.95, and
    // every weigh-in writes profile.weight, so recalculating after losing any
    // weight moved the target down again — a goal you could never reach. It is
    // a personal target, editable directly above.
    patchGoals({
      kcal: g.kcal,
      prot: g.prot,
      carb: g.carb,
      fat: g.fat,
      fib: g.fib,
      water: g.water,
    });
    toast.success("Calorías y macros recalculadas");
  }

  function applySplit(preset: MacroPresetId, pct: { prot: number; carb: number; fat: number }) {
    const macros = macrosFromKcal(goals.kcal, pct);
    patchSettings({ macroPreset: preset, macroPct: pct });
    patchGoals({ prot: macros.prot, carb: macros.carb, fat: macros.fat });
  }

  function selectPreset(id: MacroPresetId) {
    const pct = id === "custom" ? settings.macroPct : pctForPreset(id);
    applySplit(id, pct);
  }

  function onCustomPct(field: "prot" | "carb" | "fat", raw: number) {
    applySplit("custom", clampMacroPct({ ...settings.macroPct, [field]: raw }, field));
  }

  const liveMacros = macrosFromKcal(goals.kcal, settings.macroPct);
  const reminders = settings.reminders;
  const weekdayPlan = settings.weekdayPlan ?? DEFAULT_WEEKDAY_PLAN;

  function patchReminders(patch: Partial<ReminderSettings>) {
    patchSettings({ reminders: { ...reminders, ...patch } });
  }

  function patchWeekdayPlan(patch: Partial<WeekdayPlan>) {
    patchSettings({ weekdayPlan: { ...weekdayPlan, ...patch } });
  }

  function toggleTrainingDay(jsDay: number) {
    const training = weekdayPlan.training.map((v, i) => (i === jsDay ? !v : v));
    patchWeekdayPlan({ training });
  }

  async function onToggleReminders(v: boolean) {
    if (!v) {
      patchReminders({ enabled: false });
      return;
    }
    if (typeof Notification === "undefined") {
      toast.error("Sin permiso de notificaciones");
      return;
    }
    let perm: NotificationPermission = Notification.permission;
    try {
      perm = await Notification.requestPermission();
    } catch {
      toast.error("Sin permiso de notificaciones");
      return;
    }
    if (perm !== "granted") {
      toast.error("Sin permiso de notificaciones");
      return;
    }
    patchReminders({ enabled: true });
  }

  function onReminderTime(field: "desayuno" | "comida" | "cena" | "peso" | "streakTime", raw: string) {
    const v = raw.slice(0, 5);
    if (!v) return;
    patchReminders({ [field]: v });
  }

  return (
    <Screen>
      <Title sub={`${APP_NAME} ${APP_VERSION}`}>Ajustes</Title>

      <SectionLabel>Perfil</SectionLabel>
      <Card className="space-y-3">
        <Field label="Nombre">
          <Input value={profile.name} onChange={(e) => patchProfile({ name: e.target.value })} />
        </Field>
        <Field label="Fecha de nacimiento">
          <Input type="date" value={profile.birth} onChange={(e) => patchProfile({ birth: e.target.value })} />
        </Field>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["h", "Hombre"],
              ["m", "Mujer"],
              ["nb", "Otro"],
            ] as const
          ).map(([id, n]) => (
            <button
              key={id}
              type="button"
              onClick={() => patchProfile({ sex: id as Sex })}
              className={cn(
                "h-10 rounded-xl text-xs",
                profile.sex === id ? "bg-primary text-primary-foreground" : "bg-muted",
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label={`Altura ${heightUnit(units)}`}>
            <NumField
              value={cmToDisplay(profile.height, units)}
              min={1}
              onCommit={(n) => patchProfile({ height: displayToCm(n, units) })}
            />
          </Field>
          <Field label={`Peso ${weightUnit(units)}`}>
            <NumField
              value={kgToDisplay(profile.weight, units)}
              min={1}
              onCommit={(n) => patchProfile({ weight: displayToKg(n, units) })}
            />
          </Field>
        </div>
        <p className="text-xs text-muted-foreground">
          IMC {nf(b, 1)} · {cat.n}
          {units === "imp" ? ` · ${fmtHeight(profile.height, "imp")}` : ""}
        </p>
      </Card>

      <SectionLabel>Actividad y propósito</SectionLabel>
      <Card className="space-y-2">
        {ACTIVITY_FACTORS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => patchProfile({ activity: a.id as ActivityId })}
            className={cn(
              "flex min-h-11 w-full items-center rounded-2xl px-3 py-2 text-left text-sm",
              profile.activity === a.id ? "bg-primary/10 text-primary" : "bg-muted/40",
            )}
          >
            {a.n}
          </button>
        ))}
        <div className="grid grid-cols-2 gap-2 pt-2">
          {PURPOSES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => patchProfile({ purpose: p.id as PurposeId })}
              className={cn(
                "h-10 rounded-xl text-xs",
                profile.purpose === p.id ? "bg-primary text-primary-foreground" : "bg-muted",
              )}
            >
              {p.n}
            </button>
          ))}
        </div>
      </Card>

      <SectionLabel>Objetivos</SectionLabel>
      <Card className="space-y-2">
        {GOAL_FIELDS.map((f) => (
          <Field key={f.key} label={f.label(units)}>
            <NumField
              value={f.toDisplay(goals[f.key], units)}
              min={GOAL_MIN[f.key]}
              onCommit={(n) => patchGoals({ [f.key]: f.toStore(n, units) })}
            />
          </Field>
        ))}
        {/* This is the switch that most changes the daily calorie number, and it
            used to live at the bottom of the "Apariencia" card, where it read as
            a display setting. The caveat now shows whether or not it is on —
            before, the warning only appeared once the damage was done. */}
        <label className="flex items-center justify-between gap-3 border-t border-border pt-3 text-sm">
          Sumar kcal de actividad al objetivo
          <Switch checked={settings.activityAdjust} onCheckedChange={(v) => patchSettings({ activityAdjust: v })} />
        </label>
        {profile.activity !== "sed" ? (
          <p className="text-xs text-muted-foreground">
            Tu nivel de actividad ya cuenta el movimiento habitual. Si activas esto, los entrenos y los pasos de hoy se
            suman otra vez.
          </p>
        ) : null}
        <p className="pt-1 text-xs text-muted-foreground">
          El objetivo de calorías no baja de {nf(GOAL_MIN.kcal)} kcal. Consulta a un profesional antes de fijar un
          objetivo agresivo.
        </p>
        <div className="pt-1">
          <p className="mb-2 text-sm text-muted-foreground">Reparto de macros</p>
          <div className="flex flex-wrap gap-2">
            {MACRO_PRESETS.map((p) => (
              <Button
                key={p.id}
                size="sm"
                variant={settings.macroPreset === p.id ? "default" : "secondary"}
                onClick={() => selectPreset(p.id)}
              >
                {p.n}
              </Button>
            ))}
          </div>
        </div>
        {settings.macroPreset === "custom" ? (
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["prot", "Prot %"],
                ["carb", "Carb %"],
                ["fat", "Grasa %"],
              ] as const
            ).map(([k, n]) => (
              <Field key={k} label={n}>
                {/* El mismo `NumField` que el resto de la pantalla, y por la
                    misma razón. Con el `value` atado al store y un
                    `parseNum(...) || 0` por tecla, seleccionar el campo y
                    borrarlo no lo dejaba vacío: ponía un 0, recalculaba los
                    otros dos macros al vuelo y luego escribir "4" se leía
                    "04". Y cada pulsación era un patchGoals + patchSettings,
                    o sea una escritura a localStorage por tecla. */}
                <NumField
                  inputMode="numeric"
                  min={0}
                  max={100}
                  value={settings.macroPct[k]}
                  onCommit={(v) => onCustomPct(k, v)}
                />
                <span className="mt-1 block text-xs text-muted-foreground">{liveMacros[k]} g</span>
              </Field>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {liveMacros.prot} g prot · {liveMacros.carb} g carb · {liveMacros.fat} g grasa
          </p>
        )}
        <Button className="w-full" variant="secondary" onClick={recalc}>
          Recalcular desde el perfil
        </Button>
      </Card>

      <SectionLabel>Ayuno</SectionLabel>
      <Card className="space-y-3">
        <p className="text-sm text-muted-foreground">Ventana de comida opcional. Se muestra en Hoy.</p>
        <div className="flex flex-wrap gap-2">
          {FASTING_PRESETS.map((p) => (
            <Button
              key={p.id}
              size="sm"
              variant={settings.fasting === p.id ? "default" : "secondary"}
              onClick={() => patchSettings({ fasting: p.id as FastingId })}
            >
              {p.n}
            </Button>
          ))}
        </div>
        {activeFasting ? (
          <>
            {/* The presets used to fix WHEN you eat, not just how long the
                window is — 16:8 was always 12:00-20:00. Someone eating
                14:00-22:00 (normal in Spain) could not represent that, so the
                start is editable and the window just keeps its length. */}
            <Field label="Empieza a comer a las">
              <Input
                type="time"
                value={minutesToClock(settings.fastingStart)}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  patchSettings({ fastingStart: clockToMinutes(v) });
                }}
              />
            </Field>
            <p className="text-xs text-muted-foreground">
              {activeFasting.n} · come de {minutesToClock(settings.fastingStart)} a{" "}
              {minutesToClock((settings.fastingStart + (activeFasting.end - activeFasting.start)) % 1440)}.
            </p>
          </>
        ) : null}
      </Card>

      <SectionLabel>Unidades</SectionLabel>
      <Card className="space-y-3">
        <div className="flex gap-2">
          {(["met", "imp"] as UnitSystem[]).map((u) => (
            <Button
              key={u}
              variant={units === u ? "default" : "secondary"}
              size="sm"
              onClick={() => patchSettings({ units: u })}
            >
              {u === "met" ? "Métrico" : "Imperial"}
            </Button>
          ))}
        </div>
        <Field label={`Tamaño del vaso (${volumeUnit(units)})`}>
          <NumField
            value={mlToDisplay(settings.glass, units)}
            min={1}
            onCommit={(n) => patchSettings({ glass: displayToMl(n, units) })}
          />
        </Field>
        <label className="flex items-center justify-between gap-3 text-sm">
          Tengo básicos de despensa
          <Switch checked={settings.pantryBasics} onCheckedChange={(v) => patchSettings({ pantryBasics: v })} />
        </label>
      </Card>

      <SectionLabel>Apariencia</SectionLabel>
      <Card className="space-y-4">
        <div>
          <p className="mb-2 text-sm font-medium">Tema</p>
          <div className="flex gap-2">
            {(["auto", "light", "dark"] as ThemePref[]).map((t) => (
              <Button
                key={t}
                variant={settings.theme === t ? "default" : "secondary"}
                size="sm"
                onClick={() => patchSettings({ theme: t })}
              >
                {t === "auto" ? "Auto" : t === "light" ? "Claro" : "Oscuro"}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">
            Color principal <span className="text-muted-foreground">· {accentName(settings.accent)}</span>
          </p>
          {/* Each swatch carries its own `data-accent`, so the CSS in styles.css
              paints it with that palette's own `--brio-primary` — in whichever
              theme is active. The colour values therefore live in exactly one
              place, and the preview cannot drift from what picking it does. */}
          <div className="grid grid-cols-4 gap-2">
            {ACCENTS.map((a) => {
              const on = settings.accent === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  data-accent={a.id}
                  aria-pressed={on}
                  aria-label={`Color ${a.n}`}
                  onClick={() => patchSettings({ accent: a.id })}
                  className="flex min-h-11 flex-col items-center gap-1 rounded-xl py-1"
                >
                  <span
                    className={cn(
                      "grid size-8 place-items-center rounded-full bg-primary transition-transform",
                      on && "ring-2 ring-primary ring-offset-2 ring-offset-card",
                    )}
                  >
                    {on ? <Check className="size-4 text-primary-foreground" /> : null}
                  </span>
                  <span className={cn("text-[10px]", on ? "font-medium text-foreground" : "text-muted-foreground")}>
                    {a.n}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      <SectionLabel>Objetivos por día</SectionLabel>
      <Card className="space-y-3">
        <label className="flex items-center justify-between gap-3 text-sm">
          Distinguir días de entreno y de descanso
          <Switch checked={weekdayPlan.enabled} onCheckedChange={(v) => patchWeekdayPlan({ enabled: v })} />
        </label>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["L", 1],
              ["M", 2],
              ["X", 3],
              ["J", 4],
              ["V", 5],
              ["S", 6],
              ["D", 0],
            ] as const
          ).map(([label, day]) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleTrainingDay(day)}
              className={cn(
                "min-h-11 min-w-11 rounded-xl px-2 text-xs font-medium",
                weekdayPlan.training[day] ? "bg-primary text-primary-foreground" : "bg-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {weekdayPlan.enabled ? (
          <p className="text-sm text-muted-foreground">
            Lunes {kcalForWeekday(goals.kcal, weekdayPlan.training, 1, kcalFloor(profile.sex))} kcal · Domingo{" "}
            {kcalForWeekday(goals.kcal, weekdayPlan.training, 0, kcalFloor(profile.sex))} kcal
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {weekdayPlan.enabled
            ? "La media de la semana sigue siendo tu objetivo. Las kcal de actividad se siguen sumando si lo tienes activado."
            : "Actívalo para repartir tu objetivo entre días de entreno y de descanso."}
        </p>
      </Card>

      <SectionLabel>Recordatorios</SectionLabel>
      <Card className="space-y-3">
        <label className="flex items-center justify-between gap-3 text-sm">
          Activar recordatorios
          <Switch checked={reminders.enabled} onCheckedChange={(v) => void onToggleReminders(v)} />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          Comidas
          <Switch checked={reminders.meals} onCheckedChange={(v) => patchReminders({ meals: v })} />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          Agua
          <Switch checked={reminders.water} onCheckedChange={(v) => patchReminders({ water: v })} />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          Peso
          <Switch checked={reminders.weight} onCheckedChange={(v) => patchReminders({ weight: v })} />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          Racha en riesgo
          <Switch checked={reminders.streak} onCheckedChange={(v) => patchReminders({ streak: v })} />
        </label>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Desayuno">
            <Input
              type="time"
              value={reminders.desayuno}
              onChange={(e) => onReminderTime("desayuno", e.target.value)}
            />
          </Field>
          <Field label="Comida">
            <Input type="time" value={reminders.comida} onChange={(e) => onReminderTime("comida", e.target.value)} />
          </Field>
          <Field label="Cena">
            <Input type="time" value={reminders.cena} onChange={(e) => onReminderTime("cena", e.target.value)} />
          </Field>
        </div>
        <Field label="Peso">
          <Input type="time" value={reminders.peso} onChange={(e) => onReminderTime("peso", e.target.value)} />
        </Field>
        <Field label="Racha en riesgo">
          <Input
            type="time"
            value={reminders.streakTime}
            onChange={(e) => onReminderTime("streakTime", e.target.value)}
          />
        </Field>
        <Field label="Avisar agua cada (min)">
          <NumField
            inputMode="numeric"
            value={reminders.aguaEveryMin}
            min={30}
            max={360}
            onCommit={(n) => patchReminders({ aguaEveryMin: Math.round(n) })}
          />
        </Field>
        <p className="text-xs text-muted-foreground">
          Los avisos salen en este dispositivo, sin cuenta. Necesitan la app abierta o recién cerrada: si la cierras
          del todo, sobre todo en iPhone, pueden no sonar hasta que la abras de nuevo.
        </p>
      </Card>

      <SectionLabel>Últimas acciones</SectionLabel>
      <Card className="space-y-2">
        {undoList.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay nada que deshacer.</p>
        ) : (
          <>
            <Button variant="secondary" className="w-full" onClick={undoLast}>
              Deshacer: {undoList[0]}
            </Button>
            {undoList.length > 1 ? (
              <ul className="space-y-1 px-1 text-xs text-muted-foreground">
                {undoList.slice(1, 6).map((label, i) => (
                  <li key={i} className="truncate">
                    {label}
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </Card>

      <SectionLabel>Datos</SectionLabel>
      <Card className="space-y-2">
        <Button
          variant="secondary"
          className="w-full"
          onClick={() =>
            download(
              new Blob([JSON.stringify(exportSlice, null, 2)], { type: "application/json" }),
              `brio-${new Date().toISOString().slice(0, 10)}.json`,
            )
          }
        >
          Exportar JSON
        </Button>
        <Button
          variant="secondary"
          className="w-full"
          onClick={() =>
            download(
              new Blob([combinedCsv(exportSlice)], { type: "text/csv;charset=utf-8" }),
              `brio-${new Date().toISOString().slice(0, 10)}.csv`,
            )
          }
        >
          Exportar CSV
        </Button>
        <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
          Importar JSON
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            file.text().then((t) => {
              try {
                const raw: unknown = JSON.parse(t);
                const preview = previewBackup(raw);
                setImportRaw(raw);
                setImportPreview(preview);
                setImportOpen(true);
              } catch {
                toast.error("Archivo no válido");
              }
            });
          }}
        />
        <Button variant="destructive" className="w-full" onClick={() => setWipeOpen(true)}>
          Borrar datos locales
        </Button>
      </Card>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        {APP_NAME} no sustituye el consejo de un profesional sanitario.
      </p>
      <ConfirmDialog
        open={importOpen}
        onOpenChange={(v) => {
          setImportOpen(v);
          if (!v) {
            setImportRaw(null);
            setImportPreview(null);
          }
        }}
        title="¿Restaurar esta copia?"
        body={
          <span className="whitespace-pre-line">
            {importPreview ? formatBackupPreview(importPreview) : ""}
          </span>
        }
        confirmLabel="Restaurar"
        destructive
        onConfirm={() => {
          if (importRaw == null) return;
          importAll(importRaw);
          toast.success("Datos importados");
          setImportRaw(null);
          setImportPreview(null);
        }}
      />
      <ConfirmDialog
        open={wipeOpen}
        onOpenChange={setWipeOpen}
        title="¿Borrar todos los datos?"
        body="Se eliminarán comidas, peso, recetas propias y ajustes de este dispositivo. No se puede deshacer."
        confirmLabel="Borrar"
        destructive
        onConfirm={() => {
          resetAll();
          toast.success("Datos borrados");
        }}
      />
    </Screen>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

/**
 * A numeric field you can actually clear and retype.
 *
 * These used to write to the store on every keystroke and bail out on anything
 * that did not parse (`if (!n) return`). With the displayed value controlled
 * from the store, that made the field impossible to empty: backspacing put the
 * old number straight back, so the digits you typed next landed *after* it.
 * Correcting a height of 175 to 180 stored 175180 cm — and height feeds BMI,
 * TDEE and therefore every calorie and macro target in the app.
 *
 * Holding a draft while the field is focused keeps half-typed values local:
 * nothing reaches the store until blur, which also means typing "2200" leaves
 * one undo entry instead of four. Anything unparseable reverts rather than
 * inventing a number.
 */
function NumField({
  value,
  onCommit,
  min,
  max,
  inputMode = "decimal",
}: {
  value: number;
  onCommit: (n: number) => void;
  min?: number;
  max?: number;
  inputMode?: "decimal" | "numeric";
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Input
      inputMode={inputMode}
      value={draft ?? String(value)}
      onFocus={(e) => setDraft(e.target.value)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const raw = draft;
        setDraft(null);
        if (raw == null) return;
        const n = parseNum(raw);
        if (!Number.isFinite(n)) return;
        let next = n;
        if (min != null) next = Math.max(min, next);
        if (max != null) next = Math.min(max, next);
        if (next !== value) onCommit(next);
      }}
    />
  );
}
