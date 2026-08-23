import { useMemo, useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CustomFoodSheet } from "@/components/brio/custom-food";
import { BASE_RECIPES } from "@/lib/brio/catalog";
import { energySplit, lastLogged, recipesUsingFood } from "@/lib/brio/food-detail";
import { fmtDateRelative, todayKey } from "@/lib/brio/dates";
import { nf } from "@/lib/brio/format";
import { useBrioStore } from "@/lib/brio/store";
import { useCatalog } from "@/lib/brio/use-catalog";
import { CATEGORIES, MEALS, type Food } from "@/lib/brio/types";

export function FoodDetailSheet({
  open,
  onOpenChange,
  food,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  food: Food;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const catalog = useCatalog();
  const catalogReady = catalog.ready;
  const days = useBrioStore((s) => s.days);
  const catLabel = CATEGORIES.find((c) => c.id === food.cat)?.n;
  const split = useMemo(() => energySplit(food), [food]);
  const recipes = useMemo(() => {
    if (!catalogReady) return [];
    return recipesUsingFood(food.id, BASE_RECIPES).slice(0, 8);
  }, [food.id, catalogReady]);
  const last = useMemo(() => lastLogged(days, food.id, todayKey()), [days, food.id]);
  const mealName = last ? (MEALS.find((m) => m.id === last.meal)?.n ?? last.meal) : null;
  const extras: { n: string; v: string }[] = [];
  if (food.sug != null) extras.push({ n: "Azúcares", v: `${nf(food.sug, 1)} g` });
  if (food.sat != null) extras.push({ n: "Saturada", v: `${nf(food.sat, 1)} g` });
  if (food.sod != null) extras.push({ n: "Sodio", v: `${nf(food.sod)} mg` });

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={food.name}
      footer={
        // Custom foods could be created but never edited or fixed after a
        // typo, and never removed — anything you added stayed forever.
        food.custom ? (
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setEditOpen(true)}>
              Editar
            </Button>
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </div>
        ) : (
          <Button type="button" variant="secondary" className="w-full" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        )
      }
    >
      <div className="space-y-5">
        {catLabel ? <p className="text-sm text-muted-foreground">{catLabel}</p> : null}

        <section>
          <h3 className="mb-2 text-sm font-medium">Por 100 {food.base}</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Energía</dt>
            <dd className="text-right tabular-nums">{nf(food.kcal)} kcal</dd>
            <dt className="text-muted-foreground">Proteína</dt>
            <dd className="text-right tabular-nums">{nf(food.prot, 1)} g</dd>
            <dt className="text-muted-foreground">Hidratos</dt>
            <dd className="text-right tabular-nums">{nf(food.carb, 1)} g</dd>
            <dt className="text-muted-foreground">Grasa</dt>
            <dd className="text-right tabular-nums">{nf(food.fat, 1)} g</dd>
            <dt className="text-muted-foreground">Fibra</dt>
            <dd className="text-right tabular-nums">{nf(food.fib, 1)} g</dd>
            {extras.map((x) => (
              <span key={x.n} className="contents">
                <dt className="text-muted-foreground">{x.n}</dt>
                <dd className="text-right tabular-nums">{x.v}</dd>
              </span>
            ))}
          </dl>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-medium">De dónde sale la energía</h3>
          <div className="mb-2 flex h-2 overflow-hidden rounded-full bg-muted">
            {split.prot > 0 ? <span className="bg-primary" style={{ width: `${split.prot}%` }} /> : null}
            {split.carb > 0 ? <span className="bg-primary/55" style={{ width: `${split.carb}%` }} /> : null}
            {split.fat > 0 ? <span className="bg-primary/25" style={{ width: `${split.fat}%` }} /> : null}
          </div>
          <ul className="text-sm">
            <li className="flex justify-between py-0.5">
              <span>Proteína</span>
              <span className="tabular-nums">{split.prot} %</span>
            </li>
            <li className="flex justify-between py-0.5">
              <span>Hidratos</span>
              <span className="tabular-nums">{split.carb} %</span>
            </li>
            <li className="flex justify-between py-0.5">
              <span>Grasa</span>
              <span className="tabular-nums">{split.fat} %</span>
            </li>
          </ul>
        </section>

        {food.units.length > 0 ? (
          <section>
            <h3 className="mb-2 text-sm font-medium">Unidades</h3>
            <ul className="text-sm">
              {food.units.map((u) => (
                <li key={u.name} className="flex justify-between py-0.5">
                  <span>{u.name}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {nf(u.g, u.g % 1 === 0 ? 0 : 1)} {food.base}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section>
          <h3 className="mb-2 text-sm font-medium">En recetas</h3>
          {recipes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No entra en las recetas de Brío.</p>
          ) : (
            <ul className="text-sm">
              {recipes.map((r) => (
                <li key={r.id} className="py-0.5">
                  {r.name}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-sm font-medium">Última vez</h3>
          {last && mealName ? (
            <p className="text-sm">
              {fmtDateRelative(last.date)} · {mealName} · {nf(last.grams, last.grams % 1 === 0 ? 0 : 1)} {food.base}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Aún no lo has registrado.</p>
          )}
        </section>
      </div>
      {food.custom ? (
        <CustomFoodSheet
          open={editOpen}
          onOpenChange={setEditOpen}
          edit={food}
          onSaved={() => onOpenChange(false)}
          onDeleted={() => onOpenChange(false)}
        />
      ) : null}
    </Sheet>
  );
}
