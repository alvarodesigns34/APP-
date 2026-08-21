import { Button } from "@/components/ui/button";
import type { CatalogState } from "@/lib/brio/use-catalog";

/**
 * Placeholder shown while the builtin catalog loads or after it fails.
 *
 * Screens must render this instead of their "no results" copy: an empty list
 * during loading reads as "this food does not exist", which is not true.
 */
export function CatalogNotice({ state, loadingText }: { state: CatalogState; loadingText: string }) {
  if (state.failed) {
    return (
      <div className="px-5 py-8 text-center">
        <p className="text-sm font-medium">No se han podido cargar los alimentos</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Comprueba la conexión. Lo que ya tienes registrado no se ha perdido.
        </p>
        <Button className="mt-4" variant="secondary" onClick={state.retry}>
          Reintentar
        </Button>
      </div>
    );
  }
  return (
    <p className="px-5 py-8 text-center text-sm text-muted-foreground" aria-busy="true">
      {loadingText}
    </p>
  );
}

/** Inline one-liner for strips and cards that cannot host the full notice. */
export function CatalogInlineNotice({ state, loadingText }: { state: CatalogState; loadingText: string }) {
  if (state.failed) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-3xl bg-card px-4 py-3">
        <span className="text-sm text-muted-foreground">No se han podido cargar los alimentos.</span>
        <Button size="sm" variant="secondary" onClick={state.retry}>
          Reintentar
        </Button>
      </div>
    );
  }
  return (
    <p className="rounded-3xl bg-card px-4 py-3 text-sm text-muted-foreground" aria-busy="true">
      {loadingText}
    </p>
  );
}
