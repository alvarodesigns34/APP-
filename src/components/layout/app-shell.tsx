import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Activity, Home, Settings2, TrendingUp, Utensils } from "lucide-react";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { useBrioStore } from "@/lib/brio/store";
import { todayKey } from "@/lib/brio/dates";
import { emitQuickLog, isTypingTarget, resolveHotkey } from "@/lib/brio/hotkeys";
import { bootShortcut } from "@/lib/brio/shortcut-search";
import { HoySkeleton } from "@/components/brio/hoy-skeleton";
import { Onboarding } from "@/components/brio/onboarding";
import { RemindersBoot } from "@/components/brio/reminders-boot";
import { ScrollRestore } from "@/components/layout/scroll-restore";
import { Button } from "@/components/ui/button";

const TABS = [
  { to: "/", n: "Hoy", icon: Home },
  { to: "/comida", n: "Comida", icon: Utensils },
  { to: "/actividad", n: "Actividad", icon: Activity },
  { to: "/tendencias", n: "Tendencias", icon: TrendingUp },
  { to: "/ajustes", n: "Ajustes", icon: Settings2 },
] as const;

type TabTo = (typeof TABS)[number]["to"];

function applyTheme(pref: "auto" | "light" | "dark") {
  const dark = pref === "dark" || (pref === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

function HotkeyHelp({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      onOpenChange(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
      onClick={() => onOpenChange(false)}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="hotkey-help-title"
        className="w-[min(22rem,calc(100vw-2rem))] rounded-3xl bg-card p-5 text-card-foreground shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="hotkey-help-title" className="font-display text-xl tracking-tight">
          Atajos de teclado
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>1 Hoy · 2 Comida · 3 Actividad · 4 Tendencias · 5 Ajustes</li>
          <li>N Registrar comida</li>
          <li>Ctrl+Z Deshacer</li>
          <li>? Esta ayuda</li>
        </ul>
        <Button className="mt-5 w-full" onClick={() => onOpenChange(false)}>
          Entendido
        </Button>
      </div>
    </div>
  );
}

function Hotkeys() {
  const undoLast = useBrioStore((s) => s.undoLast);
  const navigate = useNavigate();
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const action = resolveHotkey(e, isTypingTarget(e.target));
      if (!action) return;
      e.preventDefault();
      if (action.type === "undo") {
        setHelpOpen(false);
        undoLast();
      } else if (action.type === "tab") {
        setHelpOpen(false);
        navigate({ to: action.to as TabTo });
      } else if (action.type === "quick") {
        setHelpOpen(false);
        emitQuickLog(action.kind);
      } else {
        setHelpOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undoLast, navigate]);

  return <HotkeyHelp open={helpOpen} onOpenChange={setHelpOpen} />;
}

function ShortcutBoot() {
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === "undefined") return;
    void bootShortcut({
      search: window.location.search,
      pathname: window.location.pathname,
      hash: window.location.hash,
      navigate: (to) => navigate({ to }),
      emit: emitQuickLog,
      replaceUrl: (url) => window.history.replaceState(window.history.state, "", url),
    });
  }, [navigate]);

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
    return <HoySkeleton />;
  }

  if (!onboarded) {
    return (
      <div className="min-h-dvh bg-background text-foreground">
        <Onboarding />
        <Hotkeys />
        <Toaster position="top-center" richColors />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto min-h-dvh max-w-md border-border md:border-x">
        <main className="pb-24 pt-[max(0.5rem,env(safe-area-inset-top))]">{children}</main>
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
                    resetScroll={false}
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
      <ScrollRestore />
      <Hotkeys />
      <ShortcutBoot />
      <RemindersBoot />
      <Toaster position="top-center" richColors />
    </div>
  );
}
