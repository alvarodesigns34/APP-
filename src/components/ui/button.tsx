import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition-transform duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:opacity-90",
        secondary: "bg-muted text-foreground hover:bg-muted/80",
        ghost: "hover:bg-muted text-foreground",
        outline: "border border-border bg-card hover:bg-muted",
        destructive: "bg-destructive text-primary-foreground hover:opacity-90",
      },
      size: {
        default: "h-11 px-4",
        // 40px rather than 36px: these chips sit in wrap rows, so the height has
        // to be real (an invisible overlay would steal taps from the neighbour
        // chip). Full-width rows that can afford it use min-h-11 directly.
        sm: "h-10 px-3 text-xs",
        lg: "h-12 px-5",
        icon: "size-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
