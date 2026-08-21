import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBrioStore } from "@/lib/brio/store";
import { parseNum } from "@/lib/brio/format";
import type { FoodBase, FoodUnit } from "@/lib/brio/types";
import { cn } from "@/lib/utils";

const FIELDS = [
  { key: "kcal", n: "kcal" },
  { key: "prot", n: "Proteína (g)" },
  { key: "carb", n: "Hidratos (g)" },
  { key: "fat", n: "Grasa (g)" },
  { key: "fib", n: "Fibra (g)" },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];

export function CustomFoodSheet({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: (id: string) => void;
}) {
  const addCustomFood = useBrioStore((s) => s.addCustomFood);
  const [name, setName] = useState("");
  const [base, setBase] = useState<FoodBase>("g");
  const [vals, setVals] = useState<Record<FieldKey, string>>({
    kcal: "",
    prot: "",
    carb: "",
    fat: "",
    fib: "",
  });
  const [unitName, setUnitName] = useState("");
  const [unitG, setUnitG] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setBase("g");
    setVals({ kcal: "", prot: "", carb: "", fat: "", fib: "" });
    setUnitName("");
    setUnitG("");
    setError(null);
  }, [open]);

  function setField(key: FieldKey, value: string) {
    setVals((prev) => ({ ...prev, [key]: value }));
  }

  function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Escribe un nombre.");
      return;
    }
    const nums: Record<FieldKey, number> = {
      kcal: parseNum(vals.kcal),
      prot: parseNum(vals.prot),
      carb: parseNum(vals.carb),
      fat: parseNum(vals.fat),
      fib: parseNum(vals.fib),
    };
    for (const key of FIELDS) {
      const n = nums[key.key];
      if (!Number.isFinite(n) || n < 0) {
        setError("Revisa las cantidades. Usa números iguales o mayores que 0.");
        return;
      }
    }
    const uName = unitName.trim();
    const uGrams = parseNum(unitG);
    const hasUnit = uName.length > 0 || String(unitG).trim().length > 0;
    if (hasUnit && (!uName || !Number.isFinite(uGrams) || uGrams <= 0)) {
      setError("Si indicas una unidad, pon un nombre y unos gramos mayores que 0.");
      return;
    }
    const units: FoodUnit[] = hasUnit ? [{ name: uName, g: uGrams }] : [];
    const id = addCustomFood({
      name: trimmed,
      kcal: nums.kcal,
      prot: nums.prot,
      carb: nums.carb,
      fat: nums.fat,
      fib: nums.fib,
      sug: null,
      sat: null,
      sod: null,
      units,
      base,
    });
    toast.success("Alimento guardado");
    onOpenChange(false);
    onSaved?.(id);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Crear alimento"
      footer={
        <Button className="w-full" onClick={save}>
          Guardar
        </Button>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="cf-name">
            Nombre
          </label>
          <Input
            id="cf-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Yogur de coco"
            autoComplete="off"
          />
        </div>
        <div>
          <p className="mb-1 text-sm font-medium">Base</p>
          <div className="flex gap-2">
            {(["g", "ml"] as const).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBase(b)}
                className={cn(
                  "min-h-11 min-w-11 flex-1 rounded-full text-sm font-medium",
                  base === b ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {b === "g" ? "Gramos" : "Mililitros"}
              </button>
            ))}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">Valores por 100 {base}.</p>
        <div className="grid grid-cols-2 gap-3">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label className="mb-1 block text-sm font-medium" htmlFor={`cf-${f.key}`}>
                {f.n}
              </label>
              <Input
                id={`cf-${f.key}`}
                inputMode="decimal"
                value={vals[f.key]}
                onChange={(e) => setField(f.key, e.target.value)}
                placeholder="0"
              />
            </div>
          ))}
        </div>
        <div>
          <p className="mb-1 text-sm font-medium">Unidad casera (opcional)</p>
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Nombre (taza, unidad…)" value={unitName} onChange={(e) => setUnitName(e.target.value)} />
            <Input
              inputMode="decimal"
              placeholder="Gramos por unidad"
              value={unitG}
              onChange={(e) => setUnitG(e.target.value)}
            />
          </div>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </Sheet>
  );
}
