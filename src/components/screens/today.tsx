import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useShallow } from "zustand/react/shallow";
import { Dumbbell, Droplets, Flame, Footprints, Moon, Pencil, Scale, Utensils, type LucideIcon } from "lucide-react";
import { DateNav } from "@/components/brio/date-nav";
import { FastingCard } from "@/components/brio/fasting";
import { LabeledBar, LegendRow, Rings } from "@/components/brio/rings";
import { Card, Screen, SectionLabel, Title } from "@/components/brio/section";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { capitalize, fmtDateLong, greeting, minutesToHM, rangeKeys, sleepDuration, todayKey } from "@/lib/brio/dates";
import { nf, plural } from "@/lib/brio/format";
import { mealEntryCount } from "@/lib/brio/meals";
import {
  activityKcal,
  currentStreak,
  dayFoodTotals,
  goalsMet,
  kcalGoalFor,
  macroGoalsFor,
  moveGoal,
  waterTotal,
  workoutMinTotal,
} from "@/lib/brio/selectors";
import { activityOf } from "@/lib/brio/domain";
import { QUICK_LOG_EVENT } from "@/lib/brio/hotkeys";
import { useBrioStore } from "@/lib/brio/store";
import { WaterSheet, StepsSheet, SleepSheet, WorkoutSheet, WeightSheet } from "@/components/brio/log-sheets";
import { StreakSheet } from "@/components/brio/streak-sheet";
import { cn } from "@/lib/utils";

const QuickAddStrip = lazy(() => import("@/components/brio/quick-add").then((m) => ({ default: m.QuickAddStrip })));
const FoodLogSheet = lazy(() => import("@/components/brio/food-log").then((m) => ({ default: m.FoodLogSheet })));
const TodaySuggestions = lazy(() =>
  import("@/components/brio/today-suggestions").then((m) => ({ default: m.TodaySuggestions })),
);

export function TodayScreen() {
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
  const navigate = useNavigate();
  const viewDate = useBrioStore((s) => s.viewDate);
  const setViewDate = useBrioStore((s) => s.setViewDate);
  const setNoteFn = useBrioStore((s) => s.setNote);
  const key = viewDate || todayKey();
  const isToday = key === todayKey();
  const isFuture = key > todayKey();
  const t = useMemo(() => dayFoodTotals(snap, key), [snap, key]);
  const g = snap.goals;
  const d = snap.days[key];
  const kg = useMemo(() => kcalGoalFor(snap, key), [snap, key]);
  const mg = useMemo(() => macroGoalsFor(snap, key), [snap, key]);
  const remaining = kg - t.kcal;
  const move = useMemo(() => moveGoal(snap), [snap]);
  const woMin = useMemo(() => workoutMinTotal(snap, key), [snap, key]);
  const rv = {
    kcal: kg ? t.kcal / kg : 0,
    steps: g.steps ? (d?.steps || 0) / g.steps : 0,
    move: move ? woMin / move : 0,
  };
  const met = useMemo(() => goalsMet(snap, key), [snap, key]);
  const streak = useMemo(() => currentStreak(snap), [snap]);
  const water = useMemo(() => waterTotal(snap, key), [snap, key]);
  const name = snap.profile.name ? `, ${snap.profile.name.split(" ")[0]}` : "";
  const last7 = rangeKeys(todayKey(), 7);
  const workouts = d?.workouts;
  const sleep = d?.sleep;
  const actKcal = useMemo(() => activityKcal(snap, key), [snap, key]);

  const [foodOpen, setFoodOpen] = useState(false);
  const [foodMounted, setFoodMounted] = useState(false);
  const [waterOpen, setWaterOpen] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(false);
  const [sleepOpen, setSleepOpen] = useState(false);
  const [woOpen, setWoOpen] = useState(false);
  const [wgOpen, setWgOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [streakOpen, setStreakOpen] = useState(false);
  const [note, setNote] = useState(d?.note ?? "");

  useEffect(() => {
    if (foodOpen) setFoodMounted(true);
  }, [foodOpen]);

  useEffect(() => {
    function onQuick(e: Event) {
      const kind = (e as CustomEvent).detail;
      if (kind === "food") {
        setFoodMounted(true);
        setFoodOpen(true);
      } else if (kind === "water") setWaterOpen(true);
      else if (kind === "steps") setStepsOpen(true);
      else if (kind === "weight") setWgOpen(true);
    }
    window.addEventListener(QUICK_LOG_EVENT, onQuick);
    return () => window.removeEventListener(QUICK_LOG_EVENT, onQuick);
  }, []);

  const actions: { n: string; Icon: LucideIcon; color: string; onOpen: () => void }[] = [
    { n: "Comida", Icon: Utensils, color: "text-kcal", onOpen: () => setFoodOpen(true) },
    { n: "Agua", Icon: Droplets, color: "text-water", onOpen: () => setWaterOpen(true) },
    { n: "Pasos", Icon: Footprints, color: "text-steps", onOpen: () => setStepsOpen(true) },
    { n: "Sueño", Icon: Moon, color: "text-sleep", onOpen: () => setSleepOpen(true) },
    { n: "Entreno", Icon: Dumbbell, color: "text-move", onOpen: () => setWoOpen(true) },
    { n: "Peso", Icon: Scale, color: "text-foreground", onOpen: () => setWgOpen(true) },
  ];

  if (isFuture) {
    const planned = mealEntryCount(snap.days[key]);
    return (
      <Screen>
        <Title sub={capitalize(fmtDateLong(key))}>Planificando</Title>
        <DateNav />
        <Card className="mb-3">
          {planned > 0 ? (
            <p className="text-sm text-muted-foreground">
              Tienes {planned} {planned === 1 ? "alimento planificado" : "alimentos planificados"} · {nf(t.kcal)}{" "}
              kcal.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aún no has planificado nada para este día. Los pasos, el agua, el sueño y el peso solo se registran el
              día que pasan — pero puedes adelantar las comidas.
            </p>
          )}
        </Card>
        <Button className="w-full" onClick={() => void navigate({ to: "/comida" })}>
          {planned > 0 ? "Ver comidas planificadas" : "Planificar comidas"}
        </Button>
        <Button className="mt-2 w-full" variant="outline" onClick={() => setViewDate(todayKey())}>
          Volver a hoy
        </Button>
      </Screen>
    );
  }

  return (
    <Screen>
      <Title sub={capitalize(fmtDateLong(key))}>
        {isToday ? `${greeting()}${name}` : capitalize(fmtDateLong(key).split(",")[0] || "")}
      </Title>
      <DateNav subtitle={`${met.count} de ${met.total} objetivos cumplidos`} />

      {/* Calories used to appear twice: here, and again ~900px down in a
          separate "Resumen" card with its own bar. One card now carries the
          rings, the day's headline number and the macro split. */}
      <Card className="mb-4">
        <div className="flex items-center gap-4">
          <Rings kcal={rv.kcal} steps={rv.steps} move={rv.move} />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <LegendRow label="Calorías" value={nf(t.kcal)} hint={`/ ${nf(kg)}`} color="var(--brio-kcal)" />
            <LegendRow label="Pasos" value={nf(d?.steps || 0)} hint={`/ ${nf(g.steps)}`} color="var(--brio-steps)" />
            <LegendRow label="Ejercicio" value={`${nf(woMin)}`} hint={`/ ${nf(move)} min`} color="var(--brio-move)" />
          </div>
        </div>

        <div className="mt-4 border-t border-border pt-3">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium">
              {remaining >= 0 ? "Te quedan" : "Te has pasado"}
            </span>
            <span className="font-display text-2xl tabular-nums">
              {nf(Math.abs(remaining))} <span className="text-sm text-muted-foreground">kcal</span>
            </span>
          </div>
          <div className="space-y-3">
            <LabeledBar
              label="Proteína"
              value={`${nf(t.prot)} g`}
              hint={`/ ${nf(mg.prot)} g`}
              pct={mg.prot ? (t.prot / mg.prot) * 100 : 0}
              color="var(--brio-kcal)"
            />
            <LabeledBar
              label="Hidratos"
              value={`${nf(t.carb)} g`}
              hint={`/ ${nf(mg.carb)} g`}
              pct={mg.carb ? (t.carb / mg.carb) * 100 : 0}
              color="var(--brio-steps)"
            />
            <LabeledBar
              label="Grasa"
              value={`${nf(t.fat)} g`}
              hint={`/ ${nf(mg.fat)} g`}
              pct={mg.fat ? (t.fat / mg.fat) * 100 : 0}
              color="var(--brio-move)"
            />
          </div>
          {snap.settings.activityAdjust && actKcal > 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">Incluye {nf(actKcal)} kcal de actividad.</p>
          ) : null}
        </div>
      </Card>

      <Card className="mb-2" onClick={() => setStreakOpen(true)}>
        <div className="flex items-center gap-3">
          <Flame className={cn("size-6", streak > 0 ? "text-move" : "text-muted-foreground")} />
          <div className="min-w-0 flex-1">
            <div className="font-medium">
              {streak > 0 ? plural(streak, "día seguido", "días seguidos") : "Empieza tu racha"}
            </div>
            <div className="text-xs text-muted-foreground">
              {streak > 0 ? "Tres o más objetivos al día" : "Cumple tres objetivos hoy para empezar"}
            </div>
            <div className="mt-2 flex gap-1">
              {last7.map((k) => {
                const c = goalsMet(snap, k).count;
                return (
                  <i
                    key={k}
                    className={cn(
                      "h-1.5 flex-1 rounded-full",
                      c >= 3 ? "bg-primary" : c > 0 ? "bg-primary/40" : "bg-muted",
                    )}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      {isToday ? <FastingCard /> : null}
      <Suspense
        fallback={
          <>
            <SectionLabel>Al vuelo</SectionLabel>
            <div className="h-16" aria-hidden />
          </>
        }
      >
        <QuickAddStrip date={key} />
      </Suspense>

      {isToday && remaining > 120 ? (
        <Suspense fallback={null}>
          <TodaySuggestions date={key} />
        </Suspense>
      ) : null}

      <SectionLabel>Registro rápido</SectionLabel>
      <div className="grid grid-cols-3 gap-2">
        {actions.map(({ n, Icon, color, onOpen }) => (
          <Button key={n} variant="secondary" className="h-20 flex-col gap-1.5 rounded-2xl" onClick={onOpen}>
            <Icon className={cn("size-5", color)} />
            <span className="text-xs font-medium">{n}</span>
          </Button>
        ))}
      </div>

      <SectionLabel>Nota del día</SectionLabel>
      <Card
        onClick={() => {
          setNote(d?.note ?? "");
          setNoteOpen(true);
        }}
      >
        <div className="flex items-start gap-2 text-sm">
          <Pencil className="mt-0.5 size-4 text-muted-foreground" />
          <span className={d?.note ? "text-foreground" : "text-muted-foreground"}>
            {d?.note?.trim() || "Apunta cómo ha ido el día."}
          </span>
        </div>
      </Card>

      {/* Agua / entrenos / sueño used to hang under the "Resumen" heading that
          belonged to the calorie card above it. */}
      <SectionLabel>El resto del día</SectionLabel>
      <Card>
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 font-medium">
            <Droplets className="size-4 text-water" />
            Agua
          </span>
          <span className="tabular-nums text-muted-foreground">
            {nf(water)} / {nf(g.water)} ml
          </span>
        </div>
        {workouts && workouts.length > 0 ? (
          <ul className="mt-3 space-y-2 border-t border-border pt-3">
            {workouts.map((w) => (
              <li key={w.id} className="flex items-center justify-between text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <Dumbbell className="size-4 shrink-0 text-move" />
                  <span className="truncate">{activityOf(w.type).n}</span>
                </span>
                <span className="tabular-nums text-muted-foreground">{w.min} min</span>
              </li>
            ))}
          </ul>
        ) : null}
        {sleep ? (
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
            <span className="flex items-center gap-2 font-medium">
              <Moon className="size-4 text-sleep" />
              Sueño
            </span>
            <span className="tabular-nums text-muted-foreground">
              {minutesToHM(sleepDuration(sleep.bed, sleep.wake))}
            </span>
          </div>
        ) : null}
      </Card>

      {foodMounted ? (
        <Suspense fallback={null}>
          <FoodLogSheet open={foodOpen} onOpenChange={setFoodOpen} date={key} />
        </Suspense>
      ) : null}
      <WaterSheet open={waterOpen} onOpenChange={setWaterOpen} date={key} />
      <StepsSheet open={stepsOpen} onOpenChange={setStepsOpen} date={key} />
      <SleepSheet open={sleepOpen} onOpenChange={setSleepOpen} date={key} />
      <WorkoutSheet open={woOpen} onOpenChange={setWoOpen} date={key} />
      <WeightSheet open={wgOpen} onOpenChange={setWgOpen} date={key} />
      <StreakSheet open={streakOpen} onOpenChange={setStreakOpen} />
      <Sheet
        open={noteOpen}
        onOpenChange={setNoteOpen}
        title="Nota del día"
        footer={
          <Button
            className="w-full"
            onClick={() => {
              setNoteFn(key, note);
              setNoteOpen(false);
            }}
          >
            Guardar
          </Button>
        }
      >
        <textarea
          className="h-36 w-full rounded-2xl border border-border bg-background p-3 text-sm"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={600}
        />
      </Sheet>
    </Screen>
  );
}
