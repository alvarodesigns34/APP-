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
import { Card, SectionLabel } from "@/components/brio/section";
import { nf } from "@/lib/brio/format";
import { cn } from "@/lib/utils";
import { fmtWeight, kgToDisplay, type UnitSystem } from "@/lib/brio/units";

export type DayPoint = {
  d: string;
  kcal: number;
  prot: number;
  water: number;
  move: number;
  steps: number;
  sleep: number;
};

export type PesoPoint = {
  label: string;
  kg: number | null;
  trend: number;
  goal: number;
  bandLow: number;
  bandHigh: number;
  bandSpan: number;
  ma7: number | null;
};

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
      <SectionLabel>Calorías</SectionLabel>
      <Card className="mb-3 h-48 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--brio-border)" />
            <XAxis dataKey="d" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} width={32} />
            <Tooltip formatter={(v) => [`${v} kcal`, "Calorías"]} />
            <Bar dataKey="kcal" fill="var(--brio-kcal)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <SectionLabel>Agua</SectionLabel>
      <Card className="mb-3 h-44 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis dataKey="d" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} width={36} />
            <Tooltip formatter={(v) => [`${v} ml`, "Agua"]} />
            <Bar dataKey="water" fill="var(--brio-water)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <SectionLabel>Sueño</SectionLabel>
      <Card className="mb-3 h-44 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="d" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} width={32} />
            <Tooltip formatter={(v) => [`${v} h`, "Sueño"]} />
            <Line type="monotone" dataKey="sleep" stroke="var(--brio-sleep)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <SectionLabel>Pasos</SectionLabel>
      <Card className="mb-3 h-44 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="d" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} width={32} />
            <Tooltip formatter={(v) => [`${v}`, "Pasos"]} />
            <Line type="monotone" dataKey="steps" stroke="var(--brio-steps)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

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
                  <Area
                    type="linear"
                    dataKey="bandLow"
                    stackId="band"
                    stroke="none"
                    fill="none"
                    legendType="none"
                    tooltipType="none"
                  />
                  <Area
                    type="linear"
                    dataKey="bandSpan"
                    stackId="band"
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
