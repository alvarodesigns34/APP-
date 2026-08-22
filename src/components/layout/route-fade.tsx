import type { ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";

export function RouteFade({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div key={pathname} className="animate-in fade-in duration-200 [animation-timing-function:var(--ease-entrance)]">
      {children}
    </div>
  );
}
