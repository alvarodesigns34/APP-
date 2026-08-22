import { useMemo, useState } from "react";
import { Minus, Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RECIPE_CATS, RECIPE_FILTERS, filterName, recipeAsFood, searchRecipes } from "@/lib/brio/catalog";
import { RECIPE_SORTS, sortRecipes, type RecipeSortId } from "@/lib/brio/sort-recipes";
import { HighlightText } from "@/components/brio/highlight-text";
import { useCatalog } from "@/lib/brio/use-catalog";
import { CatalogNotice } from "@/components/brio/catalog-state";
import type { Recipe } from "@/lib/brio/types";
import { MEALS, type MealId } from "@/lib/brio/types";
import { missingIngredients } from "@/lib/brio/selectors-catalog";
import { useBrioStore } from "@/lib/brio/store";
import { nf, round } from "@/lib/brio/format";
import { scaleRecipe } from "@/lib/brio/scale-recipe";
import { cn } from "@/lib/utils";

export function RecipeBrowser({
  open,
  onOpenChange,
  date,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  date: string;
}) {
  const favRecipes = useBrioStore((s) => s.favRecipes);
  const catalog = useCatalog();
  const catalogReady = catalog.ready;
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<RecipeSortId>("relevancia");
  const [picked, setPicked] = useState<Recipe | null>(null);

  const list = useMemo(() => {
    if (!catalogReady) return [];
    // Sort after searching so "relevancia" keeps the search ranking, and the
    // other orders apply to the whole matching set rather than to an
    // arbitrary slice of it.
    const found = searchRecipes(q, { cat, badge: filter, limit: 200 });
    const sorted = sortRecipes(found, sort);
    return sorted.slice(0, 60);
  }, [q, cat, filter, sort, catalogReady]);

  if (picked) {
    return (
      <RecipeDetail
        open={open}
        onOpenChange={(v) => {
          if (!v) {
            setPicked(null);
            onOpenChange(false);
          }
        }}
        recipe={picked}
        date={date}
      />
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Recetas">
      <Input placeholder="Buscar receta" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="my-2 flex gap-1 overflow-x-auto">
        <Chip on={!cat} onClick={() => setCat(null)}>
          Todas
        </Chip>
        {RECIPE_CATS.map((c) => (
          <Chip key={c.id} on={cat === c.id} onClick={() => setCat(c.id)}>
            {c.n}
          </Chip>
        ))}
      </div>
      <div className="mb-3 flex gap-1 overflow-x-auto">
        {RECIPE_FILTERS.map((f) => (
          <Chip key={f.id} on={filter === f.id} onClick={() => setFilter(filter === f.id ? null : f.id)}>
            {f.n}
          </Chip>
        ))}
      </div>
      <div className="mb-3 flex gap-1 overflow-x-auto">
        {RECIPE_SORTS.map((s) => (
          <Chip key={s.id} on={sort === s.id} onClick={() => setSort(s.id)}>
            {s.n}
          </Chip>
        ))}
      </div>
      {!catalogReady ? <CatalogNotice state={catalog} loadingText="Cargando recetas…" /> : null}
      {catalogReady ? (
        <p className="mb-2 text-xs text-muted-foreground" aria-live="polite">
          {list.length === 0
            ? "Ninguna receta coincide"
            : `${list.length} receta${list.length === 1 ? "" : "s"}`}
        </p>
      ) : null}
      <ul className="space-y-2">
        {list.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              className="min-h-11 w-full rounded-2xl bg-muted/50 px-3 py-3 text-left"
              onClick={() => setPicked(r)}
            >
              <div className="flex justify-between gap-2">
                <span className="font-medium">
                  <HighlightText text={r.name} query={q} />
                </span>
                {favRecipes.includes(r.id) ? <Star className="size-4 fill-primary text-primary" /> : null}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {r.minutes} min · {nf(r.perServing.kcal)} kcal · {nf(r.perServing.prot)} g prot
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {r.badges.slice(0, 3).map((b) => (
                  <em key={b} className="not-italic text-xs text-primary">
                    {filterName(b)}
                  </em>
                ))}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

export function RecipeDetail({
  open,
  onOpenChange,
  recipe,
  date,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  recipe: Recipe;
  date: string;
}) {
  const addMeal = useBrioStore((s) => s.addMeal);
  const toggle = useBrioStore((s) => s.toggleFavRecipe);
  const favRecipes = useBrioStore((s) => s.favRecipes);
  const pantry = useBrioStore((s) => s.pantry);
  const fav = favRecipes.includes(recipe.id);
  const missing = useMemo(() => missingIngredients({ ...useBrioStore.getState(), pantry }, recipe), [pantry, recipe]);
  const [meal, setMeal] = useState<MealId>("comida");
  const [servings, setServings] = useState(1);
  const scaled = useMemo(() => scaleRecipe(recipe, servings), [recipe, servings]);
  const badges = recipe.badges;
  const presets = useMemo(() => {
    const vals = [1, recipe.servings / 2, recipe.servings, recipe.servings * 1.5].filter((n) => n > 0.5 && n <= 20);
    return [...new Set(vals.map((n) => round(n, 1)))].sort((a, b) => a - b);
  }, [recipe.servings]);

  function step(delta: number) {
    setServings((n) => Math.min(20, Math.max(0.5, round(n + delta, 1))));
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={recipe.name}
      footer={
        <Button
          className="w-full"
          onClick={() => {
            addMeal(date, meal, recipeAsFood(recipe), scaled.grams, scaled.servings, "ración");
            onOpenChange(false);
            toast.success("Receta registrada");
          }}
        >
          Registrar {nf(scaled.servings, scaled.servings % 1 === 0 ? 0 : 1)}{" "}
          {scaled.servings === 1 ? "ración" : "raciones"} · {nf(scaled.macros.kcal)} kcal
        </Button>
      }
    >
      <div className="mb-3 flex flex-wrap gap-1">
        {badges.map((b) => (
          <span key={b} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
            {filterName(b)}
          </span>
        ))}
        {recipe.tags.map((t) => (
          <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-xs">
            {t}
          </span>
        ))}
      </div>
      {/* Fixed recipe facts (per serving) — the "Raciones" stepper below and the
          register button already show the amount scaled to what's selected, so
          this line stays a constant reference instead of mixing a total serving
          count with a kcal figure that only applies to the current selection. */}
      <p className="mb-3 text-sm text-muted-foreground">
        {recipe.minutes} min · {recipe.servings} raciones · {nf(recipe.perServing.kcal)} kcal/ración ·{" "}
        {nf(recipe.perServing.prot, 1)} g prot · {nf(recipe.perServing.carb, 1)} g carb ·{" "}
        {nf(recipe.perServing.fat, 1)} g grasa
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
        {presets.map((n) => (
          <Chip key={n} on={servings === n} onClick={() => setServings(n)}>
            {n === 1 ? "1 ración" : `${nf(n, n % 1 === 0 ? 0 : 1)} raciones`}
          </Chip>
        ))}
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
        <button type="button" onClick={() => toggle(recipe.id)} className="ml-auto grid size-11 place-items-center">
          <Star className={cn("size-4", fav ? "fill-primary text-primary" : "text-muted-foreground")} />
        </button>
      </div>
      <h3 className="mb-1 text-sm font-medium">Ingredientes</h3>
      <ul className="mb-4 text-sm">
        {scaled.ingredients.map((i) => (
          <li key={i.id} className="flex justify-between py-1">
            <span>{i.name}</span>
            <span className="tabular-nums text-muted-foreground">
              {nf(i.g, i.g % 1 === 0 ? 0 : 1)} {i.base}
            </span>
          </li>
        ))}
      </ul>
      {missing.length ? (
        <p className="mb-3 text-xs text-muted-foreground">Te falta: {missing.slice(0, 6).join(", ")}</p>
      ) : (
        <p className="mb-3 text-xs text-primary">Tienes lo necesario en la despensa.</p>
      )}
      <h3 className="mb-1 text-sm font-medium">Pasos</h3>
      <ol className="list-decimal space-y-2 pl-4 text-sm text-muted-foreground">
        {recipe.steps.map((st, i) => (
          <li key={i}>{st}</li>
        ))}
      </ol>
    </Sheet>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-11 shrink-0 rounded-full px-3 text-xs",
        on ? "bg-primary text-primary-foreground" : "bg-muted",
      )}
    >
      {children}
    </button>
  );
}
