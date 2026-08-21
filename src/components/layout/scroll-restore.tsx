import { useEffect, useLayoutEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";

/** Last `window.scrollY` per pathname. Module-level so AppShell remounts keep it. */
const scrollPositions = new Map<string, number>();

/**
 * Restores document scroll after the new route paints.
 * RouteFade remounts children with `key={pathname}` — we wait a frame so height exists.
 */
export function ScrollRestore() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const pathRef = useRef(pathname);
  const restoringRef = useRef(false);

  useEffect(() => {
    const onScroll = () => {
      if (restoringRef.current) return;
      scrollPositions.set(pathRef.current, window.scrollY);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      onScroll();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useLayoutEffect(() => {
    restoringRef.current = true;
    pathRef.current = pathname;
    const y = scrollPositions.get(pathname) ?? 0;
    const id = requestAnimationFrame(() => {
      window.scrollTo(0, y);
      restoringRef.current = false;
    });
    return () => {
      cancelAnimationFrame(id);
      restoringRef.current = false;
    };
  }, [pathname]);

  return null;
}
