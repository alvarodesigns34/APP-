import { lazy, Suspense, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useShallow } from "zustand/react/shallow";
import { Card, Empty, Screen, SectionLabel, Title } from "@/components/brio/section";
import { addDays, rangeKeys, sleepDuration, todayKey, weekColumns, WEEKDAYS } from "@/lib/brio/dates";
import { nf, plural } from "@/lib/brio/format";
import { buildMacroSeries, DEFAULT_TREND_RANGE, TREND_RANGES, type TrendRange } from "@/lib/brio/macro-series";
import {
  dayFoodTotals,
  goalsMet,
  waterTotal,
  weeklyInsights,
  weightTrend,
  workoutMinTotal,
} from "@/lib/brio/selectors";
import { useBrioStore } from "@/lib/brio/store";
import { cn } from "@/lib/utils";
import { fmtWeight } from "@/lib/brio/units";
import { compareWeeks, isWeekEmpty, weekTotals, type WeekDelta, type WeekTotals } from "@/lib/brio/week-compare";
import { buildWeightChart } from "@/lib/brio/weight-chart";

const TrendsCharts = lazy(() => import("./trends-charts").then((m) => ({ default: m.TrendsCharts })));

function shortDate(key: string) {
  const parts = key.split("-");
  return `${Number(parts[2])}/${Number(parts[1])}`;
}

function pesoYDomain(
  pts: {
    kg: number | null;
    trend: number;
    goal: number;
    bandLow: number;
    bandHigh: number;
    ma7: number | null;
  }[],
): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const p of pts) {
    for (const v of [p.kg, p.trend, p.goal, p.bandLow, p.bandHigh, p.ma7]) {
      if (v != null && Number.isFinite(v)) {
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  const pad = Math.max(0.4, (max - min) * 0.08);
  return [min - pad, max + pad];
}

function FoodChartSkeleton() {
  return (
    <Card className="mb-3 p-2">
      <div className="h-48" />
      <div className="mt-1 h-4" />
    </Card>
  );
}

function ChartSkeleton({ hasWeight }: { hasWeight: boolean }) {
  return (
    <>
      <SectionLabel>Calorías</SectionLabel>
      <FoodChartSkeleton />
      <SectionLabel>Proteína</SectionLabel>
      <FoodChartSkeleton />
      <SectionLabel>Hidratos</SectionLabel>
      <FoodChartSkeleton />
      <SectionLabel>Grasa</SectionLabel>
      <FoodChartSkeleton />
      <SectionLabel>Agua</SectionLabel>
      <Card className="mb-3 h-44 p-2">{null}</Card>
      <SectionLabel>Sueño</SectionLabel>
      <Card className="mb-3 h-44 p-2">{null}</Card>
      <SectionLabel>Pasos</SectionLabel>
      <Card className="mb-3 h-44 p-2">{null}</Card>
      {hasWeight ? (
        <>
          <SectionLabel>Peso</SectionLabel>
          <Card className="p-2">
            <div className="h-56" />
          </Card>
        </>
      ) : null}
    </>
  );
}

function signedDeltaLabel(d: WeekDelta, unit: string): string {
  if (d.dir === "flat") return d.pct != null ? "0 %" : `0 ${unit}`;
  const sign = d.dir === "up" ? "+" : "−";
  if (d.pct != null) return `${sign}${Math.abs(d.pct)} %`;
  return `${sign}${nf(Math.abs(d.abs))} ${unit}`;
}

function WeekCompareBlock({ curr, prev }: { curr: WeekTotals; prev: WeekTotals }) {
  const d = compareWeeks(curr, prev);
  const currEmpty = isWeekEmpty(curr);
  const prevEmpty = isWeekEmpty(prev);
  const rows: { label: string; curr: number; prev: number; delta: WeekDelta; unit: string }[] = [
    { label: "Calorías", curr: curr.kcalAvg, prev: prev.kcalAvg, delta: d.kcal, unit: "kcal" },
    { label: "Proteína", curr: curr.protAvg, prev: prev.protAvg, delta: d.prot, unit: "g" },
    { label: "Pasos", curr: curr.stepsAvg, prev: prev.stepsAvg, delta: d.steps, unit: "pasos" },
    { label: "Ejercicio", curr: curr.moveMin, prev: prev.moveMin, delta: d.move, unit: "min" },
  ];
  return (
    <div className="mt-4">
      <p className="text-sm font-medium">Esta semana vs. la anterior</p>
      {currEmpty ? (
        // Otherwise every row would show a misleading "-100%" from comparing a
        // week that simply has no logs yet against a real previous week.
        <p className="mt-2 text-sm text-muted-foreground">Esta semana aún no tiene datos.</p>
      ) : prevEmpty ? (
        <p className="mt-2 text-sm text-muted-foreground">La semana anterior aún no tiene datos.</p>
      ) : (
        // Three bare numbers separated by dots ("940 · 940 · 0 %") gave no way
        // to tell this week from last, so the columns are labelled and the
        // current value carries its unit.
        <div className="mt-2">
          <div className="grid grid-cols-[1fr_auto_auto_auto] items-baseline gap-x-3 border-b border-border pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <span className="sr-only">Métrica</span>
            <span className="text-right">Esta</span>
            <span className="text-right">Anterior</span>
            <span className="text-right">Cambio</span>
          </div>
          <ul>
            {rows.map((r) => (
              <li
                key={r.label}
                className="grid grid-cols-[1fr_auto_auto_auto] items-baseline gap-x-3 border-b border-border/60 py-1.5 text-sm last:border-0"
              >
                <span className="truncate">{r.label}</span>
                <span className="min-w-14 text-right font-medium tabular-nums">
                  {nf(r.curr)}
                  <span className="ml-0.5 text-[11px] font-normal text-muted-foreground">{r.unit}</span>
                </span>
                <span className="min-w-12 text-right tabular-nums text-muted-foreground">{nf(r.prev)}</span>
                <span
                  className={cn(
                    "min-w-14 text-right tabular-nums",
                    r.delta.dir === "flat" ? "text-muted-foreground" : "font-medium text-foreground",
                  )}
                >
                  {signedDeltaLabel(r.delta, r.unit)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function TrendsScreen() {
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
  const setViewDate = useBrioStore((s) => s.setViewDate);
  const navigate = useNavigate();
  const [range, setRange] = useState<TrendRange>(DEFAULT_TREND_RANGE);
  const data = useMemo(() => {
    const keys = rangeKeys(todayKey(), range);
    const days = keys.map((k) => {
      const t = dayFoodTotals(snap, k);
      const sl = snap.days[k]?.sleep;
      return {
        d: shortDate(k),
        kcal: Math.round(t.kcal),
        prot: Math.round(t.prot),
        carb: Math.round(t.carb),
        fat: Math.round(t.fat),
        water: waterTotal(snap, k),
        move: workoutMinTotal(snap, k),
        steps: snap.days[k]?.steps || 0,
        sleep: sl ? Math.round((sleepDuration(sl.bed, sl.wake) / 60) * 10) / 10 : 0,
      };
    });
    return buildMacroSeries(days, {
      kcal: snap.goals.kcal,
      prot: snap.goals.prot,
      carb: snap.goals.carb,
      fat: snap.goals.fat,
    });
  }, [snap, range]);
  const week = rangeKeys(todayKey(), 7);
  const prevWeek = rangeKeys(addDays(todayKey(), -7), 7);
  // goalsMet chains into kcalGoalFor → activityKcal → stepsKcal → latestWeight,
  // which filters the whole weights array. Unmemoized that ran 84 times on
  // every render of this screen.
  // Weeks as columns, weekdays as rows. The old grid poured 84 days into 7
  // columns, which looks like a calendar but is a wrapping strip: a column only
  // lands on a weekday if day one happened to be a Monday.
  const heat = useMemo(
    () =>
      weekColumns(todayKey(), 12).map((col) =>
        col.map((k) => (k == null ? null : { k, c: goalsMet(snap, k).count })),
      ),
    [snap],
  );
  const insights = useMemo(() => weeklyInsights(snap), [snap]);
  const wChart = useMemo(() => {
    const pts = buildWeightChart(snap.weights, snap.goals.weight);
    return pts.map((p) => ({ ...p, bandSpan: p.bandHigh - p.bandLow }));
  }, [snap.weights, snap.goals.weight]);
  const pesoDomain = useMemo(() => pesoYDomain(wChart), [wChart]);
  const trend = useMemo(() => weightTrend(snap), [snap]);
  const units = snap.settings.units;

  // One pass over the week instead of the five separate dayFoodTotals sweeps
  // (weekKcal, weekProt, logged, hasAny, and foodOf inside weekTotals) this
  // used to run on every render.
  const summary = useMemo(() => {
    let weekKcal = 0;
    let weekProt = 0;
    let logged = 0;
    let anySteps = false;
    for (const k of week) {
      const t = dayFoodTotals(snap, k);
      weekKcal += t.kcal;
      weekProt += t.prot;
      if (t.kcal > 0) logged += 1;
      if ((snap.days[k]?.steps || 0) > 0) anySteps = true;
    }
    const foodOf = (k: string) => dayFoodTotals(snap, k);
    const stepsOf = (k: string) => snap.days[k]?.steps || 0;
    const moveOf = (k: string) => workoutMinTotal(snap, k);
    return {
      weekKcal,
      weekProt,
      logged,
      hasAny: logged > 0 || snap.weights.length > 0 || anySteps,
      thisWeekTotals: weekTotals(week, foodOf, stepsOf, moveOf),
      prevWeekTotals: weekTotals(prevWeek, foodOf, stepsOf, moveOf),
    };
    // `week`/`prevWeek` are derived from todayKey() and change only with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap]);
  const { weekKcal, weekProt, logged, hasAny, thisWeekTotals, prevWeekTotals } = summary;

  return (
    <Screen>
      <Title sub="Recap, calendario y gráficas">Tendencias</Title>

      <SectionLabel>Resumen semanal</SectionLabel>
      {!hasAny ? (
        <Empty
          title="Todavía no hay tendencias"
          body="Registra comidas, pasos o el peso unos días y aquí verás el recap, el calendario y las gráficas."
        />
      ) : (
        <Card className="mb-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="font-display text-2xl tabular-nums">{logged}</div>
              <div className="text-[11px] text-muted-foreground">días con comida</div>
            </div>
            <div>
              <div className="font-display text-2xl tabular-nums">{nf(weekKcal / Math.max(1, logged))}</div>
              <div className="text-[11px] text-muted-foreground">kcal media</div>
            </div>
            <div>
              <div className="font-display text-2xl tabular-nums">{nf(weekProt / Math.max(1, logged))}</div>
              <div className="text-[11px] text-muted-foreground">g prot media</div>
            </div>
          </div>
          <WeekCompareBlock curr={thisWeekTotals} prev={prevWeekTotals} />
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            {insights.map((i) => (
              <li key={i}>· {i}</li>
            ))}
          </ul>
        </Card>
      )}

      {trend ? (
        <>
          <SectionLabel>Proyección de peso</SectionLabel>
          <Card className="mb-3">
            <div className="font-display text-2xl tabular-nums">{fmtWeight(trend.current, units)}</div>
            <p className="mt-1 text-sm text-muted-foreground">
              {trend.rate < -0.004
                ? `${fmtWeight(Math.abs(trend.rate) * 7, units)} menos por semana`
                : trend.rate > 0.004
                  ? `${fmtWeight(trend.rate * 7, units)} más por semana`
                  : "El peso se mantiene estable"}
              {" · meta "}
              {fmtWeight(trend.goal, units)}
            </p>
            {trend.eta != null ? (
              <p className="mt-2 text-sm">
                Si sigues así, llegarías en unos {plural(trend.eta, "día", "días")}
                {trend.weeks != null ? ` (${nf(trend.weeks, 1)} semanas)` : ""}.
              </p>
            ) : Math.abs(trend.remaining) >= 0.2 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                El ritmo actual no apunta a la meta. Ajusta comida o actividad.
              </p>
            ) : (
              <p className="mt-2 text-sm">Estás en tu peso objetivo.</p>
            )}
          </Card>
        </>
      ) : null}

      <SectionLabel>Calendario</SectionLabel>
      <Card className="mb-3">
        <div className="flex gap-1.5">
          <div className="grid shrink-0 grid-rows-7 gap-1 pr-0.5 text-[10px] leading-none text-muted-foreground">
            {WEEKDAYS.map((w, i) => (
              // Only alternate rows are labelled; seven 10px labels in a column
              // this short is noise rather than orientation.
              <span key={w} className="flex h-3.5 items-center">
                {i % 2 === 0 ? w : ""}
              </span>
            ))}
          </div>
          <div className="grid flex-1 grid-flow-col grid-rows-7 gap-1">
            {heat.map((col, ci) =>
              col.map((cell, ri) =>
                cell == null ? (
                  <span key={`e${ci}-${ri}`} className="h-3.5 rounded-[3px]" aria-hidden />
                ) : (
                  <button
                    key={cell.k}
                    type="button"
                    title={`${cell.k}: ${cell.c}/5`}
                    aria-label={`${cell.k}: ${cell.c} de 5 objetivos`}
                    className={cn(
                      "h-3.5 rounded-[3px] transition-colors",
                      cell.c >= 4
                        ? "bg-primary"
                        : cell.c >= 3
                          ? "bg-primary/70"
                          : cell.c > 0
                            ? "bg-primary/30"
                            : "bg-muted",
                    )}
                    onClick={() => {
                      // The copy promised "toca un día para abrirlo" but only
                      // set the global date, so nothing visibly happened here
                      // and the other screens silently moved.
                      setViewDate(cell.k);
                      void navigate({ to: "/" });
                    }}
                  />
                ),
              ),
            )}
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">12 semanas · toca un día para abrirlo en Hoy</p>
      </Card>

      <SectionLabel>Gráficas</SectionLabel>
      <div className="mb-3 flex flex-wrap gap-2">
        {TREND_RANGES.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRange(n)}
            className={cn(
              "min-h-11 rounded-xl px-3 text-sm font-medium",
              range === n ? "bg-primary text-primary-foreground" : "bg-muted",
            )}
            aria-pressed={range === n}
          >
            {n} días
          </button>
        ))}
      </div>
      <Suspense fallback={<ChartSkeleton hasWeight={wChart.length > 0} />}>
        <TrendsCharts data={data} wChart={wChart} pesoDomain={pesoDomain} units={units} />
      </Suspense>
    </Screen>
  );
}
