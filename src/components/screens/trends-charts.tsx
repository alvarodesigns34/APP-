import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, Empty, SectionLabel } from "@/components/brio/section";
import { nf } from "@/lib/brio/format";
import { niceCeil, type MacroSeriesPoint } from "@/lib/brio/macro-series";
import { cn } from "@/lib/utils";
import { fmtWeight, kgToDisplay, type UnitSystem } from "@/lib/brio/units";

export type DayPoint = MacroSeriesPoint<{
  d: string;
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
  water: number;
  move: number;
  /** null on a day nobody logged, so the line breaks instead of dropping to 0. */
  steps: number | null;
  sleep: number | null;
}>;

export type PesoPoint = {
  label: string;
  kg: number | null;
  trend: number;
  goal: number;
  bandLow: number;
  bandHigh: number;
  ma7: number | null;
};

type MacroKey = "kcal" | "prot" | "carb" | "fat";

const MACRO_CHARTS: {
  key: MacroKey;
  ma: "kcalMa" | "protMa" | "carbMa" | "fatMa";
  goal: "kcalGoal" | "protGoal" | "carbGoal" | "fatGoal";
  label: string;
  unit: string;
}[] = [
  // Todos con el color de acento a propósito. Antes «Hidratos» se pintaba con
  // el azul de Pasos y «Grasa» con el terracota de Ejercicio, así que el mismo
  // color significaba una cosa aquí y otra distinta en los aros de Hoy —
  // dos significados por color, a dos dedos de distancia. El color pasa a
  // decir «esto es nutrición»; cuál de los cuatro lo dice el título.
  { key: "kcal", ma: "kcalMa", goal: "kcalGoal", label: "Calorías", unit: " kcal" },
  { key: "prot", ma: "protMa", goal: "protGoal", label: "Proteína", unit: " g" },
  { key: "carb", ma: "carbMa", goal: "carbGoal", label: "Hidratos", unit: " g" },
  { key: "fat", ma: "fatMa", goal: "fatGoal", label: "Grasa", unit: " g" },
];

function macroYDomain(
  data: DayPoint[],
  value: MacroKey,
  ma: (typeof MACRO_CHARTS)[number]["ma"],
  goal: (typeof MACRO_CHARTS)[number]["goal"],
): [number, number] {
  let max = 0;
  for (const p of data) {
    for (const v of [p[value], p[ma], p[goal]]) {
      if (typeof v === "number" && Number.isFinite(v)) max = Math.max(max, v);
    }
  }
  if (max <= 0) return [0, 1];
  // A raw max * 1.08 makes the top tick something like 2440.8, which a narrow
  // axis clipped to "440,8". Round up to a readable ceiling instead.
  return [0, niceCeil(max * 1.02)];
}

/**
 * Hay serie cuando algún día del rango tiene un valor mayor que cero.
 *
 * No vale con `Number.isFinite`: `water` es siempre un número y vale 0 los días
 * sin registrar, así que la comprobación pasaba siempre y la gráfica vacía
 * seguía dibujándose. Un 0 de agua, pasos o sueño tampoco es un dato que
 * merezca una gráfica: es la ausencia de dato, igual que el null.
 */
function hasSeries(data: DayPoint[], key: "water" | "sleep" | "steps"): boolean {
  return data.some((d) => Number(d[key]) > 0);
}

/**
 * Una sola leyenda para las cuatro gráficas de nutrición, que comparten
 * codificación. Repetirla debajo de cada una sumaba tres bloques idénticos de
 * ruido vertical sin añadir nada.
 */
function MacroLegend() {
  return (
    <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 px-1 text-[11px] text-muted-foreground">
      <li className="flex items-center gap-1.5">
        <span className="h-2 w-3 rounded-sm bg-[var(--brio-kcal)]/30" />
        Diario
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-0.5 w-3 rounded-full bg-[var(--brio-kcal)]" />
        Media 7 días
      </li>
      <li className="flex items-center gap-1.5">
        <span className="w-3 border-t border-dotted border-[var(--brio-muted-fg)]" />
        Meta
      </li>
    </ul>
  );
}

function MacroComposedChart({
  data,
  valueKey,
  maKey,
  goalKey,
  label,
  unit,
}: {
  data: DayPoint[];
  valueKey: MacroKey;
  maKey: (typeof MACRO_CHARTS)[number]["ma"];
  goalKey: (typeof MACRO_CHARTS)[number]["goal"];
  label: string;
  unit: string;
}) {
  const domain = macroYDomain(data, valueKey, maKey, goalKey);
  const color = "var(--brio-kcal)";
  return (
    <>
      <SectionLabel>{label}</SectionLabel>
      <Card className="mb-3 p-2">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--brio-border)" />
              <XAxis dataKey="d" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} width={46} domain={domain} allowDecimals={false} tickFormatter={(v) => nf(Number(v))} />
              <Tooltip
                formatter={(v, name) => {
                  const n = typeof v === "number" ? v : Number(v);
                  if (!Number.isFinite(n)) return ["—", String(name)];
                  return [`${nf(n)}${unit}`, String(name)];
                }}
              />
              {/* Barras y media compartían el mismo color sólido, así que la
                  media no se distinguía de las barras: parecía el borde de
                  arriba, ondulado. La leyenda prometía tres series y en
                  pantalla se veían dos. Mantener un solo color (regla de la
                  casa: un color, un significado) y separarlas por peso visual:
                  el dato bruto queda de fondo y la media, que es la señal que
                  de verdad se lee, va sólida y encima. */}
              <Bar
                dataKey={valueKey}
                name="Diario"
                fill={color}
                fillOpacity={0.3}
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
              <Line
                type="linear"
                dataKey={maKey}
                name="Media 7d"
                stroke={color}
                strokeWidth={2.5}
                connectNulls={false}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="linear"
                dataKey={goalKey}
                name="Meta"
                stroke="var(--brio-muted-fg)"
                strokeWidth={1.5}
                strokeDasharray="2 4"
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </>
  );
}

export function TrendsCharts({
  data,
  wChart,
  pesoDomain,
  units,
}: {
  data: DayPoint[];
  wChart: PesoPoint[];
  pesoDomain: [number, number];
  units: UnitSystem;
}) {
  return (
    <>
      <MacroLegend />
      {MACRO_CHARTS.map((c) => (
        <MacroComposedChart
          key={c.key}
          data={data}
          valueKey={c.key}
          maKey={c.ma}
          goalKey={c.goal}
          label={c.label}
          unit={c.unit}
        />
      ))}

      <SectionLabel>Agua</SectionLabel>
      {!hasSeries(data, "water") ? (
        <div className="mb-3">
          <Empty title="Aún sin agua" body="Registra un vaso desde Hoy y verás aquí tu semana." />
        </div>
      ) : (
      <Card className="mb-3 h-44 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis dataKey="d" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} width={46} allowDecimals={false} tickFormatter={(v) => nf(Number(v))} />
            <Tooltip formatter={(v) => [`${v} ml`, "Agua"]} />
            <Bar dataKey="water" fill="var(--brio-water)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      )}

      <SectionLabel>Sueño</SectionLabel>
      {!hasSeries(data, "sleep") ? (
        <div className="mb-3">
          <Empty title="Aún sin sueño" body="Anota a qué hora te acuestas y te levantas para ver la evolución." />
        </div>
      ) : (
      <Card className="mb-3 h-44 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="d" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} width={46} allowDecimals={false} tickFormatter={(v) => nf(Number(v))} />
            <Tooltip formatter={(v) => [`${v} h`, "Sueño"]} />
            {/* connectNulls={false}: a gap is the honest rendering of a day with no log. */}
            <Line
              type="monotone"
              dataKey="sleep"
              stroke="var(--brio-sleep)"
              strokeWidth={2}
              dot={{ r: 2 }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>
      )}

      <SectionLabel>Pasos</SectionLabel>
      {!hasSeries(data, "steps") ? (
        <div className="mb-3">
          <Empty title="Aún sin pasos" body="Apunta tus pasos del día en Hoy para seguir la tendencia." />
        </div>
      ) : (
      <Card className="mb-3 h-44 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="d" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} width={46} allowDecimals={false} tickFormatter={(v) => nf(Number(v))} />
            <Tooltip formatter={(v) => [`${v}`, "Pasos"]} />
            <Line
              type="monotone"
              dataKey="steps"
              stroke="var(--brio-steps)"
              strokeWidth={2}
              dot={{ r: 2 }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>
      )}

      {wChart.length > 0 ? (
        <>
          <SectionLabel>Peso</SectionLabel>
          <Card className="p-2">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={wChart} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--brio-border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={16} />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    width={40}
                    domain={pesoDomain}
                    tickFormatter={(v) => nf(kgToDisplay(Number(v), units), 1)}
                  />
                  <Tooltip
                    formatter={(v, name) => {
                      const n = typeof v === "number" ? v : Number(v);
                      if (!Number.isFinite(n)) return ["—", String(name)];
                      return [fmtWeight(n, units), String(name)];
                    }}
                  />
                  {/* Banda de incertidumbre como área de rango [low, high].
                      Antes eran dos áreas con `stackId`, el truco habitual para
                      dibujar una banda flotante. Pero al apilar, Recharts mete
                      la base del stack (el 0) en el dominio del eje Y y se come
                      el `domain={pesoDomain}`: el eje salía de 0 a 79,5 y los
                      pesos reales quedaban aplastados en el 5 % de arriba, con
                      lo que la gráfica de peso no dejaba ver ningún cambio. Un
                      único área con dataKey de tupla no apila, así que respeta
                      el dominio ajustado. */}
                  <Area
                    type="linear"
                    dataKey={(d: PesoPoint) => [d.bandLow, d.bandHigh]}
                    stroke="none"
                    fill="var(--brio-move)"
                    fillOpacity={0.15}
                    name="Incertidumbre"
                    legendType="none"
                    tooltipType="none"
                  />
                  <Line
                    type="linear"
                    dataKey="goal"
                    name="Meta"
                    stroke="var(--brio-muted-fg)"
                    strokeWidth={1.5}
                    strokeDasharray="2 4"
                    dot={false}
                  />
                  <Line
                    type="linear"
                    dataKey="trend"
                    name="Tendencia"
                    stroke="var(--brio-move)"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={false}
                  />
                  <Line
                    type="linear"
                    dataKey="ma7"
                    name="Media 7d"
                    stroke="var(--brio-kcal)"
                    strokeWidth={2}
                    connectNulls={true}
                    dot={false}
                  />
                  <Line
                    type="linear"
                    dataKey="kg"
                    name="Real"
                    stroke="var(--brio-move)"
                    strokeWidth={2}
                    connectNulls={false}
                    dot={{ r: 3, fill: "var(--brio-move)" }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1 px-1 text-[11px] text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <span className={cn("h-0.5 w-3 rounded-full bg-[var(--brio-move)]")} />
                Real
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-0.5 w-3 rounded-full bg-[var(--brio-kcal)]" />
                Media 7d
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-3 border-t-2 border-dashed border-[var(--brio-move)]" />
                Tendencia
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-3 border-t border-dotted border-[var(--brio-muted-fg)]" />
                Meta
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-2 w-3 rounded-sm bg-[var(--brio-move)]/20" />
                Incertidumbre
              </li>
            </ul>
          </Card>
        </>
      ) : null}
    </>
  );
}
