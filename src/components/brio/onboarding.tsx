import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Rings } from "@/components/brio/rings";
import { ACTIVITY_FACTORS, PURPOSES, computeGoals } from "@/lib/brio/domain";
import { useBrioStore } from "@/lib/brio/store";
import { nf, parseNum, ageFrom } from "@/lib/brio/format";
import { todayKey } from "@/lib/brio/dates";
import type { ActivityId, PurposeId, Sex } from "@/lib/brio/types";
import { APP_NAME } from "@/lib/brio/types";
import { cn } from "@/lib/utils";

type Draft = {
  name: string;
  sex: Sex;
  birth: string;
  height: string;
  weight: string;
  activity: ActivityId;
  purpose: PurposeId;
};

export function Onboarding() {
  const complete = useBrioStore((s) => s.completeOnboarding);
  const skip = useBrioStore((s) => s.skipOnboarding);
  const [step, setStep] = useState(0);
  const [err, setErr] = useState("");
  const [draft, setDraft] = useState<Draft>({
    name: "",
    sex: "h",
    birth: "",
    height: "175",
    weight: "70",
    activity: "lig",
    purpose: "mantener",
  });

  const computed = useMemo(() => {
    const h = parseNum(draft.height);
    const w = parseNum(draft.weight);
    if (!h || !w) return null;
    return computeGoals({
      sex: draft.sex,
      birth: draft.birth || "1995-01-01",
      height: h,
      weight: w,
      activity: draft.activity,
      purpose: draft.purpose,
    });
  }, [draft]);

  function finish() {
    const h = parseNum(draft.height) || 175;
    const w = parseNum(draft.weight) || 70;
    const g = computed ?? computeGoals({
      sex: draft.sex,
      birth: draft.birth || "1995-01-01",
      height: h,
      weight: w,
      activity: draft.activity,
      purpose: draft.purpose,
    });
    complete({
      profile: {
        name: draft.name.trim(),
        sex: draft.sex,
        birth: draft.birth,
        height: Math.round(h),
        weight: Math.round(w * 10) / 10,
        activity: draft.activity,
        purpose: draft.purpose,
      },
      goals: {
        // Always the computed target: the only caller confirms the plan it was
        // just shown. A literal 2200 here would have left prot/carb/fat as the
        // macros for a different kcal total.
        kcal: g.kcal,
        prot: g.prot,
        carb: g.carb,
        fat: g.fat,
        steps: g.steps,
        water: g.water,
        sleep: g.sleep,
        weight: g.weight,
        activityMin: g.activityMin,
      },
    });
  }

  function next() {
    setErr("");
    if (step === 1) {
      if (!draft.birth || draft.birth > todayKey()) {
        setErr("Introduce una fecha de nacimiento válida.");
        return;
      }
      const age = ageFrom(draft.birth);
      if (age < 10 || age > 110) {
        setErr("La fecha debe corresponder a una edad entre 10 y 110 años.");
        return;
      }
    }
    if (step === 2) {
      const h = parseNum(draft.height);
      const w = parseNum(draft.weight);
      if (isNaN(h) || h < 100 || h > 250) {
        setErr("La altura debe estar entre 100 y 250 cm.");
        return;
      }
      if (isNaN(w) || w < 20 || w > 400) {
        setErr("El peso debe estar entre 20 y 400 kg.");
        return;
      }
    }
    if (step === 4) {
      finish();
      return;
    }
    setStep((s) => s + 1);
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 py-8">
        <div className="mb-6 flex gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <i key={i} className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
          ))}
        </div>
        <div className="flex-1">
          {step === 0 && (
            <div className="flex flex-col items-center pt-3 text-center">
              <Rings kcal={0.72} steps={0.55} move={0.4} size={132} />
              <h1 className="mt-5 font-display text-3xl">{APP_NAME}</h1>
              <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                Nutrición, movimiento, agua y sueño. En tu dispositivo, sin cuentas.
              </p>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-display text-2xl">Sobre ti</h2>
              <label className="block text-sm font-medium">Nombre</label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Cómo te llamas" />
              <label className="block text-sm font-medium">Fecha de nacimiento</label>
              <Input type="date" value={draft.birth} onChange={(e) => setDraft({ ...draft, birth: e.target.value })} />
              <label className="block text-sm font-medium">Sexo</label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["h", "Hombre"],
                    ["m", "Mujer"],
                    ["nb", "Otro"],
                  ] as const
                ).map(([id, n]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setDraft({ ...draft, sex: id })}
                    className={cn(
                      "h-11 rounded-xl border text-sm",
                      draft.sex === id ? "border-primary bg-primary/10 text-primary" : "border-border bg-card",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-display text-2xl">Medidas</h2>
              <label className="block text-sm font-medium">Altura (cm)</label>
              <Input inputMode="decimal" value={draft.height} onChange={(e) => setDraft({ ...draft, height: e.target.value })} />
              <label className="block text-sm font-medium">Peso (kg)</label>
              <Input inputMode="decimal" value={draft.weight} onChange={(e) => setDraft({ ...draft, weight: e.target.value })} />
            </div>
          )}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="font-display text-2xl">Ritmo y objetivo</h2>
              <p className="text-sm text-muted-foreground">Actividad habitual</p>
              <div className="space-y-2">
                {ACTIVITY_FACTORS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setDraft({ ...draft, activity: a.id })}
                    className={cn(
                      "w-full rounded-2xl border px-4 py-3 text-left",
                      draft.activity === a.id ? "border-primary bg-primary/10" : "border-border bg-card",
                    )}
                  >
                    <div className="font-medium">{a.n}</div>
                    <div className="text-xs text-muted-foreground">{a.d}</div>
                  </button>
                ))}
              </div>
              <p className="pt-2 text-sm text-muted-foreground">Qué buscas</p>
              <div className="grid grid-cols-2 gap-2">
                {PURPOSES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setDraft({ ...draft, purpose: p.id })}
                    className={cn(
                      "h-12 rounded-xl border text-sm",
                      draft.purpose === p.id ? "border-primary bg-primary/10 text-primary" : "border-border bg-card",
                    )}
                  >
                    {p.n}
                  </button>
                ))}
              </div>
            </div>
          )}
          {step === 4 && computed && (
            <div className="space-y-4">
              <h2 className="font-display text-2xl">Tu plan</h2>
              <p className="text-sm text-muted-foreground">
                Cálculo orientativo. Puedes cambiarlo luego en Ajustes.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Stat n={nf(computed.kcal)} l="kcal" />
                <Stat n={`${nf(computed.prot)} g`} l="Proteínas" />
                <Stat n={`${nf(computed.carb)} g`} l="Hidratos" />
                <Stat n={`${nf(computed.fat)} g`} l="Grasas" />
                <Stat n={nf(computed.steps)} l="Pasos" />
                <Stat n={`${nf(computed.water)} ml`} l="Agua" />
              </div>
              {computed.floored ? (
                <p className="text-sm text-muted-foreground">
                  El cálculo daba {nf(computed.raw)} kcal; se ha ajustado al suelo de {nf(computed.floor)} kcal.
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                {APP_NAME} no sustituye el consejo de un profesional sanitario.
              </p>
            </div>
          )}
          {err ? <p className="mt-4 text-sm text-destructive">{err}</p> : null}
        </div>
        <div className="mt-6 flex flex-col gap-2 pb-[env(safe-area-inset-bottom)]">
          <Button className="w-full" onClick={next}>
            {step === 4 ? "Empezar" : "Continuar"}
          </Button>
          {step === 0 ? (
            <Button variant="ghost" className="w-full" onClick={() => skip()}>
              Omitir
            </Button>
          ) : (
            <Button variant="secondary" className="w-full" onClick={() => setStep((s) => Math.max(0, s - 1))}>
              Atrás
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div className="rounded-2xl bg-card p-3">
      <div className="font-display text-2xl tabular-nums">{n}</div>
      <div className="text-xs text-muted-foreground">{l}</div>
    </div>
  );
}
