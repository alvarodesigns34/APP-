import { useEffect, useMemo, useRef, useState } from "react";
import { Info, Plus, ScanBarcode, Star, X } from "lucide-react";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CustomFoodSheet } from "@/components/brio/custom-food";
import { FoodDetailSheet } from "@/components/brio/food-detail";
import { CATEGORIES, MEALS, type Food, type MealEntry, type MealId } from "@/lib/brio/types";
import { getFood } from "@/lib/brio/catalog";
import { buildFoodLogList } from "@/lib/brio/food-log-list";
import { useCatalog } from "@/lib/brio/use-catalog";
import { CatalogNotice } from "@/components/brio/catalog-state";
import { HighlightText } from "@/components/brio/highlight-text";
import { useBrioStore } from "@/lib/brio/store";
import { habitualFoodIds } from "@/lib/brio/selectors";
import { loadSearchPrefs, rememberQuery, saveSearchPrefs } from "@/lib/brio/search-prefs";
import { nf, parseNum, round } from "@/lib/brio/format";
import {
  createBarcodeDetector,
  detectBarcodeFromImage,
  fetchOffProduct,
  findFoodByBarcode,
  foodDraftHasMacros,
  hasBarcodeDetector,
  isValidEan,
  mapOffProduct,
  normalizeEan,
  pickDetectedCode,
} from "@/lib/brio/barcode";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "buscar", n: "Buscar" },
  { id: "recientes", n: "Recientes" },
  { id: "favoritos", n: "Favoritos" },
  { id: "habituales", n: "Habituales" },
] as const;

export function FoodLogSheet({
  open,
  onOpenChange,
  date,
  defaultMeal = "comida",
  edit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  date: string;
  defaultMeal?: MealId;
  edit?: { meal: MealId; entry: MealEntry } | null;
}) {
  const recents = useBrioStore((s) => s.recents);
  const favorites = useBrioStore((s) => s.favorites);
  const customFoods = useBrioStore((s) => s.customFoods);
  const recipes = useBrioStore((s) => s.recipes);
  const addMeal = useBrioStore((s) => s.addMeal);
  const updateMeal = useBrioStore((s) => s.updateMeal);
  const toggleFavorite = useBrioStore((s) => s.toggleFavorite);
  const addCustomFood = useBrioStore((s) => s.addCustomFood);
  const days = useBrioStore((s) => s.days);
  const catalog = useCatalog();
  const catalogReady = catalog.ready;

  const habitual = useMemo(() => habitualFoodIds({ ...useBrioStore.getState(), recents, days }), [recents, days]);

  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("buscar");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [queries, setQueries] = useState<string[]>([]);
  const [meal, setMeal] = useState<MealId>(defaultMeal);
  const [picked, setPicked] = useState<Food | null>(null);
  const [grams, setGrams] = useState("100");
  const [qty, setQty] = useState("1");
  const [unitName, setUnitName] = useState("g");
  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<{ name: string; barcode: string } | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [detailFood, setDetailFood] = useState<Food | null>(null);
  const prefsRef = useRef({ queries, cat });
  prefsRef.current = { queries, cat };

  const editing = !!edit;

  useEffect(() => {
    if (!open) {
      setPicked(null);
      setQ("");
      setCreateOpen(false);
      setCreateDraft(null);
      setScanOpen(false);
      setDetailFood(null);
      return;
    }
    setMeal(edit?.meal ?? defaultMeal);
    const prefs = loadSearchPrefs();
    prefsRef.current = prefs;
    setQueries(prefs.queries);
    setCat(prefs.cat);
    if (edit) {
      const food = getFood(edit.entry.foodId, {
        customFoods: useBrioStore.getState().customFoods,
        recipes: useBrioStore.getState().recipes,
      });
      setPicked(food ?? null);
      setQty(String(edit.entry.qty));
      setGrams(String(edit.entry.grams));
      setUnitName(edit.entry.unitName);
    } else {
      setPicked(null);
      setQty("1");
      setGrams("100");
      setUnitName("g");
    }
  }, [open, edit, defaultMeal, catalogReady]);

  const list = useMemo(
    () =>
      buildFoodLogList({
        picked,
        editing: !!editing,
        tab,
        q,
        cat,
        recents,
        favorites,
        habitual,
        customFoods,
        recipes,
      }),
    [tab, q, cat, recents, favorites, habitual, customFoods, recipes, picked, editing],
  );

  const unitG = useMemo(() => {
    if (!picked) {
      const qn = parseNum(qty);
      const gn = parseNum(grams);
      return qn > 0 && gn > 0 ? gn / qn : 1;
    }
    const match = picked.units.find((u) => u.name === unitName);
    if (match) return match.g;
    if (unitName === picked.base) return 1;
    const qn = parseNum(qty);
    const gn = parseNum(grams);
    return qn > 0 && gn > 0 ? gn / qn : 1;
  }, [picked, unitName, qty, grams]);

  function applyQty(next: string) {
    setQty(next);
    const n = parseNum(next);
    if (!Number.isFinite(n) || n <= 0) return;
    setGrams(String(round(n * unitG, 1)));
  }

  function applyGrams(next: string) {
    setGrams(next);
    const n = parseNum(next);
    if (!Number.isFinite(n) || n <= 0 || unitG <= 0) return;
    setQty(String(round(n / unitG, 2)));
  }

  function commitPrefs(patch: { queries?: string[]; cat?: string | null }) {
    const next = { ...prefsRef.current, ...patch };
    prefsRef.current = next;
    setQueries(next.queries);
    setCat(next.cat);
    saveSearchPrefs(next);
  }

  function rememberCurrentQuery() {
    if (q.trim().length < 2) return;
    commitPrefs({ queries: rememberQuery(prefsRef.current.queries, q) });
  }

  function applyCat(next: string | null) {
    commitPrefs({ cat: next });
  }

  function dropQuery(query: string) {
    commitPrefs({ queries: prefsRef.current.queries.filter((item) => item !== query) });
  }

  function pick(f: Food) {
    rememberCurrentQuery();
    const unit = f.units[0];
    setPicked(f);
    if (unit) {
      setUnitName(unit.name);
      setQty("1");
      setGrams(String(unit.g));
    } else {
      setUnitName(f.base);
      setQty("100");
      setGrams("100");
    }
  }

  function openManualCreate(name: string, barcode: string) {
    setScanOpen(false);
    setCreateDraft({ name, barcode });
    setCreateOpen(true);
  }

  async function handleBarcode(raw: string) {
    const ean = pickDetectedCode(raw);
    if (!ean) {
      toast.error("Código no válido");
      return;
    }
    setScanOpen(false);
    const local = findFoodByBarcode(ean, customFoods);
    if (local) {
      pick(local);
      toast.success(local.name);
      return;
    }
    setLookupBusy(true);
    toast.loading("Buscando producto…", { id: "off-lookup" });
    try {
      const payload = await fetchOffProduct(ean);
      const draft = mapOffProduct(payload, ean);
      if (draft && foodDraftHasMacros(draft)) {
        const id = addCustomFood({
          name: draft.name,
          kcal: draft.kcal,
          prot: draft.prot,
          carb: draft.carb,
          fat: draft.fat,
          fib: draft.fib,
          sug: draft.sug,
          sat: draft.sat,
          sod: draft.sod,
          units: draft.units,
          base: draft.base,
          barcode: draft.barcode || ean,
        });
        const st = useBrioStore.getState();
        const f = getFood(id, { customFoods: st.customFoods, recipes: st.recipes });
        if (f) pick(f);
        toast.success(draft.name, { id: "off-lookup" });
        return;
      }
      toast.error("No está en el catálogo", { id: "off-lookup" });
      openManualCreate(draft?.name || ean, ean);
    } catch {
      toast.error("No está en el catálogo", { id: "off-lookup" });
      openManualCreate(ean, ean);
    } finally {
      setLookupBusy(false);
    }
  }

  function pickUnit(name: string, g: number) {
    setUnitName(name);
    setQty("1");
    setGrams(String(g));
  }

  function confirm() {
    const g = parseNum(grams);
    const qn = parseNum(qty);
    if (!g || g <= 0 || !qn || qn <= 0) return;
    if (edit) {
      updateMeal(date, edit.meal, edit.entry.id, g, qn, unitName, picked ?? undefined);
    } else {
      if (!picked) return;
      addMeal(date, meal, picked, g, qn, unitName);
    }
    setPicked(null);
    onOpenChange(false);
  }

  const titleName = picked?.name ?? edit?.entry.name ?? "Registrar comida";
  const showQty = !!picked || editing;
  const kcalBase = picked?.kcal ?? edit?.entry.kcal ?? 0;
  const kcalRefG = picked ? 100 : edit?.entry.grams || 100;
  const previewKcal = round((kcalBase * (parseNum(grams) || 0)) / kcalRefG);

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(v) => {
          if (!v && (createOpen || scanOpen || detailFood)) return;
          if (!v) setPicked(null);
          onOpenChange(v);
        }}
        title={showQty ? titleName : "Registrar comida"}
        footer={
          showQty ? (
            <Button className="w-full" onClick={confirm}>
              {editing ? "Guardar" : "Añadir"} · {nf(previewKcal)} kcal
            </Button>
          ) : null
        }
      >
        {showQty ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {!editing ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setPicked(null)}>
                  Atrás
                </Button>
              ) : null}
              {picked ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setDetailFood(picked)}>
                  Ver ficha
                </Button>
              ) : null}
            </div>
            {picked ? (
              <p className="text-sm text-muted-foreground">
                {nf(picked.kcal)} kcal · {nf(picked.prot, 1)} g prot / 100 {picked.base}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Ajusta la cantidad de este registro.</p>
            )}
            {picked && picked.units.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {picked.units.map((u) => (
                  <button
                    key={u.name}
                    type="button"
                    className={cn(
                      "min-h-11 rounded-full px-3 text-sm",
                      unitName === u.name ? "bg-primary text-primary-foreground" : "bg-muted",
                    )}
                    onClick={() => pickUnit(u.name, u.g)}
                  >
                    {u.name} ({nf(u.g, 0)} {picked.base})
                  </button>
                ))}
                {picked.units.every((u) => u.name !== picked.base) ? (
                  <button
                    type="button"
                    className={cn(
                      "min-h-11 rounded-full px-3 text-sm",
                      unitName === picked.base ? "bg-primary text-primary-foreground" : "bg-muted",
                    )}
                    onClick={() => {
                      const g = parseNum(grams) || 100;
                      setUnitName(picked.base);
                      setQty(String(g));
                      setGrams(String(g));
                    }}
                  >
                    {picked.base}
                  </button>
                ) : null}
              </div>
            ) : null}
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="food-qty">
                Cantidad ({unitName})
              </label>
              <Input id="food-qty" inputMode="decimal" value={qty} onChange={(e) => applyQty(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="food-grams">
                {picked?.base === "ml" ? "Mililitros" : "Gramos"}
              </label>
              <Input id="food-grams" inputMode="decimal" value={grams} onChange={(e) => applyGrams(e.target.value)} />
            </div>
            <div className="flex gap-2">
              {[-10, -5, 5, 10].map((n) => (
                <Button
                  key={n}
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="min-h-11 flex-1"
                  onClick={() => applyGrams(String(Math.max(1, (parseNum(grams) || 0) + n)))}
                >
                  {n > 0 ? `+${n}` : n}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-1 overflow-x-auto">
              {MEALS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMeal(m.id)}
                  className={cn(
                    "min-h-11 shrink-0 rounded-full px-3 text-xs font-medium",
                    meal === m.id ? "bg-primary text-primary-foreground" : "bg-muted",
                  )}
                >
                  {m.n}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "min-h-11 flex-1 rounded-lg px-1 text-xs font-medium",
                    tab === t.id ? "bg-muted text-foreground" : "text-muted-foreground",
                  )}
                >
                  {t.n}
                </button>
              ))}
            </div>
            {tab === "buscar" ? (
              <>
                <div className="flex gap-2">
                  <Input
                    className="flex-1"
                    placeholder="Buscar alimento o receta"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onBlur={rememberCurrentQuery}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    aria-label="Escanear código de barras"
                    disabled={lookupBusy}
                    onClick={() => setScanOpen(true)}
                  >
                    <ScanBarcode className="size-5" />
                  </Button>
                </div>
                {queries.length ? (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Búsquedas recientes</p>
                    <div className="flex gap-1 overflow-x-auto pb-1">
                      {queries.map((query) => (
                        <span key={query} className="flex shrink-0 items-center rounded-full bg-muted">
                          <button
                            type="button"
                            className="min-h-11 max-w-40 truncate rounded-l-full pl-3 pr-1 text-xs"
                            onClick={() => setQ(query)}
                          >
                            {query}
                          </button>
                          <button
                            type="button"
                            aria-label="Quitar búsqueda"
                            className="grid size-11 place-items-center text-muted-foreground"
                            onClick={() => dropQuery(query)}
                          >
                            <X className="size-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="flex gap-1 overflow-x-auto pb-1">
                  <Chip on={cat === null} onClick={() => applyCat(null)}>
                    Todas
                  </Chip>
                  {CATEGORIES.filter((c) => !["propio", "receta", "receta_base"].includes(c.id)).map((c) => (
                    <Chip key={c.id} on={cat === c.id} onClick={() => applyCat(c.id)}>
                      {c.n}
                    </Chip>
                  ))}
                </div>
              </>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => {
                setCreateDraft(null);
                setCreateOpen(true);
              }}
            >
              <Plus className="size-4" />
              Crear alimento
            </Button>
            {(catalogReady || list.length > 0) && tab === "buscar" && q.trim() ? (
              <p className="mb-1 text-xs text-muted-foreground" aria-live="polite">
                {list.length === 0
                  ? "Ningún alimento coincide"
                  : `${list.length} resultado${list.length === 1 ? "" : "s"}`}
              </p>
            ) : null}
            <ul className="divide-y divide-border">
              {!catalogReady ? (
                <li>
                  <CatalogNotice state={catalog} loadingText="Cargando alimentos…" />
                </li>
              ) : null}
              {list.length === 0 && catalogReady ? (
                <li className="py-8 text-center text-sm text-muted-foreground">
                  {q.trim()
                    ? `No hay resultados para "${q.trim()}". Prueba con otra palabra o crea el alimento.`
                    : "No hay resultados."}
                </li>
              ) : (
                list.map((f) => {
                  const fav = favorites.includes(f.id);
                  return (
                    <li key={f.id} className="flex items-center gap-2 py-1">
                      <button type="button" className="min-h-11 min-w-0 flex-1 text-left" onClick={() => pick(f)}>
                        <div className="truncate font-medium">
                          {tab === "buscar" ? <HighlightText text={f.name} query={q} /> : f.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {nf(f.kcal)} kcal / 100 {f.base}
                          {f.builtinRecipe ? " · receta" : f.custom ? " · propio" : ""}
                        </div>
                      </button>
                      <button
                        type="button"
                        aria-label="Ver ficha"
                        onClick={() => setDetailFood(f)}
                        className="grid size-11 place-items-center"
                      >
                        <Info className="size-4 text-muted-foreground" />
                      </button>
                      <button
                        type="button"
                        aria-label={fav ? "Quitar de favoritos" : "Añadir a favoritos"}
                        onClick={() => toggleFavorite(f.id)}
                        className="grid size-11 place-items-center"
                      >
                        <Star className={cn("size-4", fav ? "fill-primary text-primary" : "text-muted-foreground")} />
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        )}
      </Sheet>
      <BarcodeScanSheet open={scanOpen} onOpenChange={setScanOpen} onDetected={handleBarcode} busy={lookupBusy} />
      <CustomFoodSheet
        open={createOpen}
        onOpenChange={(v) => {
          setCreateOpen(v);
          if (!v) setCreateDraft(null);
        }}
        initialName={createDraft?.name ?? ""}
        barcode={createDraft?.barcode}
        onSaved={(id) => {
          const st = useBrioStore.getState();
          const f = getFood(id, { customFoods: st.customFoods, recipes: st.recipes });
          if (f) pick(f);
        }}
      />
      {detailFood ? (
        <FoodDetailSheet
          open
          onOpenChange={(v) => {
            if (!v) setDetailFood(null);
          }}
          food={detailFood}
        />
      ) : null}
    </>
  );
}

function BarcodeScanSheet({
  open,
  onOpenChange,
  onDetected,
  busy,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDetected: (ean: string) => void;
  busy?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;
  const [cam, setCam] = useState<"pending" | "live" | "denied" | "unsupported">("pending");
  const [manual, setManual] = useState("");
  const [reading, setReading] = useState(false);

  useEffect(() => {
    if (!open) {
      setCam("pending");
      setManual("");
      setReading(false);
      return;
    }

    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    let emitted = false;
    const videoEl = videoRef.current;

    function emit(code: string) {
      if (emitted || cancelled) return;
      emitted = true;
      onDetectedRef.current(code);
    }

    async function tick(detector: NonNullable<Awaited<ReturnType<typeof createBarcodeDetector>>>) {
      if (cancelled || emitted) return;
      const video = videoEl ?? videoRef.current;
      if (video && video.readyState >= 2) {
        try {
          const codes = await detector.detect(video);
          for (const code of codes) {
            const ean = pickDetectedCode(code.rawValue);
            if (ean) {
              emit(ean);
              return;
            }
          }
        } catch {
          /* frame dropped */
        }
      }
      timer = setTimeout(() => {
        void tick(detector);
      }, 280);
    }

    async function start() {
      if (!hasBarcodeDetector()) {
        setCam("unsupported");
        return;
      }
      const detector = await createBarcodeDetector();
      if (cancelled) return;
      if (!detector) {
        setCam("unsupported");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setCam("denied");
        return;
      }
      try {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
            audio: false,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoEl ?? videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }
        if (cancelled) return;
        setCam("live");
        void tick(detector);
      } catch {
        if (!cancelled) setCam("denied");
      }
    }

    void start();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
      if (videoEl) videoEl.srcObject = null;
    };
  }, [open]);

  function submitManual() {
    const ean = normalizeEan(manual);
    if (!isValidEan(ean)) {
      toast.error("Código no válido");
      return;
    }
    onDetected(ean);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setReading(true);
    try {
      if (hasBarcodeDetector()) {
        const bitmap = await createImageBitmap(file);
        try {
          const ean = await detectBarcodeFromImage(bitmap);
          if (ean) {
            onDetected(ean);
            return;
          }
        } finally {
          bitmap.close();
        }
        toast.error("No se ha podido leer el código. Escríbelo a mano.");
      } else {
        toast.error("Este navegador no lee códigos en fotos. Escribe el número.");
      }
    } catch {
      toast.error("No se ha podido leer el código. Escríbelo a mano.");
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const blocked = busy || reading;

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Escanear código">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Brío usará la cámara solo para leer el código de barras. No se guarda ninguna foto.
        </p>
        <video
          ref={videoRef}
          className={cn("aspect-[4/3] w-full rounded-2xl bg-black object-cover", cam === "live" ? "block" : "hidden")}
          playsInline
          muted
          autoPlay
        />
        {cam === "pending" && hasBarcodeDetector() ? (
          <p className="text-sm text-muted-foreground">Pidiendo acceso a la cámara…</p>
        ) : null}
        {cam === "denied" ? (
          <p className="text-sm text-muted-foreground">No hay acceso a la cámara. Escribe el código o haz una foto.</p>
        ) : null}
        {cam === "unsupported" ? (
          <p className="text-sm text-muted-foreground">
            Este navegador no lee códigos en vivo. Escribe el EAN o haz una foto.
          </p>
        ) : null}
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="ean-manual">
            O escribe el código (EAN / UPC)
          </label>
          <div className="flex gap-2">
            <Input
              id="ean-manual"
              inputMode="numeric"
              autoComplete="off"
              placeholder="8412345678901"
              value={manual}
              disabled={blocked}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitManual();
                }
              }}
            />
            <Button type="button" variant="secondary" disabled={blocked} onClick={submitManual}>
              Buscar
            </Button>
          </div>
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled={blocked}
            onClick={() => fileRef.current?.click()}
          >
            Hacer foto
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-11 shrink-0 rounded-full px-3 text-xs",
        on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}
