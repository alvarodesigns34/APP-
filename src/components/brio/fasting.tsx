import { Timer } from "lucide-react";
import { Card, SectionLabel } from "@/components/brio/section";
import { minutesToClock, minutesToHM } from "@/lib/brio/dates";
import { fastingStatus } from "@/lib/brio/selectors";
import { useBrioStore } from "@/lib/brio/store";
import { cn } from "@/lib/utils";

export function FastingCard() {
  const fasting = useBrioStore((s) => s.settings.fasting);
  const fastingStart = useBrioStore((s) => s.settings.fastingStart);
  const status = fastingStatus(fasting, undefined, fastingStart);
  if (!status) return null;

  return (
    <>
      <SectionLabel>Ayuno {status.label}</SectionLabel>
      <Card>
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "grid size-11 place-items-center rounded-2xl",
              status.eating ? "bg-primary/10 text-primary" : "bg-sleep/15 text-sleep",
            )}
          >
            <Timer className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium">
              {status.eating ? "Ventana de comida" : "En ayuno"}
            </div>
            <p className="text-sm text-muted-foreground">
              {status.eating
                ? `Cierra a las ${minutesToClock(status.end)} · quedan ${minutesToHM(status.remaining)}`
                : `Abre a las ${minutesToClock(status.start)} · ${minutesToHM(status.elapsed)} de ayuno`}
            </p>
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full", status.eating ? "bg-primary" : "bg-sleep")}
            style={{ width: `${Math.round(status.progress * 100)}%` }}
          />
        </div>
      </Card>
    </>
  );
}
