import { createRootRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { RouteFade } from "@/components/layout/route-fade";

export const Route = createRootRoute({
  component: Root,
});

function Root() {
  return (
    <AppShell>
      <RouteFade>
        <Outlet />
      </RouteFade>
    </AppShell>
  );
}
