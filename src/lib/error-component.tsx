import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

export function AppErrorComponent({ error }: ErrorComponentProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center text-foreground">
      <span className="text-destructive" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="font-display text-xl tracking-tight">Algo ha fallado</h1>
      <p className="max-w-md text-sm break-words text-muted-foreground">
        {error.message || "Ha ocurrido un error inesperado. Prueba a recargar."}
      </p>
    </main>
  );
}
