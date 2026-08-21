import { Star } from "lucide-react";
import { toast } from "sonner";
import { Empty, SectionLabel } from "@/components/brio/section";
import { getFood } from "@/lib/brio/catalog";
import { nf } from "@/lib/brio/format";
import { habitualFoodIds, lastPortion, slotForQuickAdd } from "@/lib/brio/selectors";
import { useBrioStore } from "@/lib/brio/store";
import { MEALS, type Food } from "@/lib/brio/types";

export function QuickAddStrip({ date }: { date: string }) {
  const favorites = useBrioStore((s) => s.favorites);
  const recents = useBrioStore((s) => s.recents);
  const days = useBrioStore((s) => s.days);
  const customFoods = useBrioStore((s) => s.customFoods);
  const recipes = useBrioStore((s) => s.recipes);
  const addMeal = useBrioStore((s) => s.addMeal);
  const removeMeal = useBrioStore((s) => s.removeMeal);
  const snapshot = useBrioStore.getState();

  const ctx = { customFoods, recipes };
  const ids: string[] = [];
  for (const id of [...favorites, ...recents, ...habitualFoodIds(snapshot, 8)]) {
    if (!ids.includes(id)) ids.push(id);
    if (ids.length >= 8) break;
  }
  const foods = ids.map((id) => getFood(id, ctx)).filter((f): f is Food => !!f);
  const meal = slotForQuickAdd(date);
  const mealName = MEALS.find((m) => m.id === meal)?.n.toLowerCase() ?? "comida";

  if (foods.length === 0) {
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
        {foods.map((f) => {
          const portion = lastPortion(snapshot, f.id);
          if (!portion) return null;
          const slot = meal;
          return (
            <button
              key={f.id}
              type="button"
              className="min-h-16 shrink-0 rounded-2xl bg-card px-3 py-2 text-left shadow-[0_1px_2px_rgba(28,27,22,0.04)]"
              onClick={() => {
                const id = addMeal(date, slot, f.id, portion.grams, portion.qty, portion.unitName);
                toast.success(`Añadido a ${mealName}`, {
                  action: id
                    ? { label: "Deshacer", onClick: () => removeMeal(date, slot, id) }
                    : undefined,
                });
              }}
            >
              <span className="flex items-center gap-1">
                {favorites.includes(f.id) ? <Star className="size-3 fill-primary text-primary" /> : null}
                <span className="block max-w-[9.5rem] truncate text-sm font-medium">{f.name}</span>
              </span>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {portion.qty === 1 ? portion.unitName : `${nf(portion.qty, portion.qty % 1 === 0 ? 0 : 2)} ${portion.unitName}`}
                {" · "}
                {nf(portion.kcal)} kcal
              </span>
            </button>
          );
        })}
      </div>
      <span className="hidden">{Object.keys(days).length}</span>
    </>
  );
}
