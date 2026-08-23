import { toast } from "sonner";
import { DateNav } from "@/components/brio/date-nav";
import { FoodLogSheet } from "@/components/brio/food-log";
import { MealHabits } from "@/components/brio/meal-habits";
import { RecipeBrowser } from "@/components/brio/recipe-browser";
import { Card, Screen, SectionLabel, Title } from "@/components/brio/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { addDays, fmtDateRelative, todayKey } from "@/lib/brio/dates";
import { nf, plural } from "@/lib/brio/format";
import { mealEntryCount, recentDaysWithMeals } from "@/lib/brio/meals";
import { sumEntries } from "@/lib/brio/selectors";
import { useBrioStore } from "@/lib/brio/store";
import { MEALS, type MealEntry, type MealId } from "@/lib/brio/types";
import { QUICK_LOG_EVENT } from "@/lib/brio/hotkeys";
import { PantrySheet, ShoppingSheet } from "@/components/brio/pantry-shop";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";

export function FoodScreen() {
  const days = useBrioStore((s) => s.days);
  const viewDate = useBrioStore((s) => s.viewDate);
  const copyDayMeals = useBrioStore((s) => s.copyDayMeals);
  const copyMeal = useBrioStore((s) => s.copyMeal);
  const removeMeal = useBrioStore((s) => s.removeMeal);
  const duplicateMeal = useBrioStore((s) => s.duplicateMeal);
  const moveMeal = useBrioStore((s) => s.moveMeal);
  const pantryCount = useBrioStore((s) => s.pantry.length);
  const shopPending = useBrioStore((s) => s.shopping.reduce((n, i) => (i.done ? n : n + 1), 0));
  const key = viewDate || todayKey();
  const isFuture = key > todayKey();
  const t = useMemo(() => {
    const tot = { kcal: 0, prot: 0, carb: 0, fat: 0, fib: 0 };
    // null = "ningún alimento del día trae este dato" — no cero. Cada
    // `part.sug` ya es null salvo que al menos un alimento de esa comida lo
    // traiga; sumar aquí solo lo que no sea null preserva esa distinción a
    // lo largo del día entero.
    let sug: number | null = null;
    let sat: number | null = null;
    let sod: number | null = null;
    for (const m of MEALS) {
      const part = sumEntries(days[key]?.meals[m.id] ?? []);
      tot.kcal += part.kcal;
      tot.prot += part.prot;
      tot.carb += part.carb;
      tot.fat += part.fat;
      tot.fib += part.fib;
      if (part.sug != null) sug = (sug ?? 0) + part.sug;
      if (part.sat != null) sat = (sat ?? 0) + part.sat;
      if (part.sod != null) sod = (sod ?? 0) + part.sod;
    }
    return { ...tot, sug, sat, sod };
  }, [days, key]);
  const [logOpen, setLogOpen] = useState(false);
  const [meal, setMeal] = useState<MealId>("comida");
  const [recipes, setRecipes] = useState(false);
  const [pantry, setPantry] = useState(false);
  const [shop, setShop] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [edit, setEdit] = useState<{ meal: MealId; entry: MealEntry } | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const yesterday = addDays(key, -1);
  const hasYesterday = MEALS.some((m) => (days[yesterday]?.meals[m.id].length ?? 0) > 0);

  function openAdd(m: MealId) {
    setEdit(null);
    setMeal(m);
    setLogOpen(true);
  }

  useEffect(() => {
    function onQuick(e: Event) {
      const kind = (e as CustomEvent).detail;
      if (kind !== "food") return;
      setEdit(null);
      setMeal("comida");
      setLogOpen(true);
    }
    window.addEventListener(QUICK_LOG_EVENT, onQuick);
    return () => window.removeEventListener(QUICK_LOG_EVENT, onQuick);
  }, []);

  function openEdit(m: MealId, entry: MealEntry) {
    setMeal(m);
    setEdit({ meal: m, entry });
    setLogOpen(true);
  }

  function repeatYesterday(m: MealId) {
    const ids = copyMeal(yesterday, key, m);
    if (!ids.length) toast("Ayer no tenía esa comida");
  }

  return (
    <Screen>
      <Title sub={`${isFuture ? "Planificado: " : ""}${nf(t.kcal)} kcal · ${nf(t.prot)} g prot`}>Comida</Title>
      {t.sug != null || t.sat != null || t.sod != null ? (
        // Se guardaban desde siempre y se ven en la ficha de cada alimento,
        // pero nunca se sumaban para el día — quien registra un
        // ultraprocesado no veía el sodio del día en ningún sitio. Una línea
        // de texto, no un aro más: sin objetivo definido para estos tres,
        // un anillo compararía contra nada.
        <p className="mb-3 -mt-2 text-xs text-muted-foreground">
          {[
            t.sug != null ? `${nf(t.sug, 1)} g azúcar` : null,
            t.sat != null ? `${nf(t.sat, 1)} g sat.` : null,
            t.sod != null ? `${nf(t.sod)} mg sodio` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}
      <DateNav />
      <div className="mb-3 flex gap-2">
        <Button className="flex-1" onClick={() => openAdd("comida")}>
          Añadir
        </Button>
        <Button variant="secondary" onClick={() => setRecipes(true)}>
          Recetas
        </Button>
      </div>
      <div className="mb-4 flex gap-2">
        {hasYesterday ? (
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              const n = copyDayMeals(yesterday, key);
              if (!n) toast("Ayer no tenía comidas");
            }}
          >
            Copiar ayer
          </Button>
        ) : null}
        <Button variant="outline" className={hasYesterday ? "flex-1" : "w-full"} onClick={() => setCopyOpen(true)}>
          Copiar otro día
        </Button>
      </div>

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
                          className="min-h-11 rounded-full px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted active:bg-muted"
                          onClick={() => {
                            duplicateMeal(key, m.id, e.id);
                          }}
                        >
                          Duplicar
                        </button>
                        {movingId === e.id ? (
                          MEALS.filter((other) => other.id !== m.id).map((other) => (
                            <button
                              key={other.id}
                              type="button"
                              className="min-h-11 rounded-full bg-primary px-2.5 text-xs font-medium text-primary-foreground"
                              onClick={() => {
                                moveMeal(key, m.id, other.id, e.id);
                                setMovingId(null);
                              }}
                            >
                              Mover a {other.n.toLowerCase()}
                            </button>
                          ))
                        ) : (
                          <button
                            type="button"
                            className="min-h-11 rounded-full px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted active:bg-muted"
                            onClick={() => setMovingId(e.id)}
                          >
                            Mover
                          </button>
                        )}
                        <button
                          type="button"
                          className="min-h-11 rounded-full px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted active:bg-muted"
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
        <Button variant="secondary" className="h-14 flex-col gap-0.5 rounded-2xl" onClick={() => setPantry(true)}>
          <span>Despensa</span>
          <span className="text-[11px] font-normal text-muted-foreground">
            {pantryCount ? plural(pantryCount, "alimento", "alimentos") : "Vacía"}
          </span>
        </Button>
        <Button variant="secondary" className="h-14 flex-col gap-0.5 rounded-2xl" onClick={() => setShop(true)}>
          <span>Lista de la compra</span>
          <span className="text-[11px] font-normal text-muted-foreground">
            {shopPending ? plural(shopPending, "por comprar", "por comprar") : "Vacía"}
          </span>
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
      <CopyOtherDaySheet open={copyOpen} onOpenChange={setCopyOpen} targetKey={key} />
    </Screen>
  );
}

function CopyOtherDaySheet({
  open,
  onOpenChange,
  targetKey,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  targetKey: string;
}) {
  const days = useBrioStore((s) => s.days);
  const copyDayMeals = useBrioStore((s) => s.copyDayMeals);
  const sources = useMemo(() => recentDaysWithMeals(days, todayKey(), 14, targetKey), [days, targetKey]);
  const [fromKey, setFromKey] = useState("");

  useEffect(() => {
    if (!open) setFromKey("");
  }, [open]);

  const n = fromKey && fromKey !== targetKey ? mealEntryCount(days[fromKey]) : 0;
  const canCopy = !!fromKey && fromKey !== targetKey;

  function confirm() {
    if (!canCopy) return;
    const copied = copyDayMeals(fromKey, targetKey);
    onOpenChange(false);
    if (!copied) toast("Ese día no tenía comidas");
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Copiar otro día"
      footer={
        <Button className="w-full" disabled={!canCopy} onClick={confirm}>
          {n ? `Copiar ${n} ${n === 1 ? "registro" : "registros"}` : "Copiar"}
        </Button>
      }
    >
      <p className="mb-3 text-sm text-muted-foreground">
        Se añadirán a {fmtDateRelative(targetKey).toLowerCase()}. No sustituye lo que ya hay.
      </p>

      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Últimos 14 días</p>
      {sources.length === 0 ? (
        <p className="mb-4 text-sm text-muted-foreground">No hay comidas en los últimos 14 días. Elige una fecha.</p>
      ) : (
        <ul className="mb-4 space-y-2">
          {sources.map((k) => {
            const count = mealEntryCount(days[k]);
            const kcal = MEALS.reduce((acc, m) => acc + sumEntries(days[k]?.meals[m.id] ?? []).kcal, 0);
            return (
              <li key={k}>
                <button
                  type="button"
                  onClick={() => setFromKey(k)}
                  className={cn(
                    "flex min-h-11 w-full items-center justify-between gap-2 rounded-2xl px-3 py-2 text-left",
                    fromKey === k ? "bg-primary text-primary-foreground" : "bg-muted",
                  )}
                >
                  <span className="font-medium">{fmtDateRelative(k)}</span>
                  <span className={cn("text-xs tabular-nums", fromKey === k ? "opacity-90" : "text-muted-foreground")}>
                    {count} {count === 1 ? "alimento" : "alimentos"} · {nf(kcal)} kcal
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground" htmlFor="copy-day-date">
        O elige una fecha
      </label>
      <Input
        id="copy-day-date"
        type="date"
        max={todayKey()}
        value={fromKey}
        onChange={(e) => setFromKey(e.target.value)}
      />
      {fromKey === targetKey ? (
        <p className="mt-2 text-xs text-muted-foreground">Elige un día distinto al que estás viendo.</p>
      ) : null}
    </Sheet>
  );
}
