import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { Star } from "lucide-react";
import { Empty, SectionLabel } from "@/components/brio/section";
import { getFood } from "@/lib/brio/catalog";
import { nf } from "@/lib/brio/format";
import { habitualFoodIds, slotForQuickAdd } from "@/lib/brio/selectors";
import { lastPortion } from "@/lib/brio/selectors-catalog";
import { useBrioStore } from "@/lib/brio/store";
import { useCatalog } from "@/lib/brio/use-catalog";
import { CatalogInlineNotice } from "@/components/brio/catalog-state";
import { MEALS, type Food } from "@/lib/brio/types";

type QuickRow = { food: Food; portion: NonNullable<ReturnType<typeof lastPortion>> };

export function QuickAddStrip({ date }: { date: string }) {
  const catalog = useCatalog();
  const ready = catalog.ready;
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
  const addMeal = useBrioStore((s) => s.addMeal);
  const favorites = snap.favorites;

  const meal = slotForQuickAdd(date);
  const mealName = MEALS.find((m) => m.id === meal)?.n.toLowerCase() ?? "comida";

  // `habitualFoodIds` walks 21 days and `lastPortion` walks 60 more for each of
  // the 8 chips. Unmemoized that ran on every store change — the most expensive
  // thing on Hoy. The store slice above also replaces a hidden `<span>` that
  // existed only to keep `days` subscribed.
  const rows = useMemo<QuickRow[]>(() => {
    if (!ready) return [];
    const ctx = { customFoods: snap.customFoods, recipes: snap.recipes };
    const ids: string[] = [];
    for (const id of [...snap.favorites, ...snap.recents, ...habitualFoodIds(snap, 8)]) {
      if (!ids.includes(id)) ids.push(id);
      if (ids.length >= 8) break;
    }
    const out: QuickRow[] = [];
    for (const id of ids) {
      const food = getFood(id, ctx);
      if (!food) continue;
      const portion = lastPortion(snap, food.id);
      if (!portion) continue;
      out.push({ food, portion });
    }
    return out;
  }, [ready, snap]);

  if (!ready) {
    return (
      <>
        <SectionLabel>Al vuelo</SectionLabel>
        <CatalogInlineNotice state={catalog} loadingText="Cargando tus alimentos…" />
      </>
    );
  }

  if (rows.length === 0) {
    return (
      <>
        <SectionLabel>Al vuelo</SectionLabel>
        <Empty
          title="Nada que añadir al vuelo"
          body="Marca alimentos con la estrella al registrarlos. Los recientes también aparecen aquí."
        />
      </>
    );
  }

  return (
    <>
      <SectionLabel>Al vuelo · {mealName}</SectionLabel>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {rows.map(({ food: f, portion }) => {
          const slot = meal;
          return (
            <button
              key={f.id}
              type="button"
              className="min-h-16 shrink-0 rounded-2xl bg-card px-3 py-2 text-left shadow-[0_1px_2px_rgba(28,27,22,0.04)]"
              onClick={() => {
                addMeal(date, slot, f, portion.grams, portion.qty, portion.unitName);
              }}
            >
              <span className="flex items-center gap-1">
                {favorites.includes(f.id) ? <Star className="size-3 fill-primary text-primary" /> : null}
                <span className="block max-w-[9.5rem] truncate text-sm font-medium">{f.name}</span>
              </span>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {portion.qty === 1
                  ? portion.unitName
                  : `${nf(portion.qty, portion.qty % 1 === 0 ? 0 : 2)} ${portion.unitName}`}
                {" · "}
                {nf(portion.kcal)} kcal
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
