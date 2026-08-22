import { useEffect, useRef, useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ACTIVITIES, ACTIVITY_GROUPS, INTENSITIES } from "@/lib/brio/domain";
import { useBrioStore } from "@/lib/brio/store";
import { latestWeight } from "@/lib/brio/selectors";
import { nf, parseNum, parsePositive, round } from "@/lib/brio/format";
import { clockToMinutes, fmtDateRelative, minutesToClock, minutesToHM, sleepDuration } from "@/lib/brio/dates";
import {
  displayToKg,
  displayToMl,
  fmtVolume,
  fmtWeight,
  kgToDisplay,
  uniqueGlassAmounts,
  volumeUnit,
  weightUnit,
} from "@/lib/brio/units";
import type { IntensityId } from "@/lib/brio/types";
import { cn } from "@/lib/utils";

/** Focus a quick-log input after vaul has painted. Delayed so iOS does not fight the keyboard. */
function useOpenFocus(open: boolean, select = false) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      if (select) el.select();
    }, 180);
    return () => window.clearTimeout(id);
  }, [open, select]);
  return ref;
}

export function WaterSheet({
  open,
  onOpenChange,
  date,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  date: string;
}) {
  const add = useBrioStore((s) => s.addWater);
  const remove = useBrioStore((s) => s.removeWater);
  const glass = useBrioStore((s) => s.settings.glass);
  const units = useBrioStore((s) => s.settings.units);
  const goal = useBrioStore((s) => s.goals.water);
  const day = useBrioStore((s) => s.days[date]);
  const glasses = day?.water;
  const total = glasses ? glasses.reduce((a, w) => a + w.ml, 0) : 0;
  const [custom, setCustom] = useState("");
  const customRef = useOpenFocus(open);

  function addAmount(ml: number) {
    add(date, ml);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Agua">
      <p className="mb-4 text-sm text-muted-foreground">
        {fmtVolume(total, units)} / {fmtVolume(goal, units)}
      </p>
      {glasses && glasses.length > 0 ? (
        <ul className="mb-4 divide-y divide-border">
          {glasses.map((w) => (
            <li key={w.id} className="flex items-center justify-between py-2 text-sm">
              <span>{fmtVolume(w.ml, units)}</span>
              <button
                type="button"
                aria-label="Quitar vaso"
                className="min-h-11 px-2 text-xs text-muted-foreground"
                onClick={() => remove(date, w.id)}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 text-sm text-muted-foreground">Aún no hay vasos {fmtDateRelative(date).toLowerCase()}.</p>
      )}
      <div className="grid grid-cols-3 gap-2">
        {uniqueGlassAmounts(glass).map((ml) => (
          <Button key={ml} variant="secondary" onClick={() => addAmount(ml)}>
            +{fmtVolume(ml, units)}
          </Button>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <Input
          ref={customRef}
          inputMode="decimal"
          placeholder={`Otra cantidad (${volumeUnit(units)})`}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
        />
        <Button
          onClick={() => {
            const n = parsePositive(custom);
            if (!n) return;
            const ml = displayToMl(n, units);
            add(date, ml);
            setCustom("");
          }}
        >
          Añadir
        </Button>
      </div>
    </Sheet>
  );
}

export function StepsSheet({
  open,
  onOpenChange,
  date,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  date: string;
}) {
  const steps = useBrioStore((s) => s.days[date]?.steps ?? 0);
  const setSteps = useBrioStore((s) => s.setSteps);
  const [v, setV] = useState(String(steps));
  const inputRef = useOpenFocus(open, true);
  useEffect(() => {
    if (open) setV(String(steps));
  }, [open, steps, date]);
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Pasos"
      footer={
        <Button
          className="w-full"
          onClick={() => {
            setSteps(date, parseNum(v) || 0);
            onOpenChange(false);
          }}
        >
          Guardar
        </Button>
      }
    >
      <Input ref={inputRef} inputMode="numeric" value={v} onChange={(e) => setV(e.target.value)} />
    </Sheet>
  );
}

export function SleepSheet({
  open,
  onOpenChange,
  date,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  date: string;
}) {
  const sleep = useBrioStore((s) => s.days[date]?.sleep);
  const setSleep = useBrioStore((s) => s.setSleep);
  const goal = useBrioStore((s) => s.goals.sleep);
  const [bed, setBed] = useState(minutesToClock(sleep?.bed ?? 23 * 60));
  const [wake, setWake] = useState(minutesToClock(sleep?.wake ?? 7 * 60));
  useEffect(() => {
    if (!open) return;
    setBed(minutesToClock(sleep?.bed ?? 23 * 60));
    setWake(minutesToClock(sleep?.wake ?? 7 * 60));
  }, [open, sleep, date]);
  const dur = sleepDuration(clockToMinutes(bed), clockToMinutes(wake));
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Sueño"
      footer={
        <div className="space-y-2">
          <Button
            className="w-full"
            disabled={dur <= 0}
            onClick={() => {
              if (dur <= 0) return;
              setSleep(date, { bed: clockToMinutes(bed), wake: clockToMinutes(wake) });
              onOpenChange(false);
            }}
          >
            Guardar · {minutesToHM(dur)}
          </Button>
          {sleep ? (
            <Button
              className="w-full"
              variant="ghost"
              onClick={() => {
                setSleep(date, null);
                onOpenChange(false);
              }}
            >
              Quitar
            </Button>
          ) : null}
        </div>
      }
    >
      <label className="text-sm font-medium">Acostarte</label>
      <Input type="time" className="mb-3" value={bed} onChange={(e) => setBed(e.target.value)} />
      <label className="text-sm font-medium">Levantarte</label>
      <Input type="time" value={wake} onChange={(e) => setWake(e.target.value)} />
      <p className="mt-3 text-sm text-muted-foreground">
        {dur <= 0 ? "Elige horas distintas." : `${minutesToHM(dur)} · objetivo ${minutesToHM(goal)}`}
      </p>
    </Sheet>
  );
}

export function WorkoutSheet({
  open,
  onOpenChange,
  date,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  date: string;
}) {
  const add = useBrioStore((s) => s.addWorkout);
  const [type, setType] = useState(ACTIVITIES[0].id);
  const [min, setMin] = useState("45");
  const [intensity, setIntensity] = useState<IntensityId>("media");
  useEffect(() => {
    if (!open) return;
    setType(ACTIVITIES[0].id);
    setMin("45");
    setIntensity("media");
  }, [open]);
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Entrenamiento"
      footer={
        <Button
          className="w-full"
          onClick={() => {
            add(date, type, parsePositive(min) || 30, intensity);
            onOpenChange(false);
          }}
        >
          Guardar
        </Button>
      }
    >
      {ACTIVITY_GROUPS.map((g) => (
        <div key={g.id} className="mb-3">
          <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">{g.n}</p>
          <div className="flex flex-wrap gap-1">
            {ACTIVITIES.filter((a) => a.g === g.id).map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setType(a.id)}
                className={cn(
                  "min-h-11 rounded-full px-3 py-1 text-xs",
                  type === a.id ? "bg-primary text-primary-foreground" : "bg-muted",
                )}
              >
                {a.n}
              </button>
            ))}
          </div>
        </div>
      ))}
      <label className="text-sm font-medium">Minutos</label>
      <Input className="mb-3" inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} />
      <div className="flex gap-2">
        {INTENSITIES.map((i) => (
          <Button
            key={i.id}
            variant={intensity === i.id ? "default" : "secondary"}
            size="sm"
            onClick={() => setIntensity(i.id)}
          >
            {i.n}
          </Button>
        ))}
      </div>
    </Sheet>
  );
}

export function WeightSheet({
  open,
  onOpenChange,
  date,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  date: string;
}) {
  const upsert = useBrioStore((s) => s.upsertWeight);
  const del = useBrioStore((s) => s.deleteWeight);
  const patchProfile = useBrioStore((s) => s.patchProfile);
  const units = useBrioStore((s) => s.settings.units);
  const weights = useBrioStore((s) => s.weights);
  const profileWeight = useBrioStore((s) => s.profile.weight);
  const state = useBrioStore.getState();
  const today = weights.find((w) => w.date === date);
  const current = today?.kg ?? latestWeight(state, date)?.kg ?? profileWeight;
  const [v, setV] = useState(String(kgToDisplay(current, units)));
  // Body composition is optional and most days it is not filled in, so the two
  // fields stay folded away until asked for. The data model, the undo path and
  // the CSV export already carried them; nothing could enter them until now.
  const [fat, setFat] = useState("");
  const [muscle, setMuscle] = useState("");
  const [showComp, setShowComp] = useState(false);
  const inputRef = useOpenFocus(open, true);

  useEffect(() => {
    if (!open) return;
    setV(String(kgToDisplay(current, units)));
    setFat(today?.fat != null ? String(today.fat) : "");
    setMuscle(today?.muscle != null ? String(today.muscle) : "");
    setShowComp(today?.fat != null || today?.muscle != null);
  }, [open, date, units, current, today?.fat, today?.muscle]);

  const start = Math.max(0, weights.length - 8);

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Peso"
      footer={
        <Button
          className="w-full"
          onClick={() => {
            const n = parsePositive(v);
            if (!n) return;
            const kg = displayToKg(n, units);
            const pct = (raw: string) => {
              const p = parsePositive(raw);
              return Number.isFinite(p) && p <= 100 ? round(p, 1) : undefined;
            };
            const f = pct(fat);
            const m = pct(muscle);
            upsert(date, kg, f != null || m != null ? { fat: f, muscle: m } : undefined);
            patchProfile({ weight: kg });
            onOpenChange(false);
          }}
        >
          Guardar
        </Button>
      }
    >
      <label className="text-sm font-medium" htmlFor="weight-kg">
        Peso ({weightUnit(units)})
      </label>
      <Input
        id="weight-kg"
        ref={inputRef}
        className="mb-3"
        inputMode="decimal"
        value={v}
        onChange={(e) => setV(e.target.value)}
      />

      {showComp ? (
        <div className="mb-4 grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground" htmlFor="weight-fat">
              Grasa (%)
            </label>
            <Input
              id="weight-fat"
              inputMode="decimal"
              placeholder="opcional"
              value={fat}
              onChange={(e) => setFat(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground" htmlFor="weight-muscle">
              Músculo (%)
            </label>
            <Input
              id="weight-muscle"
              inputMode="decimal"
              placeholder="opcional"
              value={muscle}
              onChange={(e) => setMuscle(e.target.value)}
            />
          </div>
        </div>
      ) : (
        <Button variant="ghost" size="sm" className="mb-4 w-full" onClick={() => setShowComp(true)}>
          Añadir grasa y músculo
        </Button>
      )}

      {weights.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin registros de peso.</p>
      ) : (
        <ul className="divide-y divide-border">
          {weights
            .slice(start)
            .reverse()
            .map((w) => (
              <li key={w.date} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {fmtDateRelative(w.date)}
                  <span className="block text-xs text-muted-foreground">
                    {fmtWeight(w.kg, units)}
                    {w.fat != null ? ` · ${nf(w.fat, 1)} % grasa` : ""}
                    {w.muscle != null ? ` · ${nf(w.muscle, 1)} % músculo` : ""}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label="Quitar peso"
                  className="min-h-11 px-2 text-xs text-muted-foreground"
                  onClick={() => del(w.date)}
                >
                  Quitar
                </button>
              </li>
            ))}
        </ul>
      )}
    </Sheet>
  );
}
