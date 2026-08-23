import { createFileRoute } from "@tanstack/react-router";
import { TrendsScreen } from "@/components/screens/trends";

export const Route = createFileRoute("/tendencias")({
  component: TrendsScreen,
  // Esto es solo un prefetch del chunk de las gráficas (Recharts, ~420 kB), y
  // como tal no puede tumbar la pantalla. El router espera al loader antes de
  // renderizar, así que sin el `catch` un import fallido —sin red, o con mala
  // cobertura— acababa en "Algo ha fallado" y se llevaba por delante el
  // resumen semanal, la proyección de peso, los logros, las medidas y el
  // calendario, que no necesitan Recharts para nada. Tragándolo, el `lazy` +
  // `Suspense` de dentro enseña su esqueleto y el resto de la pantalla
  // funciona.
  loader: () => import("@/components/screens/trends-charts").catch(() => undefined),
});
