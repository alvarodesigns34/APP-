import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, Star, X } from "lucide-react";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getFood, searchFoods } from "@/lib/brio/catalog";
import { useBrioStore } from "@/lib/brio/store";
import { nf, parseNum, parsePositive } from "@/lib/brio/format";
import { buildUserRecipe, scaleUserRecipe, userRecipePerServing, type RecipeDraftItem } from "@/lib/brio/user-recipes";
import { missingIngredients } from "@/lib/brio/selectors-catalog";
import { MEALS, type Food, type MealId, type UserRecipe } from "@/lib/brio/types";
import { cn } from "@/lib/utils";

/** One ingredient while it is being edited: the amount is whatever is typed. */
type DraftRow = { food: Food; grams: string };

/** Drops rows whose amount is not a usable number yet, for the preview and the save. */
function toDraftItems(rows: DraftRow[]): RecipeDraftItem[] {
  return rows.map((r) => ({ food: r.food, grams: parseNum(r.grams) }));
}

/**
 * Create or edit a recipe of your own: pick foods from the catalog with a
 * gram amount each, name it, choose how many servings it makes.
 *
 * `addUserRecipe`/`updateUserRecipe` already existed in the store, and the
 * model (`UserRecipe`) has been persisted and exported since early on — but
 * nothing ever wrote to it. Recipes could only be typed by hand into
 * data/recipes.json, which is off limits, so "my go-to tupper" had no way in.
 */
export function MyRecipeSheet({
  open,
  onOpenChange,
  edit,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** A recipe to edit in place. Omit to create a new one. */
  edit?: UserRecipe;
  onDeleted?: () => void;
}) {
  const addUserRecipe = useBrioStore((s) => s.addUserRecipe);
  const updateUserRecipe = useBrioStore((s) => s.updateUserRecipe);
  const deleteUserRecipe = useBrioStore((s) => s.deleteUserRecipe);
  const customFoods = useBrioStore((s) => s.customFoods);
  const recipes = useBrioStore((s) => s.recipes);
  const ctx = useMemo(() => ({ customFoods, recipes }), [customFoods, recipes]);

  const [name, setName] = useState("");
  const [servings, setServings] = useState("2");
  // The gram amount is kept as the raw text you typed. Storing it as a number
  // and re-rendering `String(grams)` meant every keystroke was round-tripped
  // through the parser: "12." lost its dot, so typing 12,5 g of aceite landed
  // on 125 g, and clearing the field snapped it back to "0".
  const [items, setItems] = useState<DraftRow[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (edit) {
      setName(edit.name);
      setServings(String(edit.servings));
      // Resolved from the current catalog, so a since-edited custom food shows
      // its latest macros; one that was deleted is silently dropped — nothing
      // else to show for it, and the recipe's own per100 already has its share
      // baked in from when it was saved.
      const resolved: DraftRow[] = [];
      for (const i of edit.items) {
        const food = getFood(i.foodId, { customFoods, recipes });
        if (food) resolved.push({ food, grams: String(i.grams) });
      }
      setItems(resolved);
    } else {
      setName("");
      setServings("2");
      setItems([]);
    }
    setQ("");
    setError(null);
    setConfirmDelete(false);
    // Only re-derive from `edit` when the sheet opens with a (possibly new)
    // target; customFoods/recipes changing while open would otherwise wipe
    // whatever the user is mid-editing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, edit]);

  const suggestions = useMemo(() => {
    const query = q.trim();
    if (query.length < 2) return [];
    // A recipe is built from real foods, not from other recipes — excluding
    // both flavours of recipe-as-food here keeps buildUserRecipe's per100 math
    // meaningfully additive instead of chaining through another recipe's
    // already-aggregated numbers.
    return searchFoods(query, null, ctx, 12).filter((f) => !f.recipe && !f.builtinRecipe);
  }, [q, ctx]);

  const preview = useMemo(
    () => buildUserRecipe(edit?.id ?? null, name, toDraftItems(items), parsePositive(servings) || 1),
    [edit, name, items, servings],
  );

  function addItem(food: Food) {
    if (items.some((i) => i.food.id === food.id)) {
      toast.success("Ya está en la receta");
      return;
    }
    setItems((prev) => [...prev, { food, grams: "100" }]);
    setQ("");
  }

  function setGrams(foodId: string, grams: string) {
    setItems((prev) => prev.map((i) => (i.food.id === foodId ? { ...i, grams } : i)));
  }

  function removeItem(foodId: string) {
    setItems((prev) => prev.filter((i) => i.food.id !== foodId));
  }

  function save() {
    if (!name.trim()) {
      setError("Ponle un nombre a la receta.");
      return;
    }
    if (items.length === 0) {
      setError("Añade al menos un ingrediente.");
      return;
    }
    const built = buildUserRecipe(edit?.id ?? null, name, toDraftItems(items), parsePositive(servings) || 1);
    if (!built) {
      setError("Pon una cantidad mayor que 0 en al menos un ingrediente.");
      return;
    }
    if (edit) updateUserRecipe(edit.id, built);
    else addUserRecipe(built);
    toast.success(edit ? "Receta actualizada" : "Receta guardada");
    onOpenChange(false);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={edit ? "Editar receta" : "Nueva receta"}
      footer={
        <div className="space-y-2">
          <Button className="w-full" onClick={save}>
            Guardar
          </Button>
          {edit ? (
            <Button variant="ghost" className="w-full text-destructive" onClick={() => setConfirmDelete(true)}>
              Borrar receta
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="ur-name">
            Nombre
          </label>
          <Input id="ur-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Mi tupper de siempre" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="ur-search">
            Ingredientes
          </label>
          <Input id="ur-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar alimento para añadir" />
          {suggestions.length > 0 ? (
            <ul className="mt-2 divide-y divide-border rounded-2xl bg-muted/40 px-3">
              {suggestions.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center justify-between gap-2 py-2 text-left text-sm"
                    onClick={() => addItem(f)}
                  >
                    <span className="min-w-0 truncate">{f.name}</span>
                    <Plus className="size-4 shrink-0 text-primary" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {items.length > 0 ? (
          <ul className="divide-y divide-border">
            {items.map((it) => (
              <li key={it.food.id} className="flex items-center gap-2 py-2">
                <span className="min-w-0 flex-1 truncate text-sm">{it.food.name}</span>
                <Input
                  className="w-20 text-right"
                  inputMode="decimal"
                  aria-label={`Gramos de ${it.food.name}`}
                  value={it.grams}
                  onChange={(e) => setGrams(it.food.id, e.target.value)}
                />
                <span className="text-xs text-muted-foreground">g</span>
                <button
                  type="button"
                  aria-label={`Quitar ${it.food.name}`}
                  className="grid size-11 shrink-0 place-items-center text-muted-foreground"
                  onClick={() => removeItem(it.food.id)}
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Aún no has añadido ningún ingrediente.</p>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="ur-servings">
            Raciones que salen
          </label>
          <Input
            id="ur-servings"
            inputMode="decimal"
            value={servings}
            onChange={(e) => setServings(e.target.value)}
          />
        </div>

        {preview ? (
          <div className="rounded-2xl bg-muted/40 p-3 text-sm">
            <p className="font-medium">Por ración ({nf(preview.servingG, 0)} g)</p>
            <p className="text-muted-foreground">
              {nf(userRecipePerServing(preview).kcal)} kcal · {nf(userRecipePerServing(preview).prot, 1)} g prot ·{" "}
              {nf(userRecipePerServing(preview).carb, 1)} g carb · {nf(userRecipePerServing(preview).fat, 1)} g grasa
            </p>
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
      {edit ? (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={`¿Borrar ${edit.name}?`}
          body="Los registros ya guardados con esta receta no cambian; solo deja de estar disponible para añadirla de nuevo."
          confirmLabel="Borrar"
          destructive
          onConfirm={() => {
            deleteUserRecipe(edit.id);
            toast.success("Receta borrada");
            onOpenChange(false);
            onDeleted?.();
          }}
        />
      ) : null}
    </Sheet>
  );
}

/** View, scale and log a recipe of your own — the same job RecipeDetail does for the catalog. */
export function MyRecipeDetail({
  open,
  onOpenChange,
  recipe,
  date,
  onEdit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  recipe: UserRecipe;
  date: string;
  onEdit: () => void;
}) {
  const addMeal = useBrioStore((s) => s.addMeal);
  const toggleFavRecipe = useBrioStore((s) => s.toggleFavRecipe);
  const favRecipes = useBrioStore((s) => s.favRecipes);
  const customFoods = useBrioStore((s) => s.customFoods);
  const recipes = useBrioStore((s) => s.recipes);
  const pantry = useBrioStore((s) => s.pantry);
  const settings = useBrioStore((s) => s.settings);
  const ctx = useMemo(() => ({ customFoods, recipes }), [customFoods, recipes]);
  const fav = favRecipes.includes(recipe.id);
  const [meal, setMeal] = useState<MealId>("comida");
  const [servings, setServings] = useState(recipe.servings);

  useEffect(() => {
    if (open) setServings(recipe.servings);
  }, [open, recipe]);

  const scaled = useMemo(() => scaleUserRecipe(recipe, servings), [recipe, servings]);
  const ingredients = useMemo(
    () =>
      scaled.ingredients
        .map((i) => ({ ...i, food: getFood(i.foodId, ctx) }))
        .filter((i): i is { foodId: string; grams: number; food: Food } => !!i.food),
    [scaled, ctx],
  );
  const missing = useMemo(
    () =>
      missingIngredients(
        { pantry, settings, customFoods, recipes },
        { ing: ingredients.map((i) => ({ id: i.food.id, name: i.food.name, g: i.grams, base: i.food.base, kcal: 0 })) },
      ),
    [ingredients, pantry, settings, customFoods, recipes],
  );

  function step(delta: number) {
    setServings((n) => Math.min(20, Math.max(0.5, Math.round((n + delta) * 2) / 2)));
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={recipe.name}
      footer={
        <div className="space-y-2">
          <Button
            className="w-full"
            onClick={() => {
              const food = getFood(recipe.id, ctx);
              if (!food) return;
              addMeal(date, meal, food, scaled.grams, scaled.servings, "ración");
              onOpenChange(false);
              toast.success("Receta registrada");
            }}
          >
            Registrar {nf(scaled.servings, scaled.servings % 1 === 0 ? 0 : 1)}{" "}
            {scaled.servings === 1 ? "ración" : "raciones"} · {nf(scaled.macros.kcal)} kcal
          </Button>
          <Button variant="outline" className="w-full" onClick={onEdit}>
            Editar receta
          </Button>
        </div>
      }
    >
      <p className="mb-3 text-sm text-muted-foreground">
        {nf(userRecipePerServing(recipe).kcal)} kcal/ración · {nf(userRecipePerServing(recipe).prot, 1)} g prot ·{" "}
        {nf(userRecipePerServing(recipe).carb, 1)} g carb · {nf(userRecipePerServing(recipe).fat, 1)} g grasa
      </p>
      <div className="mb-3 flex items-center justify-between rounded-2xl bg-muted/50 px-3 py-2">
        <span className="text-sm font-medium">Raciones</span>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" size="icon" aria-label="Menos raciones" onClick={() => step(-0.5)}>
            <Minus className="size-4" />
          </Button>
          <span className="w-10 text-center tabular-nums">{nf(servings, 1)}</span>
          <Button type="button" variant="secondary" size="icon" aria-label="Más raciones" onClick={() => step(0.5)}>
            <Plus className="size-4" />
          </Button>
        </div>
      </div>
      <div className="mb-3 flex gap-1 overflow-x-auto">
        {MEALS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMeal(m.id)}
            className={cn(
              "min-h-11 shrink-0 rounded-full px-3 text-xs",
              meal === m.id ? "bg-primary text-primary-foreground" : "bg-muted",
            )}
          >
            {m.n}
          </button>
        ))}
        <button
          type="button"
          onClick={() => toggleFavRecipe(recipe.id)}
          className="ml-auto grid size-11 place-items-center"
          aria-label={fav ? "Quitar de favoritas" : "Marcar como favorita"}
        >
          <Star className={cn("size-4", fav ? "fill-primary text-primary" : "text-muted-foreground")} />
        </button>
      </div>
      <h3 className="mb-1 text-sm font-medium">Ingredientes</h3>
      <ul className="mb-4 text-sm">
        {ingredients.map((i) => (
          <li key={i.foodId} className="flex justify-between py-1">
            <span>{i.food.name}</span>
            <span className="tabular-nums text-muted-foreground">{nf(i.grams, i.grams % 1 === 0 ? 0 : 1)} g</span>
          </li>
        ))}
      </ul>
      {missing.length ? (
        <p className="text-xs text-muted-foreground">Te falta: {missing.slice(0, 6).join(", ")}</p>
      ) : (
        <p className="text-xs text-muted-foreground">Tienes todos los ingredientes en la despensa.</p>
      )}
    </Sheet>
  );
}
