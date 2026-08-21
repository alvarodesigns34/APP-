import { useEffect, useMemo, useState } from "react";
import { Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CustomFoodSheet } from "@/components/brio/custom-food";
import { CATEGORIES, MEALS, type Food, type MealEntry, type MealId } from "@/lib/brio/types";
import { getFood, searchFoods } from "@/lib/brio/catalog";
import { useBrioStore } from "@/lib/brio/store";
import { habitualFoodIds } from "@/lib/brio/selectors";
import { nf, parseNum, round } from "@/lib/brio/format";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "buscar", n: "Buscar" },
  { id: "recientes", n: "Recientes" },
  { id: "favoritos", n: "Favoritos" },
  { id: "habituales", n: "Habituales" },
] as const;

export function FoodLogSheet({
  open,
  onOpenChange,
  date,
  defaultMeal = "comida",
  edit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  date: string;
  defaultMeal?: MealId;
  edit?: { meal: MealId; entry: MealEntry } | null;
}) {
  const recents = useBrioStore((s) => s.recents);
  const favorites = useBrioStore((s) => s.favorites);
  const customFoods = useBrioStore((s) => s.customFoods);
  const recipes = useBrioStore((s) => s.recipes);
  const addMeal = useBrioStore((s) => s.addMeal);
  const updateMeal = useBrioStore((s) => s.updateMeal);
  const toggleFavorite = useBrioStore((s) => s.toggleFavorite);
  const days = useBrioStore((s) => s.days);

  const habitual = useMemo(
    () => habitualFoodIds({ ...useBrioStore.getState(), recents, days }),
    [recents, days],
  );

  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("buscar");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [meal, setMeal] = useState<MealId>(defaultMeal);
  const [picked, setPicked] = useState<Food | null>(null);
  const [grams, setGrams] = useState("100");
  const [qty, setQty] = useState("1");
  const [unitName, setUnitName] = useState("g");
  const [createOpen, setCreateOpen] = useState(false);

  const editing = !!edit;

  useEffect(() => {
    if (!open) {
      setPicked(null);
      setQ("");
      setCreateOpen(false);
      return;
    }
    setMeal(edit?.meal ?? defaultMeal);
    if (edit) {
      const food = getFood(edit.entry.foodId, {
        customFoods: useBrioStore.getState().customFoods,
        recipes: useBrioStore.getState().recipes,
      });
      setPicked(food ?? null);
      setQty(String(edit.entry.qty));
      setGrams(String(edit.entry.grams));
      setUnitName(edit.entry.unitName);
    } else {
      setPicked(null);
      setQty("1");
      setGrams("100");
      setUnitName("g");
    }
  }, [open, edit, defaultMeal]);

  const list = useMemo(() => {
    if (picked || editing) return [];
    const catalogCtx = { customFoods, recipes };
    if (tab === "buscar") return searchFoods(q, cat, catalogCtx, 60);
    const ids = tab === "recientes" ? recents : tab === "favoritos" ? favorites : habitual;
    return ids.map((id) => getFood(id, catalogCtx)).filter((f): f is Food => !!f);
  }, [tab, q, cat, recents, favorites, habitual, customFoods, recipes, picked, editing]);

  const unitG = useMemo(() => {
    if (!picked) {
      const qn = parseNum(qty);
      const gn = parseNum(grams);
      return qn > 0 && gn > 0 ? gn / qn : 1;
    }
    const match = picked.units.find((u) => u.name === unitName);
    if (match) return match.g;
    if (unitName === picked.base) return 1;
    const qn = parseNum(qty);
    const gn = parseNum(grams);
    return qn > 0 && gn > 0 ? gn / qn : 1;
  }, [picked, unitName, qty, grams]);

  function applyQty(next: string) {
    setQty(next);
    const n = parseNum(next);
    if (!Number.isFinite(n) || n <= 0) return;
    setGrams(String(round(n * unitG, 1)));
  }

  function applyGrams(next: string) {
    setGrams(next);
    const n = parseNum(next);
    if (!Number.isFinite(n) || n <= 0 || unitG <= 0) return;
    setQty(String(round(n / unitG, 2)));
  }

  function pick(f: Food) {
    const unit = f.units[0];
    setPicked(f);
    if (unit) {
      setUnitName(unit.name);
      setQty("1");
      setGrams(String(unit.g));
    } else {
      setUnitName(f.base);
      setQty("100");
      setGrams("100");
    }
  }

  function pickUnit(name: string, g: number) {
    setUnitName(name);
    setQty("1");
    setGrams(String(g));
  }

  function confirm() {
    const g = parseNum(grams);
    const qn = parseNum(qty);
    if (!g || g <= 0 || !qn || qn <= 0) return;
    if (edit) {
      updateMeal(date, edit.meal, edit.entry.id, g, qn, unitName);
      toast.success("Registro actualizado");
    } else {
      if (!picked) return;
      addMeal(date, meal, picked.id, g, qn, unitName);
    }
    setPicked(null);
    onOpenChange(false);
  }

  const titleName = picked?.name ?? edit?.entry.name ?? "Registrar comida";
  const showQty = !!picked || editing;
  const kcalBase = picked?.kcal ?? edit?.entry.kcal ?? 0;
  const kcalRefG = picked ? 100 : edit?.entry.grams || 100;
  const previewKcal = round((kcalBase * (parseNum(grams) || 0)) / kcalRefG);

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(v) => {
          if (!v && createOpen) return;
          if (!v) setPicked(null);
          onOpenChange(v);
        }}
        title={showQty ? titleName : "Registrar comida"}
        footer={
          showQty ? (
            <Button className="w-full" onClick={confirm}>
              {editing ? "Guardar" : "Añadir"} · {nf(previewKcal)} kcal
            </Button>
          ) : null
        }
      >
        {showQty ? (
          <div className="space-y-4">
            {!editing ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setPicked(null)}>
                Atrás
              </Button>
            ) : null}
            {picked ? (
              <p className="text-sm text-muted-foreground">
                {nf(picked.kcal)} kcal · {nf(picked.prot, 1)} g prot / 100 {picked.base}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Ajusta la cantidad de este registro.</p>
            )}
            {picked && picked.units.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {picked.units.map((u) => (
                  <button
                    key={u.name}
                    type="button"
                    className={cn(
                      "min-h-11 rounded-full px-3 text-sm",
                      unitName === u.name ? "bg-primary text-primary-foreground" : "bg-muted",
                    )}
                    onClick={() => pickUnit(u.name, u.g)}
                  >
                    {u.name} ({nf(u.g, 0)} {picked.base})
                  </button>
                ))}
                {picked.units.every((u) => u.name !== picked.base) ? (
                  <button
                    type="button"
                    className={cn(
                      "min-h-11 rounded-full px-3 text-sm",
                      unitName === picked.base ? "bg-primary text-primary-foreground" : "bg-muted",
                    )}
                    onClick={() => {
                      const g = parseNum(grams) || 100;
                      setUnitName(picked.base);
                      setQty(String(g));
                      setGrams(String(g));
                    }}
                  >
                    {picked.base}
                  </button>
                ) : null}
              </div>
            ) : null}
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="food-qty">
                Cantidad ({unitName})
              </label>
              <Input
                id="food-qty"
                inputMode="decimal"
                value={qty}
                onChange={(e) => applyQty(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="food-grams">
                {picked?.base === "ml" ? "Mililitros" : "Gramos"}
              </label>
              <Input
                id="food-grams"
                inputMode="decimal"
                value={grams}
                onChange={(e) => applyGrams(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              {[-10, -5, 5, 10].map((n) => (
                <Button
                  key={n}
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="min-h-11 flex-1"
                  onClick={() => applyGrams(String(Math.max(1, (parseNum(grams) || 0) + n)))}
                >
                  {n > 0 ? `+${n}` : n}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-1 overflow-x-auto">
              {MEALS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMeal(m.id)}
                  className={cn(
                    "min-h-11 shrink-0 rounded-full px-3 text-xs font-medium",
                    meal === m.id ? "bg-primary text-primary-foreground" : "bg-muted",
                  )}
                >
                  {m.n}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "min-h-11 flex-1 rounded-lg px-1 text-xs font-medium",
                    tab === t.id ? "bg-muted text-foreground" : "text-muted-foreground",
                  )}
                >
                  {t.n}
                </button>
              ))}
            </div>
            {tab === "buscar" ? (
              <>
                <Input placeholder="Buscar alimento o receta" value={q} onChange={(e) => setQ(e.target.value)} />
                <div className="flex gap-1 overflow-x-auto pb-1">
                  <Chip on={cat === null} onClick={() => setCat(null)}>
                    Todas
                  </Chip>
                  {CATEGORIES.filter((c) => !["propio", "receta", "receta_base"].includes(c.id)).map((c) => (
                    <Chip key={c.id} on={cat === c.id} onClick={() => setCat(c.id)}>
                      {c.n}
                    </Chip>
                  ))}
                </div>
              </>
            ) : null}
            <Button type="button" variant="secondary" className="w-full" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Crear alimento
            </Button>
            <ul className="divide-y divide-border">
              {list.length === 0 ? (
                <li className="py-8 text-center text-sm text-muted-foreground">No hay resultados.</li>
              ) : (
                list.map((f) => {
                  const fav = favorites.includes(f.id);
                  return (
                    <li key={f.id} className="flex items-center gap-2 py-1">
                      <button type="button" className="min-h-11 min-w-0 flex-1 text-left" onClick={() => pick(f)}>
                        <div className="truncate font-medium">{f.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {nf(f.kcal)} kcal / 100 {f.base}
                          {f.builtinRecipe ? " · receta" : f.custom ? " · propio" : ""}
                        </div>
                      </button>
                      <button
                        type="button"
                        aria-label={fav ? "Quitar de favoritos" : "Añadir a favoritos"}
                        onClick={() => toggleFavorite(f.id)}
                        className="grid size-11 place-items-center"
                      >
                        <Star className={cn("size-4", fav ? "fill-primary text-primary" : "text-muted-foreground")} />
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        )}
      </Sheet>
      <CustomFoodSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={(id) => {
          const st = useBrioStore.getState();
          const f = getFood(id, { customFoods: st.customFoods, recipes: st.recipes });
          if (f) pick(f);
        }}
      />
    </>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-11 shrink-0 rounded-full px-3 text-xs",
        on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}
