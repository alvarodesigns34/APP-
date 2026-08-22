import { cn } from "@/lib/utils";

/**
 * `overIsBad` decides what going past the goal means. Eating 20 % over your
 * calories is worth flagging; walking 20 % past your step goal is the point of
 * having one. The warning treatment used to apply to all three rings, and its
 * red is the same hue as the Ejercicio ring, so a good day looked like an error.
 */
export function Ring({
  r,
  pct,
  color,
  overIsBad = false,
}: {
  r: number;
  pct: number;
  color: string;
  overIsBad?: boolean;
}) {
  const c = 2 * Math.PI * r;
  // Math.max(0, NaN) is NaN, which would reach strokeDashoffset and make the
  // arc vanish rather than render empty. Treat a non-finite ratio as 0.
  const p = Number.isFinite(pct) ? Math.max(0, pct) : 0;
  const fill = Math.min(1, p);
  const extra = Math.max(0, Math.min(1, p - 1));
  const over = p > 1 && overIsBad;
  const surplus = p > 1 && !overIsBad;
  return (
    <g data-overflow={over ? "true" : "false"}>
      <circle
        cx="70"
        cy="70"
        r={r}
        fill="none"
        stroke={over ? `color-mix(in oklab, ${color} 60%, var(--brio-warn))` : color}
        data-surplus={surplus ? "true" : undefined}
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - fill)}
        transform="rotate(-90 70 70)"
        className="transition-[stroke-dashoffset] duration-500 [transition-timing-function:var(--ease-entrance)]"
      />
      {surplus ? (
        <circle
          data-surplus-arc=""
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke={`color-mix(in oklab, ${color} 55%, white)`}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - extra)}
          transform="rotate(-90 70 70)"
          className="transition-[stroke-dashoffset] duration-500 [transition-timing-function:var(--ease-entrance)]"
        />
      ) : null}
      {over ? (
        <circle
          data-overflow-arc=""
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke="var(--brio-bad)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - extra)}
          transform="rotate(-90 70 70)"
          className="transition-[stroke-dashoffset] duration-500 [transition-timing-function:var(--ease-entrance)]"
        />
      ) : null}
      {over ? (
        <line
          data-overflow-tick=""
          x1="70"
          y1={70 - r - 6}
          x2="70"
          y2={70 - r + 4}
          stroke="var(--brio-fg)"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      ) : null}
    </g>
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
      {/* Only calories are worth warning about when exceeded. */}
      <Ring r={58} pct={kcal} color="var(--brio-kcal)" overIsBad />
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
  // Same reason as Ring: "width: NaN%" is dropped by the browser, so the bar
  // would silently disappear instead of showing as empty.
  const w = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
  return (
    <div className={cn("overflow-hidden rounded-full bg-muted", compact ? "h-1.5" : "h-2")}>
      <div
        className="h-full rounded-full transition-[width] duration-500 [transition-timing-function:var(--ease-entrance)]"
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
