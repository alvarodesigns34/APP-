import { toast } from "sonner";
import { DateNav } from "@/components/brio/date-nav";
import { FoodLogSheet } from "@/components/brio/food-log";
import { MealHabits } from "@/components/brio/meal-habits";
import { RecipeBrowser } from "@/components/brio/recipe-browser";
import { Card, Screen, SectionLabel, Title } from "@/components/brio/section";
import { Button } from "@/components/ui/button";
import { addDays, todayKey } from "@/lib/brio/dates";
import { nf } from "@/lib/brio/format";
import { sumEntries } from "@/lib/brio/selectors";
import { useBrioStore } from "@/lib/brio/store";
import { MEALS, type MealEntry, type MealId } from "@/lib/brio/types";
import { PantrySheet, ShoppingSheet } from "@/components/brio/pantry-shop";
import { useMemo, useState } from "react";

export function FoodScreen() {
  const days = useBrioStore((s) => s.days);
  const viewDate = useBrioStore((s) => s.viewDate);
  const copyDayMeals = useBrioStore((s) => s.copyDayMeals);
  const copyMeal = useBrioStore((s) => s.copyMeal);
  const removeMeal = useBrioStore((s) => s.removeMeal);
  const duplicateMeal = useBrioStore((s) => s.duplicateMeal);
  const moveMeal = useBrioStore((s) => s.moveMeal);
  const key = viewDate || todayKey();
  const t = useMemo(() => {
    const tot = { kcal: 0, prot: 0, carb: 0, fat: 0, fib: 0 };
    for (const m of MEALS) {
      const part = sumEntries(days[key]?.meals[m.id] ?? []);
      tot.kcal += part.kcal;
      tot.prot += part.prot;
      tot.carb += part.carb;
      tot.fat += part.fat;
      tot.fib += part.fib;
    }
    return tot;
  }, [days, key]);
  const [logOpen, setLogOpen] = useState(false);
  const [meal, setMeal] = useState<MealId>("comida");
  const [recipes, setRecipes] = useState(false);
  const [pantry, setPantry] = useState(false);
  const [shop, setShop] = useState(false);
  const [edit, setEdit] = useState<{ meal: MealId; entry: MealEntry } | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const yesterday = addDays(key, -1);
  const hasYesterday = MEALS.some((m) => (days[yesterday]?.meals[m.id].length ?? 0) > 0);

  function openAdd(m: MealId) {
    setEdit(null);
    setMeal(m);
    setLogOpen(true);
  }

  function openEdit(m: MealId, entry: MealEntry) {
    setMeal(m);
    setEdit({ meal: m, entry });
    setLogOpen(true);
  }

  function repeatYesterday(m: MealId) {
    const ids = copyMeal(yesterday, key, m);
    toast.success(ids.length ? `Añadidos ${ids.length} alimentos` : "Ayer no tenía esa comida", {
      action: ids.length
        ? {
            label: "Deshacer",
            onClick: () => {
              for (const id of ids) removeMeal(key, m, id);
            },
          }
        : undefined,
    });
  }

  return (
    <Screen>
      <Title sub={`${nf(t.kcal)} kcal · ${nf(t.prot)} g prot`}>Comida</Title>
      <DateNav />
      <div className="mb-3 flex gap-2">
        <Button className="flex-1" onClick={() => openAdd("comida")}>
          Añadir
        </Button>
        <Button variant="secondary" onClick={() => setRecipes(true)}>
          Recetas
        </Button>
      </div>
      {hasYesterday ? (
        <Button
          variant="outline"
          className="mb-4 w-full"
          onClick={() => {
            const n = copyDayMeals(yesterday, key);
            toast.success(n ? `Copiados ${n} registros de ayer` : "Ayer no tenía comidas");
          }}
        >
          Copiar ayer
        </Button>
      ) : null}

      <MealHabits date={key} />

      {MEALS.map((m) => {
        const entries = days[key]?.meals[m.id] ?? [];
        const tot = sumEntries(entries);
        const yest = days[yesterday]?.meals[m.id] ?? [];
        return (
          <div key={m.id}>
            <SectionLabel>
              {m.n} {entries.length ? `· ${nf(tot.kcal)} kcal` : ""}
            </SectionLabel>
            <Card>
              {entries.length === 0 ? (
                <div>
                  <button
                    type="button"
                    className="min-h-11 w-full py-2 text-sm text-muted-foreground"
                    onClick={() => openAdd(m.id)}
                  >
                    Añadir a {m.n.toLowerCase()}
                  </button>
                  {yest.length > 0 ? (
                    <button
                      type="button"
                      className="min-h-11 w-full py-2 text-sm text-primary"
                      onClick={() => repeatYesterday(m.id)}
                    >
                      Repetir el de ayer · {yest.length} {yest.length === 1 ? "alimento" : "alimentos"}
                    </button>
                  ) : null}
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {entries.map((e) => (
                    <li key={e.id} className="py-2">
                      <button
                        type="button"
                        className="flex min-h-11 w-full items-center justify-between gap-2 text-left"
                        onClick={() => openEdit(m.id, e)}
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium">{e.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {nf(e.qty, e.qty % 1 === 0 ? 0 : 2)} {e.unitName} · {nf(e.grams, 0)} g
                          </div>
                        </div>
                        <span className="tabular-nums text-sm">{nf(e.kcal)}</span>
                      </button>
                      <div className="flex flex-wrap gap-1 pt-1">
                        <button
                          type="button"
                          className="min-h-11 rounded-full bg-muted px-3 text-xs"
                          onClick={() => {
                            duplicateMeal(key, m.id, e.id);
                            toast.success("Duplicado");
                          }}
                        >
                          Duplicar
                        </button>
                        {movingId === e.id ? (
                          MEALS.filter((other) => other.id !== m.id).map((other) => (
                            <button
                              key={other.id}
                              type="button"
                              className="min-h-11 rounded-full bg-primary px-3 text-xs text-primary-foreground"
                              onClick={() => {
                                moveMeal(key, m.id, other.id, e.id);
                                setMovingId(null);
                                toast.success(`Movido a ${other.n.toLowerCase()}`);
                              }}
                            >
                              Mover a {other.n.toLowerCase()}
                            </button>
                          ))
                        ) : (
                          <button
                            type="button"
                            className="min-h-11 rounded-full bg-muted px-3 text-xs"
                            onClick={() => setMovingId(e.id)}
                          >
                            Mover
                          </button>
                        )}
                        <button
                          type="button"
                          className="min-h-11 rounded-full bg-muted px-3 text-xs text-muted-foreground"
                          onClick={() => {
                            removeMeal(key, m.id, e.id);
                          }}
                        >
                          Quitar
                        </button>
                      </div>
                    </li>
                  ))}
                  {yest.length > 0 ? (
                    <li>
                      <button
                        type="button"
                        className="min-h-11 w-full text-left text-xs text-primary"
                        onClick={() => repeatYesterday(m.id)}
                      >
                        Añadir el de ayer
                      </button>
                    </li>
                  ) : null}
                </ul>
              )}
            </Card>
          </div>
        );
      })}

      <SectionLabel>Cocina</SectionLabel>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" className="h-14 rounded-2xl" onClick={() => setPantry(true)}>
          Despensa
        </Button>
        <Button variant="secondary" className="h-14 rounded-2xl" onClick={() => setShop(true)}>
          Lista de compra
        </Button>
      </div>

      <FoodLogSheet
        open={logOpen}
        onOpenChange={(v) => {
          setLogOpen(v);
          if (!v) setEdit(null);
        }}
        date={key}
        defaultMeal={meal}
        edit={edit}
      />
      <RecipeBrowser open={recipes} onOpenChange={setRecipes} date={key} />
      <PantrySheet open={pantry} onOpenChange={setPantry} />
      <ShoppingSheet open={shop} onOpenChange={setShop} />
    </Screen>
  );
}
