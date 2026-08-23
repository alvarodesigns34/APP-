import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { DateNav } from "@/components/brio/date-nav";
import { Card, Screen, SectionLabel, Title } from "@/components/brio/section";
import { Bar } from "@/components/brio/rings";
import { Button } from "@/components/ui/button";
import { SleepSheet, StepsSheet, WaterSheet, WeightSheet, WorkoutSheet } from "@/components/brio/log-sheets";
import { RoutinesSheet } from "@/components/brio/routines";
import { WorkoutHistorySheet, WorkoutWeekCard } from "@/components/brio/workout-history";
import { capitalize, fmtDateLong, fmtDateRelative, minutesToHM, sleepDuration, todayKey } from "@/lib/brio/dates";
import { nf } from "@/lib/brio/format";
import { bmi, bmiCategory, distanceFromSteps, activityOf } from "@/lib/brio/domain";
import { currentWeightKg, waterTotal, workoutMinTotal } from "@/lib/brio/selectors";
import { useBrioStore } from "@/lib/brio/store";
import type { WorkoutEntry } from "@/lib/brio/types";
import { fmtVolume, fmtWeight } from "@/lib/brio/units";

export function ActivityScreen() {
  const snap = useBrioStore(
    useShallow((s) => ({
      days: s.days,
      goals: s.goals,
      profile: s.profile,
      settings: s.settings,
      weights: s.weights,
      customFoods: s.customFoods,
      recipes: s.recipes,
      pantry: s.pantry,
      favorites: s.favorites,
      favRecipes: s.favRecipes,
      recents: s.recents,
      schema: s.schema,
      onboarded: s.onboarded,
    })),
  );
  const viewDate = useBrioStore((s) => s.viewDate);
  const removeWorkout = useBrioStore((s) => s.removeWorkout);
  const setViewDate = useBrioStore((s) => s.setViewDate);
  const key = viewDate || todayKey();
  const isFuture = key > todayKey();
  const d = snap.days[key];
  const units = snap.settings.units;
  const [steps, setSteps] = useState(false);
  const [wo, setWo] = useState(false);
  const [editingWo, setEditingWo] = useState<WorkoutEntry | null>(null);
  const [water, setWater] = useState(false);
  const [sleep, setSleep] = useState(false);
  const [wg, setWg] = useState(false);
  const [routines, setRoutines] = useState(false);
  const [hist, setHist] = useState(false);
  const kg = useMemo(() => currentWeightKg(snap), [snap]);
  const km = distanceFromSteps(d?.steps || 0, snap.profile.sex, snap.profile.height);
  const b = bmi(kg, snap.profile.height);
  const cat = bmiCategory(b);
  const wt = useMemo(() => waterTotal(snap, key), [snap, key]);
  const glassesEst = snap.settings.glass ? Math.round(wt / snap.settings.glass) : 0;
  const dayLabel = fmtDateRelative(key).toLowerCase();
  const woMin = useMemo(() => workoutMinTotal(snap, key), [snap, key]);

  // Hoy bloquea los días futuros y dice por qué ("los pasos, el agua, el sueño
  // y el peso solo se registran el día que pasan"); Actividad no lo miraba, así
  // que con el mismo `viewDate` de mañana sí se podía guardar un entreno, un
  // vaso, una noche o un pesaje. El pesaje era el peor: de él se deriva el peso
  // del perfil, o sea el IMC y el TDEE, a partir de un día que no ha llegado.
  if (isFuture) {
    return (
      <Screen>
        <Title sub={capitalize(fmtDateLong(key))}>Actividad</Title>
        <DateNav />
        <Card className="mb-3">
          <p className="text-sm text-muted-foreground">
            Los pasos, el agua, el sueño y el peso solo se registran el día que pasan. Las comidas sí se pueden
            adelantar.
          </p>
        </Card>
        <Button className="w-full" variant="outline" onClick={() => setViewDate(todayKey())}>
          Volver a hoy
        </Button>
      </Screen>
    );
  }

  return (
    <Screen>
      <Title sub="Movimiento, agua, sueño y peso">Actividad</Title>
      <DateNav />

      <Card className="mb-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-medium">Pasos</span>
          <Button size="sm" variant="ghost" onClick={() => setSteps(true)}>Editar</Button>
        </div>
        <div className="font-display text-3xl tabular-nums">{nf(d?.steps || 0)}</div>
        <p className="mb-2 text-xs text-muted-foreground">{nf(km, 2)} km · objetivo {nf(snap.goals.steps)}</p>
        <Bar pct={snap.goals.steps ? ((d?.steps || 0) / snap.goals.steps) * 100 : 0} color="var(--brio-steps)" />
      </Card>

      <SectionLabel>Entrenamiento</SectionLabel>
      <Card className="mb-3">
        {(d?.workouts.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay sesiones {dayLabel}.</p>
        ) : (
          <ul className="divide-y divide-border">
            {d!.workouts.map((w) => (
              <li key={w.id} className="flex items-center justify-between py-2 text-sm">
                <button
                  type="button"
                  className="min-h-11 min-w-0 flex-1 text-left"
                  onClick={() => setEditingWo(w)}
                >
                  {activityOf(w.type).n}
                  <span className="block text-xs text-muted-foreground">{w.min} min · {nf(w.kcal)} kcal</span>
                </button>
                <button
                  type="button"
                  aria-label="Quitar entrenamiento"
                  className="min-h-11 shrink-0 px-2 text-xs text-muted-foreground"
                  onClick={() => {
                    removeWorkout(key, w.id);
                  }}
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-muted-foreground">{woMin} min {dayLabel}</p>
        <div className="mt-3 flex gap-2">
          <Button className="flex-1" variant="secondary" onClick={() => setWo(true)}>Registrar</Button>
          <Button className="flex-1" variant="outline" onClick={() => setRoutines(true)}>Rutinas</Button>
        </div>
      </Card>

      <WorkoutWeekCard onOpen={() => setHist(true)} />

      <Card className="mb-3" onClick={() => setWater(true)}>
        <div className="mb-2 font-medium">Agua</div>
        <div className="font-display text-2xl tabular-nums">{fmtVolume(wt, units)}</div>
        <p className="mb-2 text-xs text-muted-foreground">
          {glassesEst} {glassesEst === 1 ? "vaso" : "vasos"} de {fmtVolume(snap.settings.glass, units)}
        </p>
        <Bar pct={snap.goals.water ? (wt / snap.goals.water) * 100 : 0} color="var(--brio-water)" />
      </Card>

      <Card className="mb-3" onClick={() => setSleep(true)}>
        <div className="mb-1 font-medium">Sueño</div>
        {d?.sleep ? (
          <p className="text-sm">
            {minutesToHM(sleepDuration(d.sleep.bed, d.sleep.wake))}
            <span className="block text-xs text-muted-foreground">objetivo {minutesToHM(snap.goals.sleep)}</span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Toca para registrar la noche.</p>
        )}
      </Card>

      <Card onClick={() => setWg(true)}>
        <div className="mb-1 font-medium">Peso</div>
        <div className="font-display text-2xl tabular-nums">{fmtWeight(kg, units)}</div>
        <p className="text-xs text-muted-foreground">
          IMC {nf(b, 1)} · {cat.n} · meta {fmtWeight(snap.goals.weight, units)}
        </p>
      </Card>

      <StepsSheet open={steps} onOpenChange={setSteps} date={key} />
      <WorkoutSheet open={wo} onOpenChange={setWo} date={key} />
      <WorkoutSheet
        open={editingWo != null}
        onOpenChange={(v) => {
          if (!v) setEditingWo(null);
        }}
        date={key}
        edit={editingWo ?? undefined}
      />
      <WaterSheet open={water} onOpenChange={setWater} date={key} />
      <SleepSheet open={sleep} onOpenChange={setSleep} date={key} />
      <WeightSheet open={wg} onOpenChange={setWg} date={key} />
      <RoutinesSheet open={routines} onOpenChange={setRoutines} date={key} />
      <WorkoutHistorySheet open={hist} onOpenChange={setHist} />
    </Screen>
  );
}
