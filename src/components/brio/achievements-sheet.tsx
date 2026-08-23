import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { Check, Lock } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import {
  achievements,
  achievementsDone,
  GROUP_NAMES,
  type Achievement,
  type AchievementGroup,
} from "@/lib/brio/achievements";
import { currentStreak } from "@/lib/brio/selectors";
import { nf } from "@/lib/brio/format";
import { useBrioStore } from "@/lib/brio/store";
import { cn } from "@/lib/utils";

export function AchievementRow({ a }: { a: Achievement }) {
  const pct = a.of != null && a.of > 0 ? Math.min(100, ((a.at ?? 0) / a.of) * 100) : 0;
  return (
    <li className="flex items-start gap-3 py-2">
      <span
        className={cn(
          "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full",
          a.done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
        aria-hidden="true"
      >
        {a.done ? <Check className="size-4" /> : <Lock className="size-3.5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={cn("text-sm font-medium", !a.done && "text-muted-foreground")}>{a.n}</span>
          {a.of != null ? (
            <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
              {a.done ? "Hecho" : `${nf(a.at ?? 0)}/${nf(a.of)}`}
            </span>
          ) : (
            <span className="shrink-0 text-xs text-muted-foreground">{a.done ? "Hecho" : ""}</span>
          )}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{a.hint}</span>
        {/* Barra solo en los que se cuentan y aún no están: en los de una vez
            una barra al 0 % o al 100 % no añade nada al icono de al lado. */}
        {!a.done && a.of != null ? (
          <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full bg-primary/50" style={{ width: `${pct}%` }} />
          </span>
        ) : null}
      </span>
    </li>
  );
}

export function AchievementsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
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

  // Igual que la hoja de Racha: esto sigue montado al cerrarse para que vaul
  // pueda animarlo, y `currentStreak` recorre hasta 400 días. Cerrada no cuesta.
  const list = useMemo(() => (open ? achievements(snap, currentStreak(snap)) : []), [snap, open]);
  const done = achievementsDone(list);

  const groups = useMemo(() => {
    const by = new Map<AchievementGroup, Achievement[]>();
    for (const a of list) {
      const arr = by.get(a.group) ?? [];
      arr.push(a);
      by.set(a.group, arr);
    }
    return [...by.entries()];
  }, [list]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Logros">
      <p className="mb-1 font-display text-3xl tabular-nums">
        {done} <span className="text-muted-foreground">de {list.length}</span>
      </p>
      <p className="mb-5 text-sm text-muted-foreground">
        Se calculan solos con lo que ya has ido registrando. No hay nada que activar.
      </p>
      {groups.map(([group, items]) => (
        <div key={group} className="mb-4">
          <h3 className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {GROUP_NAMES[group]}
          </h3>
          <ul className="divide-y divide-border">
            {items.map((a) => (
              <AchievementRow key={a.id} a={a} />
            ))}
          </ul>
        </div>
      ))}
    </Sheet>
  );
}
