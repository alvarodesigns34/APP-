import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, fmtDateRelative, todayKey } from "@/lib/brio/dates";
import { useBrioStore } from "@/lib/brio/store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DateNav({ subtitle }: { subtitle?: string }) {
  const s = useBrioStore();
  const viewDate = s.viewDate || todayKey();
  const isToday = viewDate === todayKey();
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Día anterior"
        onClick={() => s.setViewDate(addDays(viewDate, -1))}
      >
        <ChevronLeft className="size-5" />
      </Button>
      <div className="text-center">
        <div className="font-medium">{fmtDateRelative(viewDate)}</div>
        {subtitle ? <div className="text-xs text-muted-foreground">{subtitle}</div> : null}
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Día siguiente"
        title={isToday ? "Ya estás en hoy" : "Día siguiente"}
        disabled={isToday}
        className={cn(
          isToday && "bg-muted text-muted-foreground disabled:opacity-30",
        )}
        onClick={() => !isToday && s.setViewDate(addDays(viewDate, 1))}
      >
        <ChevronRight className="size-5" />
      </Button>
    </div>
  );
}
