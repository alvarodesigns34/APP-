import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { keepAwake, wakeLockSupported } from "@/lib/brio/wake-lock";
import { nf, plural } from "@/lib/brio/format";
import { cn } from "@/lib/utils";

/**
 * Cocinar una receta paso a paso, con la pantalla encendida.
 *
 * Los pasos ya estaban en la ficha, pero como una lista numerada de corrido:
 * con las manos manchadas hay que buscar por dónde ibas cada vez que vuelves
 * al móvil, y la pantalla se ha apagado sola. Aquí se marca lo hecho y no se
 * apaga mientras la hoja está abierta.
 *
 * Lo tachado es estado de la sesión, no algo que se guarde: una receta no
 * está «a medio cocinar» de un día para otro, y persistirlo obligaría a
 * limpiarlo en algún momento que no existe.
 */
export function CookModeSheet({
  open,
  onOpenChange,
  name,
  steps,
  ingredients,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  name: string;
  steps: string[];
  ingredients: { name: string; g: number; base: string }[];
}) {
  const [done, setDone] = useState<boolean[]>([]);

  useEffect(() => {
    if (open) setDone(Array(steps.length).fill(false));
  }, [open, steps.length]);

  useEffect(() => {
    if (!open) return;
    return keepAwake();
  }, [open]);

  const count = useMemo(() => done.filter(Boolean).length, [done]);
  const supported = useMemo(() => typeof navigator !== "undefined" && wakeLockSupported(), []);

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={name}
      footer={
        <Button variant="secondary" className="w-full" onClick={() => onOpenChange(false)}>
          {count === steps.length && steps.length > 0 ? "Listo" : "Salir del modo cocina"}
        </Button>
      }
    >
      <p className="mb-1 text-sm text-muted-foreground">
        {count} de {plural(steps.length, "paso", "pasos")}
      </p>
      <div className="mb-4 h-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-200"
          style={{ width: `${steps.length ? (count / steps.length) * 100 : 0}%` }}
        />
      </div>

      {ingredients.length > 0 ? (
        <details className="mb-4 rounded-2xl bg-muted/40 px-3 py-2">
          {/* Plegado: cocinando importan los pasos, pero tener los ingredientes
              a un toque evita salir de aquí y perder por dónde ibas. */}
          <summary className="min-h-11 cursor-pointer list-none py-2 text-sm font-medium">
            Ingredientes ({ingredients.length})
          </summary>
          <ul className="pb-1 text-sm">
            {ingredients.map((i) => (
              <li key={i.name} className="flex justify-between py-0.5">
                <span>{i.name}</span>
                <span className="tabular-nums text-muted-foreground">
                  {nf(i.g, i.g % 1 === 0 ? 0 : 1)} {i.base}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <ol className="space-y-2">
        {steps.map((st, i) => {
          const on = done[i] ?? false;
          return (
            <li key={i}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => setDone((prev) => prev.map((v, j) => (j === i ? !v : v)))}
                className={cn(
                  "flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition-colors",
                  on ? "bg-primary/10" : "bg-muted/40",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-medium",
                    on ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground",
                  )}
                  aria-hidden="true"
                >
                  {on ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span className={cn("text-sm", on && "text-muted-foreground line-through")}>{st}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {supported ? (
        <p className="mt-4 text-xs text-muted-foreground">La pantalla no se apagará mientras cocinas.</p>
      ) : null}
    </Sheet>
  );
}
