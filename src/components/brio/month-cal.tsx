import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, dateOf, fmtMonthYear, monthGrid, monthStart, todayKey, WEEKDAYS } from "@/lib/brio/dates";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function heatBg(count: number): string {
  if (count >= 4) return "bg-primary";
  if (count >= 3) return "bg-primary/70";
  if (count > 0) return "bg-primary/30";
  return "bg-muted";
}

export function MonthCal({
  countFor,
  onSelect,
  today = todayKey(),
  open = true,
}: {
  countFor: (key: string) => number;
  onSelect: (key: string) => void;
  today?: string;
  open?: boolean;
}) {
  const [cursor, setCursor] = useState(() => monthStart(today));
  const wasOpen = useRef(open);
  useEffect(() => {
    if (open && !wasOpen.current) setCursor(monthStart(today));
    wasOpen.current = open;
  }, [open, today]);

  const d = dateOf(cursor);
  const cells = monthGrid(d.getFullYear(), d.getMonth());
  const thisMonth = monthStart(today);
  const canNext = cursor < thisMonth;

  return (
    <div className="mb-6" data-testid="month-cal">
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Calendario</p>
      <div className="mb-2 flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="size-9 p-0"
          aria-label="Mes anterior"
          onClick={() => setCursor((c) => addMonths(c, -1))}
        >
          <ChevronLeft className="size-5" />
        </Button>
        <div className="font-medium" data-testid="month-label">
          {fmtMonthYear(cursor)}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="size-9 p-0"
          aria-label="Mes siguiente"
          disabled={!canNext}
          onClick={() => canNext && setCursor((c) => addMonths(c, 1))}
        >
          <ChevronRight className="size-5" />
        </Button>
      </div>
      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center text-[11px] font-medium text-muted-foreground">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1" role="grid" aria-label="Calendario de cumplimiento">
        {cells.map((k, i) => {
          if (!k) return <div key={`e${i}`} className="aspect-square" aria-hidden />;
          const c = countFor(k);
          const isToday = k === today;
          const future = k > today;
          return (
            <button
              key={k}
              type="button"
              data-key={k}
              disabled={future}
              title={`${k}: ${c}/5`}
              aria-label={`${k}: ${c} de 5 objetivos`}
              aria-current={isToday ? "date" : undefined}
              className={cn(
                "aspect-square rounded-md text-[11px] tabular-nums",
                heatBg(c),
                c >= 3 ? "text-primary-foreground" : "text-foreground",
                isToday && "ring-2 ring-inset ring-foreground",
                future && "opacity-40",
              )}
              onClick={() => !future && onSelect(k)}
            >
              {Number(k.slice(8))}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">Toca un día para abrirlo en Hoy</p>
    </div>
  );
}
