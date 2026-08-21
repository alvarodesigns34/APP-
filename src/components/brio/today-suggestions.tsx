import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Card, SectionLabel } from "@/components/brio/section";
import { RecipeDetail } from "@/components/brio/recipe-browser";
import { nf } from "@/lib/brio/format";
import { suggestRecipes } from "@/lib/brio/selectors-catalog";
import { useBrioStore } from "@/lib/brio/store";
import { useCatalog } from "@/lib/brio/use-catalog";
import type { Recipe } from "@/lib/brio/types";

export function TodaySuggestions({ date }: { date: string }) {
  const ready = useCatalog();
  const snap = useBrioStore(
    useShallow((s) => ({
      days: s.days,
      goals: s.goals,
      profile: s.profile,
      settings: s.settings,
      weights: s.weights,
      customFoods: s.customFoods,
      recipes: s.recipes,
      pantry: s.pantry,
      favorites: s.favorites,
      favRecipes: s.favRecipes,
      recents: s.recents,
      schema: s.schema,
      onboarded: s.onboarded,
    })),
  );
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const sug = useMemo(() => {
    if (!ready) return { list: [] as Recipe[], remKcal: 0, remProt: 0 };
    return suggestRecipes(snap, date, 3);
  }, [ready, snap, date]);

  if (!ready || sug.list.length === 0) return null;

  return (
    <>
      <SectionLabel>Te encaja para lo que queda</SectionLabel>
      <Card>
        <p className="mb-3 text-sm text-muted-foreground">
          Te quedan <span className="font-medium text-foreground">{nf(sug.remKcal)} kcal</span>
          {sug.remProt > 0 ? ` y ${nf(sug.remProt)} g de proteína` : ""}.
        </p>
        <div className="space-y-2">
          {sug.list.map((r) => (
            <button
              key={r.id}
              type="button"
              className="flex w-full items-center justify-between rounded-2xl bg-muted/60 px-3 py-2 text-left"
              onClick={() => setRecipe(r)}
            >
              <span>
                <span className="block font-medium">{r.name}</span>
                <span className="text-xs text-muted-foreground">
                  {r.minutes} min · {nf(r.perServing.prot)} g prot
                </span>
              </span>
              <span className="tabular-nums text-sm">{nf(r.perServing.kcal)} kcal</span>
            </button>
          ))}
        </div>
      </Card>
      {recipe ? (
        <RecipeDetail open={!!recipe} onOpenChange={(v) => !v && setRecipe(null)} recipe={recipe} date={date} />
      ) : null}
    </>
  );
}
