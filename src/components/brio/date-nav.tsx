import { memo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, canPlanFurther, fmtDateRelative, todayKey } from "@/lib/brio/dates";
import { useBrioStore } from "@/lib/brio/store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const DateNav = memo(function DateNav({ subtitle }: { subtitle?: string }) {
  const viewDate = useBrioStore((s) => s.viewDate);
  const setViewDate = useBrioStore((s) => s.setViewDate);
  const key = viewDate || todayKey();
  const atMax = !canPlanFurther(key, todayKey());
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Día anterior"
        onClick={() => setViewDate(addDays(key, -1))}
      >
        <ChevronLeft className="size-5" />
      </Button>
      <div className="text-center">
        <div className="font-medium">{fmtDateRelative(key)}</div>
        {subtitle ? <div className="text-xs text-muted-foreground">{subtitle}</div> : null}
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Día siguiente"
        title={atMax ? "No se puede planificar más de una semana por delante" : "Día siguiente"}
        disabled={atMax}
        className={cn(atMax && "bg-muted text-muted-foreground disabled:opacity-30")}
        onClick={() => !atMax && setViewDate(addDays(key, 1))}
      >
        <ChevronRight className="size-5" />
      </Button>
    </div>
  );
});
