import { useState } from "react";
import { Dumbbell, Droplets, Flame, Footprints, Moon, Pencil, Scale, Utensils, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { DateNav } from "@/components/brio/date-nav";
import { FastingCard } from "@/components/brio/fasting";
import { FoodLogSheet } from "@/components/brio/food-log";
import { QuickAddStrip } from "@/components/brio/quick-add";
import { Bar, LabeledBar, LegendRow, Rings } from "@/components/brio/rings";
import { Card, Screen, SectionLabel, Title } from "@/components/brio/section";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { capitalize, fmtDateLong, greeting, minutesToHM, rangeKeys, sleepDuration, todayKey } from "@/lib/brio/dates";
import { nf } from "@/lib/brio/format";
import {
  activityKcal,
  currentStreak,
  dayFoodTotals,
  goalsMet,
  kcalGoalFor,
  moveGoal,
  suggestRecipes,
  waterTotal,
  workoutMinTotal,
} from "@/lib/brio/selectors";
import { activityOf } from "@/lib/brio/domain";
import { useBrioStore } from "@/lib/brio/store";
import { WaterSheet, StepsSheet, SleepSheet, WorkoutSheet, WeightSheet } from "@/components/brio/log-sheets";
import { StreakSheet } from "@/components/brio/streak-sheet";
import { cn } from "@/lib/utils";
import { RECIPE_BY_ID } from "@/lib/brio/catalog";
import { RecipeDetail } from "@/components/brio/recipe-browser";

export function TodayScreen() {
  const s = useBrioStore();
  const key = s.viewDate || todayKey();
  const isToday = key === todayKey();
  const isFuture = key > todayKey();
  const t = dayFoodTotals(s, key);
  const g = s.goals;
  const d = s.days[key];
  const kg = kcalGoalFor(s, key);
  const remaining = kg - t.kcal;
  const rv = {
    kcal: kg ? t.kcal / kg : 0,
    steps: g.steps ? (d?.steps || 0) / g.steps : 0,
    move: moveGoal(s) ? workoutMinTotal(s, key) / moveGoal(s) : 0,
  };
  const met = goalsMet(s, key);
  const streak = currentStreak(s);
  const water = waterTotal(s, key);
  const sug = isToday && remaining > 120 ? suggestRecipes(s, key, 3) : { list: [], remKcal: remaining, remProt: 0 };
  const name = s.profile.name ? `, ${s.profile.name.split(" ")[0]}` : "";
  const last7 = rangeKeys(todayKey(), 7);
  const workouts = d?.workouts;
  const sleep = d?.sleep;

  const [foodOpen, setFoodOpen] = useState(false);
  const [waterOpen, setWaterOpen] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(false);
  const [sleepOpen, setSleepOpen] = useState(false);
  const [woOpen, setWoOpen] = useState(false);
  const [wgOpen, setWgOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [streakOpen, setStreakOpen] = useState(false);
  const [recipeId, setRecipeId] = useState<string | null>(null);
  const [note, setNote] = useState(d?.note ?? "");

  const actions: { n: string; Icon: LucideIcon; color: string; onOpen: () => void }[] = [
    { n: "Comida", Icon: Utensils, color: "text-kcal", onOpen: () => setFoodOpen(true) },
    { n: "Agua", Icon: Droplets, color: "text-water", onOpen: () => setWaterOpen(true) },
    { n: "Pasos", Icon: Footprints, color: "text-steps", onOpen: () => setStepsOpen(true) },
    { n: "Sueño", Icon: Moon, color: "text-sleep", onOpen: () => setSleepOpen(true) },
    { n: "Entreno", Icon: Dumbbell, color: "text-move", onOpen: () => setWoOpen(true) },
    { n: "Peso", Icon: Scale, color: "text-foreground", onOpen: () => setWgOpen(true) },
  ];

  if (isFuture) {
    return (
      <Screen>
        <Title sub={capitalize(fmtDateLong(key))}>Día futuro</Title>
        <DateNav />
        <p className="text-sm text-muted-foreground">Todavía no puedes registrar un día que no ha llegado.</p>
        <Button className="mt-4" onClick={() => s.setViewDate(todayKey())}>
          Volver a hoy
        </Button>
      </Screen>
    );
  }

  return (
    <Screen>
      <Title sub={capitalize(fmtDateLong(key))}>{isToday ? `${greeting()}${name}` : capitalize(fmtDateLong(key).split(",")[0] || "")}</Title>
      <DateNav subtitle={`${met.count} de ${met.total} objetivos cumplidos`} />

      <Card className="mb-4">
        <div className="flex items-center gap-4">
          <Rings kcal={rv.kcal} steps={rv.steps} move={rv.move} />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <LegendRow label="Calorías" value={nf(t.kcal)} hint={`/ ${nf(kg)}`} color="var(--brio-kcal)" />
            <LegendRow label="Pasos" value={nf(d?.steps || 0)} hint={`/ ${nf(g.steps)}`} color="var(--brio-steps)" />
            <LegendRow
              label="Ejercicio"
              value={`${nf(workoutMinTotal(s, key))}`}
              hint={`/ ${nf(moveGoal(s))} min`}
              color="var(--brio-move)"
            />
          </div>
        </div>
      </Card>

      <Card className="mb-2" onClick={() => setStreakOpen(true)}>
        <div className="flex items-center gap-3">
          <Flame className={cn("size-6", streak > 0 ? "text-move" : "text-muted-foreground")} />
          <div className="min-w-0 flex-1">
            <div className="font-medium">{streak > 0 ? `${streak} ${streak === 1 ? "día seguido" : "días seguidos"}` : "Sin racha en marcha"}</div>
            <div className="text-xs text-muted-foreground">
              {streak > 0 ? "Tres o más objetivos al día" : "Cumple tres objetivos hoy para empezar"}
            </div>
            <div className="mt-2 flex gap-1">
              {last7.map((k) => {
                const c = goalsMet(s, k).count;
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
      <QuickAddStrip date={key} />

      {sug.list.length > 0 && (
        <>
          <SectionLabel>Te encaja para lo que queda</SectionLabel>
          <Card>
            <p className="mb-3 text-sm text-muted-foreground">
              Te quedan <span className="font-medium text-foreground">{nf(sug.remKcal)} kcal</span>
              {sug.remProt > 0 ? ` y ${nf(sug.remProt)} g de proteína` : ""}.
            </p>
            <div className="space-y-2">
              {sug.list.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="flex w-full items-center justify-between rounded-2xl bg-muted/60 px-3 py-2 text-left"
                  onClick={() => setRecipeId(r.id)}
                >
                  <span>
                    <span className="block font-medium">{r.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {r.minutes} min · {nf(r.perServing.prot)} g prot
                    </span>
                  </span>
                  <span className="tabular-nums text-sm">{nf(r.perServing.kcal)} kcal</span>
                </button>
              ))}
            </div>
          </Card>
        </>
      )}

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
      <Card onClick={() => { setNote(d?.note ?? ""); setNoteOpen(true); }}>
        <div className="flex items-start gap-2 text-sm">
          <Pencil className="mt-0.5 size-4 text-muted-foreground" />
          <span className={d?.note ? "text-foreground" : "text-muted-foreground"}>
            {d?.note?.trim() || "Apunta cómo ha ido el día."}
          </span>
        </div>
      </Card>

      <SectionLabel>Resumen</SectionLabel>
      <Card className="mb-3">
        <div className="mb-2 flex justify-between text-sm">
          <span className="font-medium">Calorías</span>
          <span className="text-muted-foreground">
            {remaining >= 0 ? `${nf(remaining)} restantes` : `${nf(-remaining)} de más`}
          </span>
        </div>
        <Bar pct={kg ? (t.kcal / kg) * 100 : 0} color={remaining >= 0 ? "var(--brio-kcal)" : "var(--brio-bad)"} />
        <div className="mt-4 space-y-3">
          <LabeledBar
            label="Prot"
            value={`${nf(t.prot)} g`}
            hint={`/ ${nf(g.prot)} g`}
            pct={g.prot ? (t.prot / g.prot) * 100 : 0}
            color="var(--brio-kcal)"
          />
          <LabeledBar
            label="HC"
            value={`${nf(t.carb)} g`}
            hint={`/ ${nf(g.carb)} g`}
            pct={g.carb ? (t.carb / g.carb) * 100 : 0}
            color="var(--brio-steps)"
          />
          <LabeledBar
            label="Grasa"
            value={`${nf(t.fat)} g`}
            hint={`/ ${nf(g.fat)} g`}
            pct={g.fat ? (t.fat / g.fat) * 100 : 0}
            color="var(--brio-move)"
          />
        </div>
        {s.settings.activityAdjust && activityKcal(s, key) > 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">Incluye {nf(activityKcal(s, key))} kcal de actividad.</p>
        ) : null}
      </Card>
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

      {foodOpen ? <FoodLogSheet open={foodOpen} onOpenChange={setFoodOpen} date={key} /> : null}
      {waterOpen ? <WaterSheet open={waterOpen} onOpenChange={setWaterOpen} date={key} /> : null}
      {stepsOpen ? <StepsSheet open={stepsOpen} onOpenChange={setStepsOpen} date={key} /> : null}
      {sleepOpen ? <SleepSheet open={sleepOpen} onOpenChange={setSleepOpen} date={key} /> : null}
      {woOpen ? <WorkoutSheet open={woOpen} onOpenChange={setWoOpen} date={key} /> : null}
      {wgOpen ? <WeightSheet open={wgOpen} onOpenChange={setWgOpen} date={key} /> : null}
      {streakOpen ? <StreakSheet open={streakOpen} onOpenChange={setStreakOpen} /> : null}
      <Sheet
        open={noteOpen}
        onOpenChange={setNoteOpen}
        title="Nota del día"
        footer={
          <Button
            className="w-full"
            onClick={() => {
              s.setNote(key, note);
              setNoteOpen(false);
              toast.success("Nota guardada");
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
      {recipeId && RECIPE_BY_ID[recipeId] ? (
        <RecipeDetail
          open={!!recipeId}
          onOpenChange={(v) => !v && setRecipeId(null)}
          recipe={RECIPE_BY_ID[recipeId]}
          date={key}
        />
      ) : null}
    </Screen>
  );
}
