import { useEffect, useState } from "react";
import { ensureCatalog, isCatalogReady } from "./catalog";

/** True once `ensureCatalog()` has filled the sync snapshot. */
export function useCatalog(): boolean {
  const [ready, setReady] = useState(isCatalogReady);
  useEffect(() => {
    if (ready) return;
    let live = true;
    void ensureCatalog().then(() => {
      if (live) setReady(true);
    });
    return () => {
      live = false;
    };
  }, [ready]);
  return ready;
}
