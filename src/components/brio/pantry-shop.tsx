import { EmptyLine } from "@/components/brio/section";
import { useMemo, useState } from "react";
import { Check, Copy, Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { BASE_RECIPES, getFood, searchFoods, searchRecipes } from "@/lib/brio/catalog";
import { useCatalog } from "@/lib/brio/use-catalog";
import { CatalogNotice } from "@/components/brio/catalog-state";
import { useBrioStore } from "@/lib/brio/store";
import { missingIngredients, pantryHint } from "@/lib/brio/selectors-catalog";
import { nf, plural } from "@/lib/brio/format";
import {
  aisleName,
  groupShopping,
  parseShoppingInput,
  shoppingAsText,
  shoppingCounts,
  SHOPPING_OTHER,
} from "@/lib/brio/shopping";
import type { Food, ShoppingItem } from "@/lib/brio/types";
import { cn } from "@/lib/utils";

export function PantrySheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const catalog = useCatalog();
  const catalogReady = catalog.ready;
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
        {!catalogReady ? (
          <li>
            <CatalogNotice state={catalog} loadingText="Cargando alimentos…" />
          </li>
        ) : list.length === 0 ? (
          <li>
            <EmptyLine>
              {query
                ? "Ningún alimento coincide. Escríbelo entero y podrás añadirlo igual."
                : "Busca arriba lo que tengas en casa. Con la despensa puesta, Brío te dice qué recetas puedes hacer ya."}
            </EmptyLine>
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
            {/* pantryHint gets the singular right ("Te falta 1 ingrediente"); the
                copy inlined here used to read "Te faltan 1 ingredientes". */}
            <span className="block text-xs text-muted-foreground">{pantryHint(miss)}</span>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}


/**
 * The shopping list is a list of its own, not a read-only view over recipes.
 * Anything can go on it — typed by hand, picked from the food catalog, or
 * pulled in from a recipe's missing ingredients. Pending lines are grouped by
 * supermarket aisle so the list can be walked top to bottom.
 */
export function ShoppingSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const catalog = useCatalog();
  const catalogReady = catalog.ready;
  const shopping = useBrioStore((s) => s.shopping);
  const customFoods = useBrioStore((s) => s.customFoods);
  const recipes = useBrioStore((s) => s.recipes);
  const addShoppingItem = useBrioStore((s) => s.addShoppingItem);
  const toggleShoppingItem = useBrioStore((s) => s.toggleShoppingItem);
  const removeShoppingItem = useBrioStore((s) => s.removeShoppingItem);
  const clearShoppingDone = useBrioStore((s) => s.clearShoppingDone);
  const updateShoppingItem = useBrioStore((s) => s.updateShoppingItem);
  const doneToPantry = useBrioStore((s) => s.shoppingDoneToPantry);

  const [draft, setDraft] = useState("");
  const [fromRecipes, setFromRecipes] = useState(false);

  const parsed = useMemo(() => parseShoppingInput(draft), [draft]);

  // Suggestions come from the catalog so a picked item carries its aisle and
  // its foodId — which is what lets it go to the pantry once it is bought.
  const suggestions = useMemo(() => {
    if (!catalogReady || parsed.name.trim().length < 2) return [];
    return searchFoods(parsed.name, null, { customFoods, recipes }, 6);
  }, [catalogReady, parsed.name, customFoods, recipes]);

  const { pending, done } = useMemo(() => groupShopping(shopping), [shopping]);
  const counts = useMemo(() => shoppingCounts(shopping), [shopping]);

  async function shareList() {
    const text = shoppingAsText(shopping);
    if (!text) return;
    // La hoja del sistema primero (iOS y Android la tienen); si no, el
    // portapapeles. Cancelar la hoja lanza AbortError y no es un fallo.
    try {
      if (navigator.share) {
        await navigator.share({ title: "Lista de la compra", text });
        return;
      }
    } catch {
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Lista copiada");
    } catch {
      toast.error("No se ha podido copiar");
    }
  }

  function commit(food?: Food) {
    const name = food ? food.name : parsed.name;
    if (!name.trim()) return;
    addShoppingItem({
      name,
      qty: parsed.qty,
      cat: food ? food.cat : SHOPPING_OTHER,
      ...(food ? { foodId: food.id } : {}),
    });
    setDraft("");
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Lista de la compra"
      footer={
        counts.done > 0 ? (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                const n = doneToPantry();
                if (n) toast.success(plural(n, "producto a la despensa", "productos a la despensa"));
              }}
            >
              Guardar en despensa
            </Button>
            <Button variant="outline" className="flex-1" onClick={clearShoppingDone}>
              Quitar {counts.done}
            </Button>
          </div>
        ) : null
      }
    >
      <form
        className="mb-1 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          commit();
        }}
      >
        <Input
          placeholder="Añade lo que sea: 2 kg naranjas"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="Añadir a la lista"
        />
        <Button type="submit" disabled={!parsed.name.trim()}>
          Añadir
        </Button>
      </form>
      <p className="mb-3 text-xs text-muted-foreground">
        {parsed.qty ? `Cantidad: ${parsed.qty} · producto: ${parsed.name}` : "Puedes empezar por la cantidad."}
      </p>

      {suggestions.length > 0 ? (
        <ul className="mb-4 divide-y divide-border rounded-2xl bg-muted/40 px-3">
          {suggestions.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                className="flex min-h-11 w-full items-center justify-between gap-2 py-2 text-left text-sm"
                onClick={() => commit(f)}
              >
                <span className="min-w-0 truncate">{f.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{aisleName(f.cat)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {counts.total === 0
            ? "La lista está vacía."
            : `${plural(counts.pending, "producto", "productos")} por comprar${
                counts.done ? ` · ${counts.done} en el carro` : ""
              }`}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          {/* `shoppingAsText` estaba escrita, documentada "para el portapapeles
              / la hoja de compartir" y con sus tests, pero ninguna pantalla la
              llamaba: la lista solo existía dentro del móvil. Ahora sale por
              la hoja de compartir del sistema, y si no la hay, al portapapeles
              — que es lo que hace falta para mandársela a quien va a comprar. */}
          {counts.pending > 0 ? (
            <Button size="sm" variant="ghost" aria-label="Compartir la lista" onClick={shareList}>
              <Copy className="size-4" />
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={() => setFromRecipes((v) => !v)}>
            {fromRecipes ? "Ocultar recetas" : "Desde recetas"}
          </Button>
        </div>
      </div>

      {fromRecipes ? <RecipeToListPicker onDone={() => setFromRecipes(false)} /> : null}

      {counts.total === 0 && !fromRecipes ? (
        <EmptyLine>
          Escribe arriba lo que necesites, o pulsa «Desde recetas» para traer los ingredientes que te falten.
        </EmptyLine>
      ) : null}

      {pending.map((group) => (
        <div key={group.cat} className="mb-4">
          <p className="mb-1 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">{group.name}</p>
          <ul className="divide-y divide-border">
            {group.items.map((item) => (
              <ShoppingRow
                key={item.id}
                item={item}
                onToggle={() => toggleShoppingItem(item.id)}
                onRemove={() => removeShoppingItem(item.id)}
                onEdit={(patch) => updateShoppingItem(item.id, patch)}
              />
            ))}
          </ul>
        </div>
      ))}

      {done.length > 0 ? (
        <div className="mb-2">
          <p className="mb-1 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">En el carro</p>
          <ul className="divide-y divide-border">
            {done.map((item) => (
              <ShoppingRow
                key={item.id}
                item={item}
                onToggle={() => toggleShoppingItem(item.id)}
                onRemove={() => removeShoppingItem(item.id)}
                onEdit={(patch) => updateShoppingItem(item.id, patch)}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </Sheet>
  );
}

function ShoppingRow({
  item,
  onToggle,
  onRemove,
  onEdit,
}: {
  item: ShoppingItem;
  onToggle: () => void;
  onRemove: () => void;
  onEdit: (patch: { name: string; qty: string }) => void;
}) {
  // La acción `updateShoppingItem` llevaba tiempo en el store sin que ninguna
  // pantalla la llamara: escribías "2 kg naranjs" y la única salida era quitar
  // la línea y volver a teclearla entera, cantidad incluida.
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [qty, setQty] = useState(item.qty);

  function open() {
    setName(item.name);
    setQty(item.qty);
    setEditing(true);
  }

  function save() {
    if (!name.trim()) return;
    onEdit({ name, qty });
    setEditing(false);
  }

  if (editing) {
    return (
      <li className="py-2">
        <div className="flex gap-2">
          <Input
            className="flex-1"
            value={name}
            autoFocus
            aria-label="Nombre del producto"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
          />
          <Input
            className="w-24"
            value={qty}
            aria-label="Cantidad"
            placeholder="2 kg"
            onChange={(e) => setQty(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
          />
        </div>
        <div className="mt-1 flex gap-2">
          <Button size="sm" className="flex-1" disabled={!name.trim()} onClick={save}>
            Guardar
          </Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-1">
      <button
        type="button"
        role="checkbox"
        aria-checked={item.done}
        className="flex min-h-11 flex-1 items-center gap-3 py-2 text-left"
        onClick={onToggle}
      >
        <span
          aria-hidden
          className={cn(
            "grid size-5 shrink-0 place-items-center rounded-md border",
            item.done ? "border-primary bg-primary text-primary-foreground" : "border-border",
          )}
        >
          {item.done ? <Check className="size-3.5" strokeWidth={3} /> : null}
        </span>
        <span className="min-w-0">
          <span className={cn("block truncate text-sm", item.done && "text-muted-foreground line-through")}>
            {item.name}
          </span>
          {item.qty ? <span className="block text-xs text-muted-foreground">{item.qty}</span> : null}
        </span>
      </button>
      <button
        type="button"
        aria-label={`Editar ${item.name}`}
        className="grid size-11 shrink-0 place-items-center text-muted-foreground"
        onClick={open}
      >
        <Pencil className="size-4" />
      </button>
      <button
        type="button"
        aria-label={`Quitar ${item.name}`}
        className="grid size-11 shrink-0 place-items-center text-muted-foreground"
        onClick={onRemove}
      >
        <X className="size-4" />
      </button>
    </li>
  );
}

/** Pulls the ingredients you are missing from any recipe straight onto the list. */
function RecipeToListPicker({ onDone }: { onDone: () => void }) {
  const catalog = useCatalog();
  const pantry = useBrioStore((s) => s.pantry);
  const settings = useBrioStore((s) => s.settings);
  const customFoods = useBrioStore((s) => s.customFoods);
  const recipes = useBrioStore((s) => s.recipes);
  const favRecipes = useBrioStore((s) => s.favRecipes);
  const addShoppingItems = useBrioStore((s) => s.addShoppingItems);
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    if (!catalog.ready) return [];
    const query = q.trim();
    const base = query ? searchRecipes(query, { limit: 12 }) : BASE_RECIPES;
    if (query) return base;
    // No query: favourites first, so the recipes you actually cook are on top.
    const favs = new Set(favRecipes);
    return [...base].sort((a, b) => Number(favs.has(b.id)) - Number(favs.has(a.id))).slice(0, 12);
  }, [catalog.ready, q, favRecipes]);

  const state = { pantry, settings, customFoods, recipes };

  if (!catalog.ready) {
    return <CatalogNotice state={catalog} loadingText="Cargando recetas…" noun="las recetas" />;
  }

  return (
    <div className="mb-4 rounded-2xl bg-muted/40 p-3">
      <Input placeholder="Buscar receta" value={q} onChange={(e) => setQ(e.target.value)} className="mb-2" />
      <ul className="divide-y divide-border">
        {list.map((r) => {
          const missing = missingIngredients(state, r);
          return (
            <li key={r.id}>
              <button
                type="button"
                className="flex min-h-11 w-full items-center justify-between gap-2 py-2 text-left"
                disabled={missing.length === 0}
                onClick={() => {
                  const added = addShoppingItems(
                    r.ing
                      .filter((i) => missing.includes(i.name))
                      .map((i) => ({ name: i.name, qty: `${nf(i.g, 0)} g`, cat: getFood(i.id, { customFoods, recipes })?.cat, foodId: i.id })),
                  );
                  if (added) onDone();
                }}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{r.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {missing.length === 0 ? "Ya tienes todo" : plural(missing.length, "ingrediente", "ingredientes")}
                  </span>
                </span>
                {missing.length > 0 ? <Plus className="size-4 shrink-0 text-primary" /> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
