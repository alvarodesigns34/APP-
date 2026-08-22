import { Drawer } from "vaul";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { useSheetZ } from "./sheet-z";

export function Sheet({
  open,
  onOpenChange,
  title,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  // A fixed z-50 works for a single sheet, but several screens open a second
  // sheet (barcode scan, create custom food…) from inside one that's already
  // open — both would land on the same layer, and which ends up on top would
  // depend on portal mount order rather than which was actually opened last.
  const z = useSheetZ(open);

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <Drawer.Portal>
        <Drawer.Overlay
          style={{ zIndex: z }}
          className="fixed inset-0 bg-foreground/35 duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in data-[state=closed]:fade-out"
        />
        <Drawer.Content
          style={{ zIndex: z + 1 }}
          className={cn(
            "fixed inset-x-0 bottom-0 mx-auto flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-3xl bg-card text-card-foreground shadow-raised",
          )}
        >
          <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-muted" />
          <Drawer.Title className="px-5 pb-2 pt-4 font-display text-xl tracking-tight">{title}</Drawer.Title>
          <Drawer.Description className="sr-only">{title}</Drawer.Description>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {children}
          </div>
          {footer ? (
            <div className="border-t border-border px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {footer}
            </div>
          ) : null}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
