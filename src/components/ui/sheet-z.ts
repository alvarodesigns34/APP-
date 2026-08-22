import { useEffect, useState } from "react";

/**
 * Each open sheet claims the next tier off a shared, ever-increasing counter
 * the moment it opens, so whichever sheet opened most recently always renders
 * above the rest — regardless of DOM/portal mount order or where either sits
 * in the component tree. See sheet.tsx for how the overlay/content z-indices
 * are derived from the value this returns.
 */
let nextSheetZ = 50;

export function useSheetZ(open: boolean): number {
  const [z, setZ] = useState(50);
  useEffect(() => {
    if (open) {
      nextSheetZ += 20;
      setZ(nextSheetZ);
    }
  }, [open]);
  return z;
}
