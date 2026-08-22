import { useCallback, useEffect, useSyncExternalStore } from "react";
import { ensureCatalog, getCatalogStatus, retryCatalog, subscribeCatalog, type CatalogStatus } from "./catalog";

export type CatalogState = {
  status: CatalogStatus;
  /** Snapshot is filled and safe to read synchronously. */
  ready: boolean;
  /** The fetch failed; the screen should offer `retry`. */
  failed: boolean;
  retry: () => void;
};

/**
 * Loads the builtin catalog on first use and reports progress.
 *
 * Status is module-level, so every screen agrees and a retry from one clears the
 * error in all of them. A rejected fetch settles on `error` (never an unhandled
 * rejection) and stays retryable.
 */
export function useCatalog(): CatalogState {
  const status = useSyncExternalStore(subscribeCatalog, getCatalogStatus, getCatalogStatus);

  useEffect(() => {
    if (status !== "idle") return;
    void ensureCatalog().catch(() => {
      /* surfaced as status "error" */
    });
  }, [status]);

  const retry = useCallback(() => {
    void retryCatalog().catch(() => {
      /* surfaced as status "error" */
    });
  }, []);

  return {
    status,
    ready: status === "ready",
    failed: status === "error",
    retry,
  };
}
