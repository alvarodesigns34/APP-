import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Screen({ children }: { children: ReactNode }) {
  return <div className="px-4 pb-6">{children}</div>;
}

export function Title({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <header className="mb-4">
      <h1 className="font-display text-3xl font-medium tracking-tight">{children}</h1>
      {sub ? <p className="mt-1 text-sm text-muted-foreground">{sub}</p> : null}
    </header>
  );
}

export function Card({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  const cls = cn("rounded-3xl bg-card p-4 shadow-card", className);
  if (onClick) {
    return (
      <button type="button" className={cn(cls, "w-full text-left")} onClick={onClick}>
        {children}
      </button>
    );
  }
  return <div className={cls}>{children}</div>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="mb-2 mt-6 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">{children}</h2>;
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl bg-card px-5 py-8 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
