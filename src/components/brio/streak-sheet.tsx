import { useCallback, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { Sheet } from "@/components/ui/sheet";
import { currentStreak, goalsMet } from "@/lib/brio/selectors";
import { rangeKeys, todayKey } from "@/lib/brio/dates";
import { useBrioStore } from "@/lib/brio/store";
import { cn } from "@/lib/utils";
import { MonthCal } from "./month-cal";

const MILESTONES = [
  { n: "3 días seguidos", goal: 3 },
  { n: "7 días seguidos", goal: 7 },
  { n: "14 días seguidos", goal: 14 },
  { n: "30 días seguidos", goal: 30 },
];

export function StreakSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
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

  // The sheet stays mounted so vaul can animate it both ways, which means this
  // body re-renders on every store change. `currentStreak` walks back up to 400
  // days and the strip adds 14 more `goalsMet` passes, so both are gated on
  // `open`: closed, this component costs nothing.
  const streak = useMemo(() => (open ? currentStreak(snap) : 0), [snap, open]);
  const stripCounts = useMemo(
    () => (open ? rangeKeys(todayKey(), 14).map((k) => ({ k, c: goalsMet(snap, k).count })) : []),
    [snap, open],
  );
  const countFor = useCallback((k: string) => goalsMet(snap, k).count, [snap]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Racha">
      <p className="mb-1 font-display text-3xl tabular-nums">{streak} días</p>
      <p className="mb-4 text-sm text-muted-foreground">Cumple 3 objetivos en un día para que cuente en la racha.</p>
      <div className="mb-6 grid grid-cols-7 gap-1">
        {stripCounts.map(({ k, c }) => (
          <div
            key={k}
            className={cn("aspect-square rounded-md", c >= 3 ? "bg-primary" : c > 0 ? "bg-primary/40" : "bg-muted")}
            title={k}
          />
        ))}
      </div>
      <MonthCal
        open={open}
        countFor={countFor}
        onSelect={(k) => {
          setViewDate(k);
          onOpenChange(false);
        }}
      />
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
