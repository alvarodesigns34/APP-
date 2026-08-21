import { Sheet } from "@/components/ui/sheet";
import { currentStreak, goalsMet } from "@/lib/brio/selectors";
import { rangeKeys, todayKey } from "@/lib/brio/dates";
import { useBrioStore } from "@/lib/brio/store";
import { cn } from "@/lib/utils";

const MILESTONES = [
  { n: "3 días seguidos", goal: 3 },
  { n: "7 días seguidos", goal: 7 },
  { n: "14 días seguidos", goal: 14 },
  { n: "30 días seguidos", goal: 30 },
];

export function StreakSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const s = useBrioStore();
  const streak = currentStreak(s);
  const last14 = rangeKeys(todayKey(), 14);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Racha">
      <p className="mb-1 font-display text-3xl tabular-nums">{streak} días</p>
      <p className="mb-4 text-sm text-muted-foreground">
        Cumple 3 objetivos en un día para que cuente en la racha.
      </p>
      <div className="mb-6 grid grid-cols-7 gap-1">
        {last14.map((k) => {
          const c = goalsMet(s, k).count;
          return (
            <div
              key={k}
              className={cn("aspect-square rounded-md", c >= 3 ? "bg-primary" : c > 0 ? "bg-primary/40" : "bg-muted")}
              title={k}
            />
          );
        })}
      </div>
      <ul className="space-y-2">
        {MILESTONES.map((m) => (
          <li key={m.goal} className="flex justify-between text-sm">
            <span>{m.n}</span>
            <span className={streak >= m.goal ? "text-primary" : "text-muted-foreground"}>
              {streak >= m.goal ? "Hecho" : `${streak}/${m.goal}`}
            </span>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
