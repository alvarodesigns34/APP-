import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    // BASE_URL is "/" locally and "/APP-/" on GitHub Pages; a hardcoded
    // "/sw.js" would 404 under the Pages subpath.
    const base = import.meta.env.BASE_URL;
    // Without this a returning visitor keeps whatever the installed worker
    // cached until they happen to close every tab, so a shipped fix can look
    // like it never landed. The worker calls skipWaiting(), so a new version
    // takes over as soon as it installs; reload once at that hand-over so the
    // page runs the code the new worker serves.
    //
    // `controlled` has to be updated as we go, not sampled once: on a first
    // visit the page starts uncontrolled, and clients.claim() fires an initial
    // controllerchange that must NOT reload. Sampling once would leave the flag
    // false for the page's whole life and a later update would never reload.
    // `reloaded` keeps the reload one-shot.
    let controlled = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!controlled) {
        controlled = true;
        return;
      }
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });

    navigator.serviceWorker
      // updateViaCache: "none" so the worker script itself is always revalidated
      // against the network; a cached sw.js is how an update goes unnoticed.
      .register(`${base}sw.js`, { scope: base, updateViaCache: "none" })
      .then((reg) => {
        // Check now and whenever the tab is refocused, so a long-lived tab does
        // not sit on stale code for days.
        void reg.update().catch(() => {});
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") void reg.update().catch(() => {});
        });
      })
      .catch(() => {
        /* offline register can fail on first visit */
      });
  });
}
