import { useLayoutEffect, useState } from "react";

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
  // `useLayoutEffect` y no `useEffect`: la capa se reclama antes de que el
  // navegador pinte. Con el efecto normal, el primer fotograma de una hoja
  // recién abierta salía con el 50 inicial —por debajo del 70 de la hoja que ya
  // estaba abierta— y solo subía en el render siguiente, así que un diálogo de
  // confirmación abierto desde dentro de una hoja parpadeaba bajo su propio
  // velo antes de colocarse. Los tests no lo veían: `act()` vacía los efectos
  // de forma síncrona y nunca llega a haber un fotograma intermedio.
  useLayoutEffect(() => {
    if (open) {
      nextSheetZ += 20;
      setZ(nextSheetZ);
    }
  }, [open]);
  return z;
}
