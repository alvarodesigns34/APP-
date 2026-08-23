import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Screen({ children }: { children: ReactNode }) {
  return <div className="px-4 pb-6">{children}</div>;
}

export function Title({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <header className="mb-4">
      <h1 className="font-display text-3xl font-medium tracking-tight">{children}</h1>
      {sub ? <p className="mt-1 text-sm text-muted-foreground">{sub}</p> : null}
    </header>
  );
}

/**
 * A card. With `onClick` the whole card is the tap target, and then it always
 * carries a chevron.
 *
 * Agua, Sueño, Peso and la racha were tappable and looked exactly like a static
 * card, so the only way to find out was to poke at them. Cards with their own
 * buttons inside (Pasos, Entrenamiento) stay plain `div`s and say what they do
 * on the button itself.
 */
export function Card({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  const cls = cn("rounded-3xl bg-card p-4 shadow-card", className);
  if (onClick) {
    return (
      <button
        type="button"
        className={cn(
          cls,
          "flex w-full items-center gap-3 text-left transition-transform duration-150 ease-out active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
        onClick={onClick}
      >
        <div className="min-w-0 flex-1">{children}</div>
        <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground" />
      </button>
    );
  }
  return <div className={cls}>{children}</div>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="mb-2 mt-6 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">{children}</h2>;
}

/**
 * El «no hay nada aquí» de dentro de una lista, que es otro trabajo que el
 * `Empty` de sección: va entre resultados, no en lugar de una tarjeta.
 * Existía cuatro veces copiado a mano con tres rellenos distintos (py-6, py-8,
 * y una con fondo propio), que es variación sin significado.
 */
export function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="px-4 py-8 text-center text-sm text-balance text-muted-foreground">{children}</p>;
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl bg-card px-5 py-8 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
