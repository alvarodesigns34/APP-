import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { Bar } from "@/components/brio/rings";
import { Card, Empty, SectionLabel } from "@/components/brio/section";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { fmtDateRelative, rangeKeys, todayKey } from "@/lib/brio/dates";
import { intensityOf } from "@/lib/brio/domain";
import { nf, plural } from "@/lib/brio/format";
import { allSessions, sportMarks, weekWorkoutMin } from "@/lib/brio/workouts";
import { useBrioStore } from "@/lib/brio/store";
import { activityOf } from "@/lib/brio/domain";
import { cn } from "@/lib/utils";

export function WorkoutWeekCard({ onOpen }: { onOpen: () => void }) {
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
  const week = useMemo(() => weekWorkoutMin(snap), [snap]);
  const goal = snap.goals.activityMin;
  const marks = useMemo(() => sportMarks(snap), [snap]);
  const best = marks[0];
  const sessions = useMemo(() => allSessions(snap), [snap]);
  if (sessions.length === 0) {
    return (
      <>
        <SectionLabel>Esta semana</SectionLabel>
        <Empty
          title="Sin marcas todavía"
          body="Registra un entreno para guardar el tiempo y ver tu mejor sesión de cada deporte."
        />
      </>
    );
  }
  return (
    <>
      <SectionLabel>Esta semana</SectionLabel>
      <Card className="mb-3">
        <div className="font-display text-2xl tabular-nums">
          {nf(week)} / {nf(goal)} min
        </div>
        <p className="mb-2 mt-1 text-xs text-muted-foreground">
          {week >= goal ? "Meta semanal hecha." : `Te faltan ${nf(goal - week)} min para la meta semanal.`}
        </p>
        <Bar pct={goal ? (week / goal) * 100 : 0} color="var(--brio-move)" />
        <p className="mt-3 text-sm text-muted-foreground">
          {plural(sessions.filter((x) => x.date >= rangeKeys(todayKey(), 7)[0]).length, "sesión", "sesiones")}
          {best ? ` · mejor: ${best.name} ${best.bestMin} min` : ""}
        </p>
        <Button className="mt-3 w-full" variant="secondary" onClick={onOpen}>
          Ver historial
        </Button>
      </Card>
    </>
  );
}

export function WorkoutHistorySheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
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
  const setViewDate = useBrioStore((st) => st.setViewDate);
  const week = useMemo(() => weekWorkoutMin(snap), [snap]);
  const goal = snap.goals.activityMin;
  const marks = useMemo(() => sportMarks(snap), [snap]);
  const sessions = useMemo(() => allSessions(snap).slice(0, 20), [snap]);
  const bars = rangeKeys(todayKey(), 14);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Historial y marcas">
      <div className="mb-4">
        <div className="font-display text-2xl tabular-nums">
          {nf(week)} / {nf(goal)} min
        </div>
        <p className="mb-2 text-xs text-muted-foreground">Últimos 7 días</p>
        <Bar pct={goal ? (week / goal) * 100 : 0} color="var(--brio-move)" />
      </div>

      <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Marcas</h3>
      {marks.length === 0 ? (
        <p className="mb-4 text-sm text-muted-foreground">Todavía no hay marcas.</p>
      ) : (
        <ul className="mb-4 divide-y divide-border">
          {marks.map((m) => (
            <li key={m.type} className="py-2">
              <div className="font-medium">{m.name}</div>
              <div className="text-xs text-muted-foreground">
                Mejor {m.bestMin} min · {nf(m.bestKcal)} kcal
              </div>
              <div className="text-xs text-muted-foreground">
                {m.sessions} {m.sessions === 1 ? "sesión" : "sesiones"} · última {fmtDateRelative(m.lastDate).toLowerCase()}
              </div>
            </li>
          ))}
        </ul>
      )}

      <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Volumen 14 días</h3>
      <div className="mb-4 flex h-8 items-end gap-1">
        {bars.map((k) => {
          const min = snap.days[k]?.workouts.reduce((a, w) => a + w.min, 0) ?? 0;
          const h = Math.min(100, (min / 90) * 100);
          return (
            <i
              key={k}
              title={`${k}: ${min} min`}
              className={cn("flex-1 rounded-sm", min > 0 ? "bg-move" : "bg-muted")}
              style={{ height: `${Math.max(12, h)}%` }}
            />
          );
        })}
      </div>

      <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Últimas sesiones</h3>
      <ul className="divide-y divide-border">
        {sessions.map((w) => (
          <li key={`${w.date}-${w.id}`}>
            <button
              type="button"
              className="flex min-h-11 w-full items-center justify-between py-2 text-left"
              onClick={() => {
                setViewDate(w.date);
                onOpenChange(false);
              }}
            >
              <span className="min-w-0">
                <span className="block font-medium">{activityOf(w.type).n}</span>
                <span className="text-xs text-muted-foreground">{fmtDateRelative(w.date)}</span>
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {w.min} min · {intensityOf(w.intensity).n} · {nf(w.kcal)} kcal
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
