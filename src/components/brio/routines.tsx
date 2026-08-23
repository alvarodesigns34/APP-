import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ROUTINES, ROUTINE_LEVELS, parseRestSeconds } from "@/lib/brio/catalog";
import { INTENSITIES } from "@/lib/brio/domain";
import { remainingSeconds } from "@/lib/brio/timer";
import { useCatalog } from "@/lib/brio/use-catalog";
import { useBrioStore } from "@/lib/brio/store";
import type { IntensityId } from "@/lib/brio/types";
import { cn } from "@/lib/utils";

export function RoutinesSheet({
  open,
  onOpenChange,
  date,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  date: string;
}) {
  const purpose = useBrioStore((s) => s.profile.purpose);
  const addWorkout = useBrioStore((s) => s.addWorkout);
  const catalog = useCatalog();
  const catalogReady = catalog.ready;
  const [id, setId] = useState<string | null>(null);
  const [session, setSession] = useState(0);
  const routine = ROUTINES.find((r) => r.id === id);
  // The rest timer is an absolute instant, not a counter: see remainingSeconds().
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [intensity, setIntensity] = useState<IntensityId>("media");
  const rest = restEndsAt == null ? 0 : remainingSeconds(restEndsAt, now);

  useEffect(() => {
    if (restEndsAt == null) return;
    setNow(Date.now());
    // Twice a second so the number is right within half a second of coming back
    // to a throttled tab. Missing ticks no longer matter — each one just asks
    // the clock again.
    const t = window.setInterval(() => {
      const t0 = Date.now();
      setNow(t0);
      if (remainingSeconds(restEndsAt, t0) <= 0) setRestEndsAt(null);
    }, 500);
    return () => window.clearInterval(t);
  }, [restEndsAt]);

  if (routine) {
    const sess = routine.sessions[session] ?? routine.sessions[0];
    return (
      <Sheet open={open} onOpenChange={onOpenChange} title={routine.name}>
        <p className="mb-3 text-sm text-muted-foreground">{routine.blurb}</p>
        <div className="mb-3 flex gap-1 overflow-x-auto">
          {routine.sessions.map((s, i) => (
            <button
              key={s.name}
              type="button"
              onClick={() => {
                setSession(i);
                setRestEndsAt(null);
              }}
              className={cn(
                "min-h-11 shrink-0 rounded-full px-3 py-1 text-xs",
                i === session ? "bg-primary text-primary-foreground" : "bg-muted",
              )}
            >
              {s.name.split("·")[0]}
            </button>
          ))}
        </div>
        {rest > 0 ? (
          <div className="mb-4 rounded-3xl bg-muted py-6 text-center">
            <div className="font-display text-5xl tabular-nums">{rest}s</div>
            <p className="text-sm text-muted-foreground">Descanso</p>
            <Button className="mt-3" variant="secondary" onClick={() => setRestEndsAt(null)}>
              Saltar
            </Button>
          </div>
        ) : null}
        <ul className="space-y-3">
          {sess.exercises.map((e) => {
            const secs = parseRestSeconds(e.rest);
            return (
              <li key={e.name} className="rounded-2xl bg-muted/50 p-3">
                <div className="font-medium">{e.name}</div>
                <div className="text-xs text-muted-foreground">
                  {e.rx} · descanso {e.rest}
                </div>
                {secs > 0 ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-2"
                    onClick={() => setRestEndsAt(Date.now() + secs * 1000)}
                  >
                    Descanso {secs}s
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
        {/* The session was always logged as "media": a day where you left
            nothing on the bar and a day where you went through the motions
            landed on the same kcal. */}
        <p className="mb-1 mt-4 text-xs uppercase tracking-wider text-muted-foreground">Intensidad</p>
        <div className="flex gap-2">
          {INTENSITIES.map((i) => (
            <Button
              key={i.id}
              className="flex-1"
              variant={intensity === i.id ? "default" : "secondary"}
              size="sm"
              aria-pressed={intensity === i.id}
              onClick={() => setIntensity(i.id)}
            >
              {i.n}
            </Button>
          ))}
        </div>
        <Button
          className="mt-4 w-full"
          onClick={() => {
            addWorkout(date, "fuerza", routine.minutes, intensity);
            toast.success("Sesión registrada");
            onOpenChange(false);
            setId(null);
            setRestEndsAt(null);
            setIntensity("media");
          }}
        >
          Registrar sesión · {routine.minutes} min
        </Button>
        <Button
          className="mt-2 w-full"
          variant="outline"
          onClick={() => {
            setId(null);
            setRestEndsAt(null);
            setIntensity("media");
          }}
        >
          Todas las rutinas
        </Button>
      </Sheet>
    );
  }

  const sorted = (catalogReady ? [...ROUTINES] : []).sort(
    (a, b) => Number(b.purposes.includes(purpose)) - Number(a.purposes.includes(purpose)),
  );
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Rutinas">
      <ul className="space-y-2">
        {sorted.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              className="w-full rounded-2xl bg-muted/50 px-3 py-3 text-left"
              onClick={() => {
                setId(r.id);
                setSession(0);
              }}
            >
              <div className="font-medium">{r.name}</div>
              <div className="text-xs text-muted-foreground">
                {ROUTINE_LEVELS.find((l) => l.id === r.level)?.n} · {r.days} días · {r.minutes} min
              </div>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
