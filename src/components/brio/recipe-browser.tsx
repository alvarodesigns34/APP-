import { EmptyLine } from "@/components/brio/section";
import { useMemo, useState, type ReactNode } from "react";
import { Minus, Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RECIPE_CATS, RECIPE_FILTERS, filterName, getFood, recipeAsFood, searchRecipes } from "@/lib/brio/catalog";
import { RECIPE_SORTS, sortRecipes, type RecipeSortId } from "@/lib/brio/sort-recipes";
import { HighlightText } from "@/components/brio/highlight-text";
import { MyRecipeDetail, MyRecipeSheet } from "@/components/brio/my-recipes";
import { CookModeSheet } from "@/components/brio/cook-mode";
import { userRecipePerServing } from "@/lib/brio/user-recipes";
import { useCatalog } from "@/lib/brio/use-catalog";
import { CatalogNotice } from "@/components/brio/catalog-state";
import type { Recipe, UserRecipe } from "@/lib/brio/types";
import { MEALS, type MealId } from "@/lib/brio/types";
import { missingIngredients } from "@/lib/brio/selectors-catalog";
import { useBrioStore } from "@/lib/brio/store";
import { nf, norm, plural, round } from "@/lib/brio/format";
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
  const userRecipes = useBrioStore((s) => s.recipes);
  const catalog = useCatalog();
  const catalogReady = catalog.ready;
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<RecipeSortId>("relevancia");
  const [onlyFavs, setOnlyFavs] = useState(false);
  const [picked, setPicked] = useState<Recipe | null>(null);
  const [mode, setMode] = useState<"catalogo" | "mias">("catalogo");
  const [pickedMine, setPickedMine] = useState<UserRecipe | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingMine, setEditingMine] = useState<UserRecipe | null>(null);

  const myList = useMemo(() => {
    const query = norm(q).trim();
    const hits = query ? userRecipes.filter((r) => norm(r.name).includes(query)) : userRecipes;
    return [...hits].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [q, userRecipes]);

  const { list, found } = useMemo(() => {
    if (!catalogReady) return { list: [] as Recipe[], found: 0 };
    // Sort after searching so "relevancia" keeps the search ranking, and the
    // other orders apply to the whole matching set rather than to an
    // arbitrary slice of it.
    let hits = searchRecipes(q, { cat, badge: filter, limit: 200 });
    // Starring a recipe was possible but there was no way to list the starred
    // ones again — the only consumer of favRecipes was a sort elsewhere.
    if (onlyFavs) hits = hits.filter((r) => favRecipes.includes(r.id));
    const sorted = sortRecipes(hits, sort);
    return { list: sorted.slice(0, 60), found: sorted.length };
  }, [q, cat, filter, sort, catalogReady, onlyFavs, favRecipes]);

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

  if (pickedMine) {
    // `pickedMine` only pins *which* recipe is open — re-reading it from the
    // live store on every render means an edit made in the sheet below shows
    // up in the detail view immediately, instead of the sheet closing back
    // onto a frozen snapshot from before the edit.
    const liveMine = userRecipes.find((r) => r.id === pickedMine.id) ?? pickedMine;
    return (
      <>
        <MyRecipeDetail
          open={open && !editingMine}
          onOpenChange={(v) => {
            if (!v) {
              setPickedMine(null);
              onOpenChange(false);
            }
          }}
          recipe={liveMine}
          date={date}
          onEdit={() => setEditingMine(liveMine)}
        />
        <MyRecipeSheet
          open={!!editingMine}
          onOpenChange={(v) => {
            if (!v) setEditingMine(null);
          }}
          edit={editingMine ?? undefined}
          onDeleted={() => {
            setEditingMine(null);
            setPickedMine(null);
          }}
        />
      </>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Recetas">
      {/* "Mis recetas" used to have no way in at all: addUserRecipe existed and
          a starred user recipe stuck around forever, but nothing ever wrote
          to it, edited it, or listed the starred ones. */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <Button variant={mode === "catalogo" ? "default" : "secondary"} onClick={() => setMode("catalogo")}>
          Catálogo
        </Button>
        <Button variant={mode === "mias" ? "default" : "secondary"} onClick={() => setMode("mias")}>
          Mis recetas{userRecipes.length ? ` (${userRecipes.length})` : ""}
        </Button>
      </div>

      {mode === "mias" ? (
        <>
          <Input
            className="mb-3"
            placeholder="Buscar en mis recetas"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Button className="mb-3 w-full" variant="outline" onClick={() => setCreating(true)}>
            + Nueva receta
          </Button>
          {myList.length === 0 ? (
            <EmptyLine>
              {userRecipes.length === 0
                ? "Combina alimentos del catálogo en tu propia receta."
                : "Ninguna receta propia coincide."}
            </EmptyLine>
          ) : (
            <ul className="space-y-2">
              {myList.map((r) => {
                const per = userRecipePerServing(r);
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      className="min-h-11 w-full rounded-2xl bg-muted/50 px-3 py-3 text-left"
                      onClick={() => setPickedMine(r)}
                    >
                      <div className="flex justify-between gap-2">
                        <span className="font-medium">
                          <HighlightText text={r.name} query={q} />
                        </span>
                        {favRecipes.includes(r.id) ? <Star className="size-4 fill-primary text-primary" /> : null}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {plural(r.servings, "ración", "raciones")} · {nf(per.kcal)} kcal · {nf(per.prot, 1)} g prot
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <MyRecipeSheet open={creating} onOpenChange={setCreating} />
        </>
      ) : (
        <>
          <Input placeholder="Buscar receta" value={q} onChange={(e) => setQ(e.target.value)} />
          {/* Three identical unlabelled chip rows gave no clue what each one did. */}
          <ChipRow label="Tipo">
            <Chip on={!cat && !onlyFavs} onClick={() => { setCat(null); setOnlyFavs(false); }}>
              Todas
            </Chip>
            <Chip on={onlyFavs} onClick={() => setOnlyFavs((v) => !v)}>
              Favoritas
            </Chip>
            {RECIPE_CATS.map((c) => (
              <Chip key={c.id} on={cat === c.id} onClick={() => setCat(cat === c.id ? null : c.id)}>
                {c.n}
              </Chip>
            ))}
          </ChipRow>
          <ChipRow label="Filtro">
            {RECIPE_FILTERS.map((f) => (
              <Chip key={f.id} on={filter === f.id} onClick={() => setFilter(filter === f.id ? null : f.id)} title={f.why}>
                {f.n}
              </Chip>
            ))}
          </ChipRow>
          <ChipRow label="Orden">
            {RECIPE_SORTS.map((s) => (
              <Chip key={s.id} on={sort === s.id} onClick={() => setSort(s.id)}>
                {s.n}
              </Chip>
            ))}
          </ChipRow>
          {!catalogReady ? <CatalogNotice state={catalog} loadingText="Cargando recetas…" noun="las recetas" /> : null}
          {catalogReady ? (
            <p className="mb-2 text-xs text-muted-foreground" aria-live="polite">
              {/* The old label read list.length, which is capped at 60, so a broad
                  search always claimed exactly "60 recetas". */}
              {found === 0
                ? onlyFavs
                  ? "Aún no has marcado ninguna receta con la estrella"
                  : "Ninguna receta coincide"
                : found > list.length
                  ? `${list.length} de ${plural(found, "receta", "recetas")}`
                  : plural(found, "receta", "recetas")}
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
        </>
      )}
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
  const customFoods = useBrioStore((s) => s.customFoods);
  const userRecipes = useBrioStore((s) => s.recipes);
  const addShoppingItems = useBrioStore((s) => s.addShoppingItems);
  const catalogCtx = useMemo(() => ({ customFoods, recipes: userRecipes }), [customFoods, userRecipes]);
  const fav = favRecipes.includes(recipe.id);
  const missing = useMemo(() => missingIngredients({ ...useBrioStore.getState(), pantry }, recipe), [pantry, recipe]);
  const [meal, setMeal] = useState<MealId>("comida");
  const [cooking, setCooking] = useState(false);
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
        <button
          type="button"
          onClick={() => toggle(recipe.id)}
          aria-label={fav ? "Quitar de favoritas" : "Marcar como favorita"}
          aria-pressed={fav}
          className="ml-auto grid size-11 place-items-center"
        >
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
        <div className="mb-3 rounded-2xl bg-muted/50 px-3 py-2">
          <p className="text-xs text-muted-foreground">Te falta: {missing.slice(0, 6).join(", ")}</p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-2 w-full"
            onClick={() => {
              const added = addShoppingItems(
                // Scaled grams, so the list matches the servings you picked.
                scaled.ingredients
                  .filter((i) => missing.includes(i.name))
                  .map((i) => ({ name: i.name, qty: `${nf(i.g, 0)} ${i.base}`, cat: getFood(i.id, catalogCtx)?.cat, foodId: i.id })),
              );
              if (!added) toast("Ya lo tienes todo en la lista");
            }}
          >
            Añadir a la lista de la compra
          </Button>
        </div>
      ) : (
        <p className="mb-3 text-xs text-primary">Tienes lo necesario en la despensa.</p>
      )}
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium">Pasos</h3>
        {recipe.steps.length > 0 ? (
          <Button variant="ghost" size="sm" onClick={() => setCooking(true)}>
            Modo cocina
          </Button>
        ) : null}
      </div>
      <ol className="list-decimal space-y-2 pl-4 text-sm text-muted-foreground">
        {recipe.steps.map((st, i) => (
          <li key={i}>{st}</li>
        ))}
      </ol>
      {/* Los ingredientes van ya escalados a las raciones elegidas: cocinar
          para cuatro con las cantidades de una sería el peor momento para
          descubrir el desajuste. */}
      <CookModeSheet
        open={cooking}
        onOpenChange={setCooking}
        name={recipe.name}
        steps={recipe.steps}
        ingredients={scaled.ingredients.map((i) => ({ name: i.name, g: i.g, base: i.base }))}
      />
    </Sheet>
  );
}

function Chip({
  on,
  onClick,
  children,
  title,
}: {
  on: boolean;
  onClick: () => void;
  children: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      // RECIPE_FILTERS carries a `why` for each badge ("Como máximo 400 kcal
      // por ración") that was written and never surfaced anywhere.
      title={title}
      className={cn(
        "min-h-11 shrink-0 rounded-full px-3 text-xs",
        on ? "bg-primary font-medium text-primary-foreground" : "bg-muted",
      )}
    >
      {children}
    </button>
  );
}

/** A labelled row of chips, so each filter row says what it filters. */
function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="w-12 shrink-0 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="flex flex-1 gap-1 overflow-x-auto">{children}</div>
    </div>
  );
}
