import { useEffect, useLayoutEffect, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Activity, Home, Settings2, TrendingUp, Utensils } from "lucide-react";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { useBrioStore } from "@/lib/brio/store";
import { todayKey } from "@/lib/brio/dates";
import { Onboarding } from "@/components/brio/onboarding";

const TABS = [
  { to: "/", n: "Hoy", icon: Home },
  { to: "/comida", n: "Comida", icon: Utensils },
  { to: "/actividad", n: "Actividad", icon: Activity },
  { to: "/tendencias", n: "Tendencias", icon: TrendingUp },
  { to: "/ajustes", n: "Ajustes", icon: Settings2 },
] as const;

function applyTheme(pref: "auto" | "light" | "dark") {
  const dark =
    pref === "dark" || (pref === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function UndoHotkey() {
  const undoLast = useBrioStore((s) => s.undoLast);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
      if (e.key !== "z" && e.key !== "Z") return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      undoLast();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undoLast]);

  return null;
}

export function AppShell({ children }: { children: ReactNode }) {
  const hydrate = useBrioStore((s) => s.hydrate);
  const hydrated = useBrioStore((s) => s.hydrated);
  const onboarded = useBrioStore((s) => s.onboarded);
  const theme = useBrioStore((s) => s.settings.theme);
  const setViewDate = useBrioStore((s) => s.setViewDate);
  const viewDate = useBrioStore((s) => s.viewDate);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useLayoutEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    if (!viewDate) setViewDate(todayKey());
  }, [hydrated, viewDate, setViewDate]);

  useEffect(() => {
    if (!hydrated) return;
    applyTheme(theme);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme(theme);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [hydrated, theme]);

  if (!hydrated) {
    return <div className="min-h-dvh bg-background" aria-busy="true" />;
  }

  if (!onboarded) {
    return (
      <div className="min-h-dvh bg-background text-foreground">
        <Onboarding />
        <UndoHotkey />
        <Toaster position="top-center" richColors />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col border-border md:border-x">
        <main className="min-h-0 flex-1 overflow-y-auto pb-24 pt-[max(0.5rem,env(safe-area-inset-top))]">
          {children}
        </main>
        <nav
          className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur"
          aria-label="Secciones"
        >
          <ul className="grid grid-cols-5">
            {TABS.map((t) => {
              const active = t.to === "/" ? pathname === "/" : pathname.startsWith(t.to);
              const Icon = t.icon;
              return (
                <li key={t.to}>
                  <Link
                    to={t.to}
                    className={cn(
                      "flex flex-col items-center gap-1 py-2 text-[11px] font-medium",
                      active ? "text-primary" : "text-muted-foreground",
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} />
                    {t.n}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
      <UndoHotkey />
      <Toaster position="top-center" richColors />
    </div>
  );
}
