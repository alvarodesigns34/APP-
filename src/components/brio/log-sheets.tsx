import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ACTIVITIES, ACTIVITY_GROUPS, INTENSITIES } from "@/lib/brio/domain";
import { useBrioStore } from "@/lib/brio/store";
import { latestWeight } from "@/lib/brio/selectors";
import { parseNum } from "@/lib/brio/format";
import { clockToMinutes, fmtDateRelative, minutesToClock, minutesToHM, sleepDuration } from "@/lib/brio/dates";
import {
  displayToKg,
  displayToMl,
  fmtVolume,
  fmtWeight,
  kgToDisplay,
  volumeUnit,
  weightUnit,
} from "@/lib/brio/units";
import type { IntensityId } from "@/lib/brio/types";
import { cn } from "@/lib/utils";

export function WaterSheet({ open, onOpenChange, date }: { open: boolean; onOpenChange: (v: boolean) => void; date: string }) {
  const add = useBrioStore((s) => s.addWater);
  const remove = useBrioStore((s) => s.removeWater);
  const glass = useBrioStore((s) => s.settings.glass);
  const units = useBrioStore((s) => s.settings.units);
  const goal = useBrioStore((s) => s.goals.water);
  const day = useBrioStore((s) => s.days[date]);
  const glasses = day?.water;
  const total = glasses ? glasses.reduce((a, w) => a + w.ml, 0) : 0;
  const [custom, setCustom] = useState("");

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
              <button type="button" aria-label="Quitar vaso" className="min-h-11 px-2 text-xs text-muted-foreground" onClick={() => remove(date, w.id)}>
                Quitar
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 text-sm text-muted-foreground">Aún no hay vasos {fmtDateRelative(date).toLowerCase()}.</p>
      )}
      <div className="grid grid-cols-3 gap-2">
        {[glass, 200, 500].map((ml, i) => (
          <Button key={`${ml}-${i}`} variant="secondary" onClick={() => addAmount(ml)}>
            +{fmtVolume(ml, units)}
          </Button>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <Input
          inputMode="decimal"
          placeholder={`Otra cantidad (${volumeUnit(units)})`}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
        />
        <Button
          onClick={() => {
            const n = parseNum(custom);
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

export function StepsSheet({ open, onOpenChange, date }: { open: boolean; onOpenChange: (v: boolean) => void; date: string }) {
  const steps = useBrioStore((s) => s.days[date]?.steps ?? 0);
  const setSteps = useBrioStore((s) => s.setSteps);
  const [v, setV] = useState(String(steps));
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
            toast.success("Pasos actualizados");
          }}
        >
          Guardar
        </Button>
      }
    >
      <Input inputMode="numeric" value={v} onChange={(e) => setV(e.target.value)} />
    </Sheet>
  );
}

export function SleepSheet({ open, onOpenChange, date }: { open: boolean; onOpenChange: (v: boolean) => void; date: string }) {
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
              toast.success("Sueño guardado");
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
                toast.success("Sueño borrado");
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

export function WorkoutSheet({ open, onOpenChange, date }: { open: boolean; onOpenChange: (v: boolean) => void; date: string }) {
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
            add(date, type, parseNum(min) || 30, intensity);
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
                  "rounded-full px-3 py-1 text-xs",
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
          <Button key={i.id} variant={intensity === i.id ? "default" : "secondary"} size="sm" onClick={() => setIntensity(i.id)}>
            {i.n}
          </Button>
        ))}
      </div>
    </Sheet>
  );
}

export function WeightSheet({ open, onOpenChange, date }: { open: boolean; onOpenChange: (v: boolean) => void; date: string }) {
  const upsert = useBrioStore((s) => s.upsertWeight);
  const del = useBrioStore((s) => s.deleteWeight);
  const patchProfile = useBrioStore((s) => s.patchProfile);
  const units = useBrioStore((s) => s.settings.units);
  const weights = useBrioStore((s) => s.weights);
  const profileWeight = useBrioStore((s) => s.profile.weight);
  const state = useBrioStore.getState();
  const current = weights.find((w) => w.date === date)?.kg ?? latestWeight(state, date)?.kg ?? profileWeight;
  const [v, setV] = useState(String(kgToDisplay(current, units)));

  useEffect(() => {
    if (open) setV(String(kgToDisplay(current, units)));
  }, [open, date, units, current]);

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
            const n = parseNum(v);
            if (!n) return;
            const kg = displayToKg(n, units);
            upsert(date, kg);
            patchProfile({ weight: kg });
            onOpenChange(false);
          }}
        >
          Guardar
        </Button>
      }
    >
      <label className="text-sm font-medium">Peso ({weightUnit(units)})</label>
      <Input className="mb-4" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} />
      {weights.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin registros de peso.</p>
      ) : (
        <ul className="divide-y divide-border">
          {weights.slice(start).reverse().map((w) => (
            <li key={w.date} className="flex items-center justify-between py-2 text-sm">
              <span>
                {fmtDateRelative(w.date)}
                <span className="block text-xs text-muted-foreground">{fmtWeight(w.kg, units)}</span>
              </span>
              <button type="button" aria-label="Quitar peso" className="min-h-11 px-2 text-xs text-muted-foreground" onClick={() => del(w.date)}>
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
