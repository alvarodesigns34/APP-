import { useMemo, useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { BASE_RECIPES, getFood, searchFoods } from "@/lib/brio/catalog";
import { useCatalog } from "@/lib/brio/use-catalog";
import { useBrioStore } from "@/lib/brio/store";
import { missingIngredients } from "@/lib/brio/selectors-catalog";
import { nf } from "@/lib/brio/format";
import type { Food } from "@/lib/brio/types";
import { cn } from "@/lib/utils";

export function PantrySheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const catalogReady = useCatalog();
  const pantry = useBrioStore((s) => s.pantry);
  const toggle = useBrioStore((s) => s.togglePantry);
  const customFoods = useBrioStore((s) => s.customFoods);
  const recipes = useBrioStore((s) => s.recipes);
  const [q, setQ] = useState("");
  const query = q.trim();
  const list = useMemo(() => {
    if (!catalogReady) return [];
    const ctx = { customFoods, recipes };
    if (!query)
      return pantry
        .map((id) => getFood(id, ctx))
        .filter((f): f is Food => !!f)
        .slice(0, 40);
    return searchFoods(query, null, ctx, 40);
  }, [query, pantry, customFoods, recipes, catalogReady]);

  const ready = useMemo(() => {
    if (!catalogReady) return [];
    const s = { ...useBrioStore.getState(), pantry };
    return BASE_RECIPES.map((r) => ({ r, miss: missingIngredients(s, r).length }))
      .filter((x) => x.miss <= 3)
      .sort((a, b) => a.miss - b.miss)
      .slice(0, 8);
  }, [pantry, catalogReady]);

  const count = pantry.length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Despensa">
      <p className="mb-2 text-sm text-muted-foreground">
        {count} {count === 1 ? "alimento" : "alimentos"}
      </p>
      <Input placeholder="Buscar o añadir alimento" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="mt-3 divide-y divide-border">
        {list.length === 0 ? (
          <li className="py-6 text-center text-sm text-muted-foreground">
            {query ? "No hay resultados." : "La despensa está vacía."}
          </li>
        ) : (
          list.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                className="flex min-h-11 w-full items-center justify-between gap-2 py-2 text-left"
                onClick={() => toggle(f.id)}
              >
                <span className="text-sm">{f.name}</span>
                <span className={cn("text-xs", pantry.includes(f.id) ? "text-primary" : "text-muted-foreground")}>
                  {pantry.includes(f.id) ? "En despensa" : "Añadir"}
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
      <h3 className="mt-5 text-sm font-medium">Casi listas</h3>
      <ul className="mt-2 space-y-2">
        {ready.map(({ r, miss }) => (
          <li key={r.id} className="rounded-2xl bg-muted/50 px-3 py-2 text-sm">
            {r.name}
            <span className="block text-xs text-muted-foreground">
              {miss === 0 ? "La puedes hacer ahora" : `Te faltan ${miss} ingredientes`}
            </span>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

export function ShoppingSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const catalogReady = useCatalog();
  const pantry = useBrioStore((s) => s.pantry);
  const favRecipes = useBrioStore((s) => s.favRecipes);
  const [picked, setPicked] = useState<string[]>(favRecipes.slice(0, 4));
  const items = useMemo(() => {
    const map = new Map<string, { name: string; g: number }>();
    if (!catalogReady) return [];
    for (const id of picked) {
      const r = BASE_RECIPES.find((x) => x.id === id);
      if (!r) continue;
      for (const ing of r.ing) {
        if (pantry.includes(ing.id)) continue;
        const prev = map.get(ing.id);
        map.set(ing.id, { name: ing.name, g: (prev?.g || 0) + ing.g });
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [picked, pantry, catalogReady]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Lista de la compra">
      <p className="mb-2 text-sm text-muted-foreground">Elige recetas; se omiten lo que ya tienes.</p>
      <div className="mb-3 flex flex-wrap gap-1">
        {(catalogReady ? BASE_RECIPES : []).slice(0, 24).map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setPicked((p) => (p.includes(r.id) ? p.filter((x) => x !== r.id) : [...p, r.id]))}
            className={cn(
              "min-h-11 rounded-full px-3 text-xs",
              picked.includes(r.id) ? "bg-primary text-primary-foreground" : "bg-muted",
            )}
          >
            {r.name}
          </button>
        ))}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nada que comprar.</p>
      ) : (
        <ul className="divide-y divide-border text-sm">
          {items.map((i) => (
            <li key={i.name} className="flex min-h-11 items-center justify-between py-2">
              <span>{i.name}</span>
              <span className="tabular-nums text-muted-foreground">{nf(i.g, 0)} g</span>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
