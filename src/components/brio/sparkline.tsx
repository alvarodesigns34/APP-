import { cn } from "@/lib/utils";

/**
 * Una línea de evolución diminuta, en SVG a pelo.
 *
 * Sin Recharts a propósito. Esto vive en la tarjeta de Medidas de Tendencias,
 * que se pinta sin tocar el chunk de las gráficas (~420 kB) y por tanto
 * funciona sin red; meter la librería aquí le costaría eso a una tarjeta que
 * enseña cinco líneas de veinte píxeles.
 *
 * La escala es propia de cada serie, no compartida: la gracia es ver la forma
 * del cambio, y una cintura que baja de 86 a 82 y un brazo que sube de 35 a 36
 * no comparten rango útil. Por eso el valor exacto va siempre al lado, en
 * texto: la línea sola no dice cuánto.
 */
export function Sparkline({
  values,
  className,
  width = 64,
  height = 20,
}: {
  values: number[];
  className?: string;
  width?: number;
  height?: number;
}) {
  // Con un solo punto no hay evolución que enseñar, y una línea plana sugeriría
  // que se ha medido varias veces sin cambio.
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  // Medio grosor de trazo por arriba y por abajo, para que no se corte.
  const pad = 1.5;
  const inner = height - pad * 2;

  // Una serie constante no tiene rango: se pinta plana por el centro en vez de
  // dividir entre cero.
  const yOf = (v: number) => (max === min ? pad + inner / 2 : pad + inner - ((v - min) / (max - min)) * inner);
  const xOf = (i: number) => (i / (values.length - 1)) * width;

  const d = values.map((v, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(" ");
  const lastX = width;
  const lastY = yOf(values[values.length - 1]);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn("overflow-visible", className)}
      // El número exacto y su variación están en la misma fila, en texto, así
      // que para un lector de pantalla esto es decoración.
      aria-hidden
      focusable="false"
    >
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r={2} fill="currentColor" />
    </svg>
  );
}
