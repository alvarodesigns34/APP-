import * as Alert from "@radix-ui/react-alert-dialog";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
  return (
    <Alert.Root open={open} onOpenChange={onOpenChange}>
      <Alert.Portal>
        <Alert.Overlay className="fixed inset-0 z-50 bg-foreground/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in data-[state=closed]:fade-out duration-200" />
        <Alert.Content className="fixed left-1/2 top-1/2 z-50 w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-card p-5 text-card-foreground shadow-raised duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in data-[state=closed]:fade-out data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-1/2 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-1/2">
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
