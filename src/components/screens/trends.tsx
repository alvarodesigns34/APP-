import { lazy, Suspense, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { Card, Empty, Screen, SectionLabel, Title } from "@/components/brio/section";
import { rangeKeys, sleepDuration, todayKey } from "@/lib/brio/dates";
import { nf } from "@/lib/brio/format";
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

function ChartSkeleton({ hasWeight }: { hasWeight: boolean }) {
  return (
    <>
      <SectionLabel>Calorías</SectionLabel>
      <Card className="mb-3 h-48 p-2">{null}</Card>
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
  const data = useMemo(() => {
    const keys = rangeKeys(todayKey(), 14);
    return keys.map((k) => {
      const t = dayFoodTotals(snap, k);
      const sl = snap.days[k]?.sleep;
      return {
        d: shortDate(k),
        kcal: Math.round(t.kcal),
        prot: Math.round(t.prot),
        water: waterTotal(snap, k),
        move: workoutMinTotal(snap, k),
        steps: snap.days[k]?.steps || 0,
        sleep: sl ? Math.round((sleepDuration(sl.bed, sl.wake) / 60) * 10) / 10 : 0,
      };
    });
  }, [snap]);
  const week = rangeKeys(todayKey(), 7);
  const heat = rangeKeys(todayKey(), 84);
  const insights = useMemo(() => weeklyInsights(snap), [snap]);
  const wChart = useMemo(() => {
    const pts = buildWeightChart(snap.weights, snap.goals.weight);
    return pts.map((p) => ({ ...p, bandSpan: p.bandHigh - p.bandLow }));
  }, [snap.weights, snap.goals.weight]);
  const pesoDomain = useMemo(() => pesoYDomain(wChart), [wChart]);
  const trend = useMemo(() => weightTrend(snap), [snap]);
  const units = snap.settings.units;

  const weekKcal = week.reduce((a, k) => a + dayFoodTotals(snap, k).kcal, 0);
  const weekProt = week.reduce((a, k) => a + dayFoodTotals(snap, k).prot, 0);
  const logged = week.filter((k) => dayFoodTotals(snap, k).kcal > 0).length;
  const hasAny = logged > 0 || snap.weights.length > 0 || week.some((k) => (snap.days[k]?.steps || 0) > 0);

  return (
    <Screen>
      <Title sub="Últimas dos semanas y recap">Tendencias</Title>

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
                Si sigues así, llegarías en unos {trend.eta} días
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
        <div className="grid grid-cols-7 gap-1">
          {heat.map((k) => {
            const c = goalsMet(snap, k).count;
            return (
              <button
                key={k}
                type="button"
                title={`${k}: ${c}/5`}
                aria-label={`${k}: ${c} de 5 objetivos`}
                className={cn(
                  "aspect-square rounded-sm",
                  c >= 4 ? "bg-primary" : c >= 3 ? "bg-primary/70" : c > 0 ? "bg-primary/30" : "bg-muted",
                )}
                onClick={() => setViewDate(k)}
              />
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">12 semanas · toca un día para abrirlo</p>
      </Card>

      <Suspense fallback={<ChartSkeleton hasWeight={wChart.length > 0} />}>
        <TrendsCharts data={data} wChart={wChart} pesoDomain={pesoDomain} units={units} />
      </Suspense>
    </Screen>
  );
}
