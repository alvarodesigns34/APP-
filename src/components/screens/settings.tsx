import { useRef, useState, type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { toast } from "sonner";
import { Card, Screen, SectionLabel, Title } from "@/components/brio/section";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ACTIVITY_FACTORS, PURPOSES, bmi, bmiCategory, computeGoals } from "@/lib/brio/domain";
import { APP_NAME, APP_VERSION, FASTING_PRESETS, type ActivityId, type FastingId, type PurposeId, type Sex, type ThemePref } from "@/lib/brio/types";
import { useBrioStore } from "@/lib/brio/store";
import { nf, parseNum } from "@/lib/brio/format";
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

export function SettingsScreen() {
  const profile = useBrioStore((s) => s.profile);
  const settings = useBrioStore((s) => s.settings);
  const goals = useBrioStore((s) => s.goals);
  const patchProfile = useBrioStore((s) => s.patchProfile);
  const patchGoals = useBrioStore((s) => s.patchGoals);
  const patchSettings = useBrioStore((s) => s.patchSettings);
  const importAll = useBrioStore((s) => s.importAll);
  const resetAll = useBrioStore((s) => s.resetAll);
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
    })),
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const units = settings.units;
  const b = bmi(profile.weight, profile.height);
  const cat = bmiCategory(b);
  const [wipeOpen, setWipeOpen] = useState(false);

  function recalc() {
    const g = computeGoals(profile);
    patchGoals({
      kcal: g.kcal,
      prot: g.prot,
      carb: g.carb,
      fat: g.fat,
      water: g.water,
      weight: g.weight,
    });
    toast.success("Objetivos recalculados");
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
          {([["h", "Hombre"], ["m", "Mujer"], ["nb", "Otro"]] as const).map(([id, n]) => (
            <button
              key={id}
              type="button"
              onClick={() => patchProfile({ sex: id as Sex })}
              className={cn("h-10 rounded-xl text-xs", profile.sex === id ? "bg-primary text-primary-foreground" : "bg-muted")}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label={`Altura ${heightUnit(units)}`}>
            <Input
              inputMode="decimal"
              value={cmToDisplay(profile.height, units)}
              onChange={(e) => {
                const n = parseNum(e.target.value);
                if (!n) return;
                patchProfile({ height: displayToCm(n, units) });
              }}
            />
          </Field>
          <Field label={`Peso ${weightUnit(units)}`}>
            <Input
              inputMode="decimal"
              value={kgToDisplay(profile.weight, units)}
              onChange={(e) => {
                const n = parseNum(e.target.value);
                if (!n) return;
                patchProfile({ weight: displayToKg(n, units) });
              }}
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
            className={cn("w-full rounded-2xl px-3 py-2 text-left text-sm", profile.activity === a.id ? "bg-primary/10 text-primary" : "bg-muted/40")}
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
              className={cn("h-10 rounded-xl text-xs", profile.purpose === p.id ? "bg-primary text-primary-foreground" : "bg-muted")}
            >
              {p.n}
            </button>
          ))}
        </div>
      </Card>

      <SectionLabel>Objetivos</SectionLabel>
      <Card className="space-y-2">
        {(
          [
            ["kcal", "kcal", goals.kcal],
            ["prot", "Proteína g", goals.prot],
            ["steps", "Pasos", goals.steps],
            ["water", `Agua ${volumeUnit(units)}`, goals.water],
          ] as const
        ).map(([k, n, v]) => (
          <Field key={k} label={n}>
            <Input
              inputMode="numeric"
              value={k === "water" ? mlToDisplay(v, units) : v}
              onChange={(e) => {
                const n = parseNum(e.target.value) || 0;
                patchGoals({ [k]: k === "water" ? displayToMl(n, units) : n });
              }}
            />
          </Field>
        ))}
        <Button className="w-full" variant="secondary" onClick={recalc}>
          Recalcular desde el perfil
        </Button>
      </Card>

      <SectionLabel>Ayuno</SectionLabel>
      <Card className="space-y-2">
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
        <p className="text-xs text-muted-foreground">
          {FASTING_PRESETS.find((p) => p.id === settings.fasting)?.hint}
        </p>
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
          <Input
            inputMode="decimal"
            value={mlToDisplay(settings.glass, units)}
            onChange={(e) => {
              const n = parseNum(e.target.value);
              if (!n) return;
              patchSettings({ glass: displayToMl(n, units) });
            }}
          />
        </Field>
        <label className="flex items-center justify-between gap-3 text-sm">
          Tengo básicos de despensa
          <Switch checked={settings.pantryBasics} onCheckedChange={(v) => patchSettings({ pantryBasics: v })} />
        </label>
      </Card>

      <SectionLabel>Apariencia</SectionLabel>
      <Card>
        <div className="flex gap-2">
          {(["auto", "light", "dark"] as ThemePref[]).map((t) => (
            <Button key={t} variant={settings.theme === t ? "default" : "secondary"} size="sm" onClick={() => patchSettings({ theme: t })}>
              {t === "auto" ? "Auto" : t === "light" ? "Claro" : "Oscuro"}
            </Button>
          ))}
        </div>
        <label className="mt-4 flex items-center justify-between gap-3 text-sm">
          Sumar kcal de actividad al objetivo
          <Switch checked={settings.activityAdjust} onCheckedChange={(v) => patchSettings({ activityAdjust: v })} />
        </label>
      </Card>

      <SectionLabel>Datos</SectionLabel>
      <Card className="space-y-2">
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => {
            const blob = new Blob([JSON.stringify(exportSlice, null, 2)], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `brio-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
          }}
        >
          Exportar JSON
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
            if (!file) return;
            file.text().then((t) => {
              try {
                importAll(JSON.parse(t));
                toast.success("Datos importados");
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
