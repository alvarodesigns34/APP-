import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ROUTINES, ROUTINE_LEVELS, parseRestSeconds } from "@/lib/brio/catalog";
import { useBrioStore } from "@/lib/brio/store";
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
  const [id, setId] = useState<string | null>(null);
  const [session, setSession] = useState(0);
  const routine = ROUTINES.find((r) => r.id === id);
  const [timer, setTimer] = useState<number | null>(null);

  useEffect(() => {
    if (timer == null) return;
    if (timer <= 0) {
      setTimer(null);
      return;
    }
    const t = setTimeout(() => setTimer((n) => (n == null ? n : n - 1)), 1000);
    return () => clearTimeout(t);
  }, [timer]);

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
                setTimer(null);
              }}
              className={cn("shrink-0 rounded-full px-3 py-1 text-xs", i === session ? "bg-primary text-primary-foreground" : "bg-muted")}
            >
              {s.name.split("·")[0]}
            </button>
          ))}
        </div>
        {timer != null && timer > 0 ? (
          <div className="mb-4 rounded-3xl bg-muted py-6 text-center">
            <div className="font-display text-5xl tabular-nums">{timer}s</div>
            <p className="text-sm text-muted-foreground">Descanso</p>
            <Button className="mt-3" variant="secondary" onClick={() => setTimer(null)}>
              Saltar
            </Button>
          </div>
        ) : null}
        <ul className="space-y-3">
          {sess.exercises.map((e) => {
            const rest = parseRestSeconds(e.rest);
            return (
              <li key={e.name} className="rounded-2xl bg-muted/50 p-3">
                <div className="font-medium">{e.name}</div>
                <div className="text-xs text-muted-foreground">{e.rx} · descanso {e.rest}</div>
                {rest > 0 ? (
                  <Button size="sm" variant="secondary" className="mt-2" onClick={() => setTimer(rest)}>
                    Descanso {rest}s
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
        <Button
          className="mt-4 w-full"
          onClick={() => {
            addWorkout(date, "fuerza", routine.minutes, "media");
            toast.success("Sesión registrada");
            onOpenChange(false);
            setId(null);
            setTimer(null);
          }}
        >
          Registrar sesión · {routine.minutes} min
        </Button>
        <Button className="mt-2 w-full" variant="outline" onClick={() => { setId(null); setTimer(null); }}>
          Todas las rutinas
        </Button>
      </Sheet>
    );
  }

  const sorted = [...ROUTINES].sort((a, b) => Number(b.purposes.includes(purpose)) - Number(a.purposes.includes(purpose)));
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Rutinas">
      <ul className="space-y-2">
        {sorted.map((r) => (
          <li key={r.id}>
            <button type="button" className="w-full rounded-2xl bg-muted/50 px-3 py-3 text-left" onClick={() => { setId(r.id); setSession(0); }}>
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
