import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Empty, SectionLabel } from "@/components/brio/section";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { addDays, fmtDateRelative, todayKey } from "@/lib/brio/dates";
import { nf } from "@/lib/brio/format";
import { habitTitle, habitualMeals, type MealHabit } from "@/lib/brio/meals";
import { useBrioStore } from "@/lib/brio/store";
import { MEALS, type MealId } from "@/lib/brio/types";
import { cn } from "@/lib/utils";

export function MealHabits({ date }: { date: string }) {
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
  const cloneMealEntries = useBrioStore((s) => s.cloneMealEntries);
  // Groups 28 days of meals into a Map; recomputing that on every store change
  // was pure waste. The slice above also replaces a hidden `<span>` that only
  // existed to keep `days` subscribed.
  const habits = useMemo(() => habitualMeals(snap), [snap]);
  const [open, setOpen] = useState<MealHabit | null>(null);
  const [slot, setSlot] = useState<MealId>("desayuno");

  function apply(habit: MealHabit, meal: MealId) {
    cloneMealEntries(date, meal, habit.entries);
    setOpen(null);
  }

  if (habits.length === 0) {
    return (
      <>
        <SectionLabel>Comidas habituales</SectionLabel>
        <Empty
          title="Aún no hay comidas de siempre"
          body="Cuando repitas un desayuno o una cena, aparecerá aquí para añadirla de un toque."
        />
      </>
    );
  }

  return (
    <>
      <SectionLabel>Comidas habituales</SectionLabel>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {habits.map((h) => (
          <button
            key={h.sig}
            type="button"
            className="min-w-[13.5rem] rounded-2xl bg-card p-3 text-left shadow-card"
            onClick={() => {
              setSlot(h.meal);
              setOpen(h);
            }}
          >
            <div className="line-clamp-2 text-sm font-medium">{habitTitle(h.names)}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {h.entries.length} {h.entries.length === 1 ? "alimento" : "alimentos"} · {nf(h.kcal)} kcal
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {h.lastKey === addDays(todayKey(), -1) ? "Ayer" : `×${h.count} este mes`}
            </div>
          </button>
        ))}
      </div>

      <Sheet
        open={!!open}
        onOpenChange={(v) => !v && setOpen(null)}
        title={open ? habitTitle(open.names) : "Comida"}
        footer={
          open ? (
            <Button className="w-full" onClick={() => apply(open, slot)}>
              Añadir a {MEALS.find((m) => m.id === slot)?.n.toLowerCase()} · {nf(open.kcal)} kcal
            </Button>
          ) : null
        }
      >
        {open ? (
          <div>
            <p className="mb-3 text-sm text-muted-foreground">
              Cantidades de {fmtDateRelative(open.lastKey).toLowerCase()}
            </p>
            <div className="mb-4 flex gap-1 overflow-x-auto">
              {MEALS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSlot(m.id)}
                  className={cn(
                    "min-h-11 shrink-0 rounded-full px-3 text-xs font-medium",
                    slot === m.id ? "bg-primary text-primary-foreground" : "bg-muted",
                  )}
                >
                  {m.n}
                </button>
              ))}
            </div>
            <ul className="divide-y divide-border">
              {open.entries.map((e) => (
                <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="min-w-0 truncate">{e.name}</span>
                  <span className="tabular-nums text-muted-foreground">{nf(e.kcal)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Sheet>
    </>
  );
}
