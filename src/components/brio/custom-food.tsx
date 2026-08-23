import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useBrioStore } from "@/lib/brio/store";
import { parseNum } from "@/lib/brio/format";
import { normalizeEan } from "@/lib/brio/barcode";
import type { Food, FoodBase, FoodUnit } from "@/lib/brio/types";
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
  onDeleted,
  initialName = "",
  barcode,
  edit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: (id: string) => void;
  /** Called after a delete, so a caller showing this food elsewhere can close too. */
  onDeleted?: () => void;
  initialName?: string;
  barcode?: string;
  /** A custom food to edit in place. Enables the delete button and switches Save to update. */
  edit?: Food;
}) {
  const addCustomFood = useBrioStore((s) => s.addCustomFood);
  const updateCustomFood = useBrioStore((s) => s.updateCustomFood);
  const removeCustomFood = useBrioStore((s) => s.removeCustomFood);
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const code = barcode ? normalizeEan(barcode) : "";

  useEffect(() => {
    if (!open) return;
    if (edit) {
      setName(edit.name);
      setBase(edit.base);
      setVals({
        kcal: String(edit.kcal),
        prot: String(edit.prot),
        carb: String(edit.carb),
        fat: String(edit.fat),
        fib: String(edit.fib),
      });
      const u = edit.units[0];
      setUnitName(u?.name ?? "");
      setUnitG(u ? String(u.g) : "");
    } else {
      setName(initialName);
      setBase("g");
      setVals({ kcal: "", prot: "", carb: "", fat: "", fib: "" });
      setUnitName("");
      setUnitG("");
    }
    setError(null);
    setConfirmDelete(false);
  }, [open, initialName, edit]);

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
    const patch = {
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
      ...(code ? { barcode: code } : {}),
    };
    if (edit) {
      updateCustomFood(edit.id, patch);
      toast.success("Alimento actualizado");
      onOpenChange(false);
      onSaved?.(edit.id);
      return;
    }
    const id = addCustomFood(patch);
    toast.success("Alimento guardado");
    onOpenChange(false);
    onSaved?.(id);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={edit ? "Editar alimento" : "Crear alimento"}
      footer={
        <div className="space-y-2">
          <Button className="w-full" onClick={save}>
            Guardar
          </Button>
          {edit ? (
            <Button variant="ghost" className="w-full text-destructive" onClick={() => setConfirmDelete(true)}>
              Borrar alimento
            </Button>
          ) : null}
        </div>
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
        {code ? (
          <p className="text-sm text-muted-foreground">
            Código de barras {code}. Completa los valores por 100 {base} para guardarlo.
          </p>
        ) : null}
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
            <Input
              placeholder="Nombre (taza, unidad…)"
              value={unitName}
              onChange={(e) => setUnitName(e.target.value)}
            />
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
      {edit ? (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={`¿Borrar ${edit.name}?`}
          body="Los registros ya guardados con este alimento no cambian; solo deja de estar disponible para añadirlo de nuevo."
          confirmLabel="Borrar"
          destructive
          onConfirm={() => {
            removeCustomFood(edit.id);
            toast.success("Alimento borrado");
            onOpenChange(false);
            onDeleted?.();
          }}
        />
      ) : null}
    </Sheet>
  );
}
