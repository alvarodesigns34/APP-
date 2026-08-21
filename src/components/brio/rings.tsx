import { cn } from "@/lib/utils";

function Ring({
  r,
  pct,
  color,
}: {
  r: number;
  pct: number;
  color: string;
}) {
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1.05, pct));
  return (
    <circle
      cx="70"
      cy="70"
      r={r}
      fill="none"
      stroke={color}
      strokeWidth="9"
      strokeLinecap="round"
      strokeDasharray={c}
      strokeDashoffset={c * (1 - Math.min(1, p))}
      transform="rotate(-90 70 70)"
      className="transition-[stroke-dashoffset] duration-500 ease-out"
    />
  );
}

export function Rings({
  kcal,
  steps,
  move,
  size = 148,
}: {
  kcal: number;
  steps: number;
  move: number;
  size?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 140 140" aria-hidden className="shrink-0">
      <circle cx="70" cy="70" r="58" fill="none" stroke="var(--brio-muted)" strokeWidth="9" />
      <circle cx="70" cy="70" r="46" fill="none" stroke="var(--brio-muted)" strokeWidth="9" />
      <circle cx="70" cy="70" r="34" fill="none" stroke="var(--brio-muted)" strokeWidth="9" />
      <Ring r={58} pct={kcal} color="var(--brio-kcal)" />
      <Ring r={46} pct={steps} color="var(--brio-steps)" />
      <Ring r={34} pct={move} color="var(--brio-move)" />
    </svg>
  );
}

export function LegendRow({
  label,
  value,
  hint,
  color,
}: {
  label: string;
  value: string;
  hint: string;
  color: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <i className={cn("size-2 rounded-full")} style={{ background: color }} />
        {label}
      </span>
      <span className="tabular-nums text-sm">
        <b className="font-medium text-foreground">{value}</b>{" "}
        <span className="text-muted-foreground">{hint}</span>
      </span>
    </div>
  );
}

export function Bar({ pct, color, compact }: { pct: number; color: string; compact?: boolean }) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <div className={cn("overflow-hidden rounded-full bg-muted", compact ? "h-1.5" : "h-2")}>
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${w}%`, background: color }}
      />
    </div>
  );
}

export function LabeledBar({
  label,
  value,
  hint,
  pct,
  color,
}: {
  label: string;
  value: string;
  hint?: string;
  pct: number;
  color: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">
          <span className="font-medium text-foreground">{value}</span>
          {hint ? <span className="text-muted-foreground"> {hint}</span> : null}
        </span>
      </div>
      <Bar pct={pct} color={color} compact />
    </div>
  );
}
