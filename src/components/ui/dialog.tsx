import * as Alert from "@radix-ui/react-alert-dialog";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSheetZ } from "@/components/ui/sheet-z";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel = "Confirmar",
  destructive,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  // A confirm dialog is routinely opened from inside a Sheet nested two or
  // three deep (food ficha → editar → borrar), and each of those already
  // claims a z-index past 50 via the same counter (see sheet.tsx). A static
  // z-50 here used to render the dialog *under* those sheets' own overlays —
  // visible, but every click on its buttons landed on the invisible overlay
  // above it instead. Sharing the counter puts this dialog back on top,
  // however deep the sheet stack is.
  const z = useSheetZ(open);
  return (
    <Alert.Root open={open} onOpenChange={onOpenChange}>
      <Alert.Portal>
        <Alert.Overlay
          style={{ zIndex: z }}
          className="fixed inset-0 bg-foreground/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in data-[state=closed]:fade-out duration-200"
        />
        <Alert.Content
          style={{ zIndex: z + 1 }}
          className="fixed left-1/2 top-1/2 w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-card p-5 text-card-foreground shadow-raised duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in data-[state=closed]:fade-out data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-1/2 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-1/2">
          <Alert.Title className="font-display text-xl tracking-tight">{title}</Alert.Title>
          <Alert.Description className="mt-2 text-sm text-muted-foreground">{body}</Alert.Description>
          <div className="mt-5 flex gap-2">
            <Alert.Cancel asChild>
              <Button variant="secondary" className="flex-1">
                Cancelar
              </Button>
            </Alert.Cancel>
            <Alert.Action asChild>
              <Button
                className={cn("flex-1", destructive && "bg-destructive text-primary-foreground")}
                variant={destructive ? "destructive" : "default"}
                onClick={onConfirm}
              >
                {confirmLabel}
              </Button>
            </Alert.Action>
          </div>
        </Alert.Content>
      </Alert.Portal>
    </Alert.Root>
  );
}
