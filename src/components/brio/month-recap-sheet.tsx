import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Empty } from "@/components/brio/section";
import { addMonths, fmtMonthYear, monthStart, todayKey } from "@/lib/brio/dates";
import { monthRecap } from "@/lib/brio/month-recap";
import { nf } from "@/lib/brio/format";
import { fmtWeight } from "@/lib/brio/units";
import { useBrioStore } from "@/lib/brio/store";
import type { WeekDelta } from "@/lib/brio/week-compare";
import { cn } from "@/lib/utils";

function DeltaText({ d, unit, invert }: { d: WeekDelta; unit: string; invert?: boolean }) {
  if (d.dir === "flat" || d.pct == null) return <span className="text-muted-foreground">igual</span>;
  // `invert` para las kcal: subir no es «mejor» ni «peor» por sí mismo, así que
  // ahí no se colorea nada y solo se dice el número. Donde más es mejor
  // (pasos, minutos) sí se marca.
  const good = invert ? null : d.dir === "up";
  return (
    <span className={cn(good == null ? "text-muted-foreground" : good ? "text-primary" : "text-muted-foreground")}>
      {d.dir === "up" ? "+" : "−"}
      {nf(Math.abs(d.abs))}
      {unit}
      {" · "}
      {d.dir === "up" ? "+" : "−"}
      {nf(Math.abs(d.pct))} %
    </span>
  );
}

function Row({ label, value, right }: { label: string; value: string; right?: React.ReactNode }) {
  return (
    <li className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right tabular-nums">
        <b className="font-medium">{value}</b>
        {right ? <span className="ml-2 text-xs">{right}</span> : null}
      </span>
    </li>
  );
}

export function MonthRecapSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const snap = useBrioStore(
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
  const units = snap.settings.units;
  const [monthKey, setMonthKey] = useState(() => monthStart(todayKey()));

  // Recorre un mes entero de días; cerrada la hoja no hace falta calcularlo.
  const r = useMemo(() => (open ? monthRecap(snap, monthKey) : null), [snap, monthKey, open]);

  // Sin tope por abajo a propósito: se puede seguir hacia atrás y ver meses
  // vacíos, que es información («no registré nada en marzo»). Hacia delante sí,
  // porque un mes futuro no puede tener nada.
  const canForward = monthKey < monthStart(todayKey());

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Tu mes">
      <div className="mb-4 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Mes anterior"
          className="grid size-11 place-items-center rounded-full"
          onClick={() => setMonthKey((k) => addMonths(k, -1))}
        >
          <ChevronLeft className="size-5" />
        </button>
        <span className="font-display text-xl tracking-tight">{fmtMonthYear(monthKey)}</span>
        <button
          type="button"
          aria-label="Mes siguiente"
          disabled={!canForward}
          className="grid size-11 place-items-center rounded-full disabled:opacity-30"
          onClick={() => setMonthKey((k) => addMonths(k, 1))}
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      {r == null ? null : r.curr.foodDays === 0 && r.curr.moveMin === 0 && r.curr.stepsAvg === 0 ? (
        <Empty title="Nada registrado este mes" body="Los meses en los que apuntes algo aparecerán aquí resumidos." />
      ) : (
        <>
          <ul className="mb-4 divide-y divide-border">
            <Row label="Días con comida" value={`${nf(r.curr.foodDays)}`} />
            <Row
              label="Calorías al día"
              value={`${nf(r.curr.kcalAvg)} kcal`}
              right={r.prevEmpty ? null : <DeltaText d={r.deltas.kcal} unit=" kcal" invert />}
            />
            <Row
              label="Proteína al día"
              value={`${nf(r.curr.protAvg)} g`}
              right={r.prevEmpty ? null : <DeltaText d={r.deltas.prot} unit=" g" />}
            />
            <Row
              label="Pasos al día"
              value={nf(r.curr.stepsAvg)}
              right={r.prevEmpty ? null : <DeltaText d={r.deltas.steps} unit="" />}
            />
            <Row
              label="Ejercicio"
              value={`${nf(r.curr.moveMin)} min`}
              right={r.prevEmpty ? null : <DeltaText d={r.deltas.move} unit=" min" />}
            />
            <Row label="Días entrenados" value={`${nf(r.trainedDays)}`} />
            {r.weightDelta != null ? (
              <Row
                label="Peso"
                value={`${r.weightDelta > 0 ? "+" : r.weightDelta < 0 ? "−" : ""}${fmtWeight(Math.abs(r.weightDelta), units)}`}
              />
            ) : null}
          </ul>
          <p className="text-xs text-muted-foreground">
            {r.prevEmpty
              ? `Sin datos de ${fmtMonthYear(r.prevKey).toLowerCase()} con los que comparar.`
              : `Comparado con ${fmtMonthYear(r.prevKey).toLowerCase()}.`}
            {" Calorías y proteína son medias de los días con comida registrada; pasos, de todos los días del mes. Por eso un mes que empezaste a mitad sale más bajo en pasos."}
          </p>
          {r.weightDelta == null && r.curr.foodDays > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Pésate al menos dos veces en el mes para ver aquí el cambio de peso.
            </p>
          ) : null}
        </>
      )}
    </Sheet>
  );
}
