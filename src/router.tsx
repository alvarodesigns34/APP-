import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";

export const router = createRouter({
  routeTree,
  defaultErrorComponent: AppErrorComponent,
  defaultPreload: "intent",
  // Matches Vite's `base` (vite.config.ts): "/" locally, "/APP-/" on GitHub
  // Pages. Without this, links and a page refresh under a subpath deploy
  // resolve against the wrong root.
  basepath: import.meta.env.BASE_URL,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
