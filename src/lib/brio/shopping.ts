import { norm, uid } from "./format";
import { CATEGORIES, type ShoppingItem } from "./types";

/** Bucket for anything we cannot match to a catalog category. */
export const SHOPPING_OTHER = "otros";

/**
 * Aisle order for the list, roughly how a Spanish supermarket is walked:
 * fresh produce first, then the counters, then the dry aisles, then the rest.
 * Anything not named here (or typed free-hand) falls to the end under "Otros".
 */
const AISLE_ORDER = [
  "fruta",
  "verdura",
  "carne",
  "pescado",
  "lacteo",
  "cereal",
  "legumbre",
  "frutoseco",
  "grasa",
  "salsa",
  "especia",
  "bebida",
  "precocinado",
  "dulce",
] as const;

const AISLE_NAMES: Record<string, string> = {
  ...Object.fromEntries(CATEGORIES.map((c) => [c.id, c.n])),
  [SHOPPING_OTHER]: "Otros",
};

export function aisleName(cat: string): string {
  return AISLE_NAMES[cat] ?? "Otros";
}

/** Position of a category in the walk order; unknown ones sort last. */
function aisleRank(cat: string): number {
  const i = AISLE_ORDER.indexOf(cat as (typeof AISLE_ORDER)[number]);
  return i < 0 ? AISLE_ORDER.length : i;
}

/**
 * A leading amount, so "2 kg tomates" splits into qty "2 kg" and name
 * "tomates". The unit is optional ("3 aguacates") and the rest of the line
 * has to be non-empty, so plain "2" stays a name rather than a bare quantity.
 */
const QTY_LEAD =
  /^(\d+(?:[.,]\d+)?)\s*(kg|kilos?|g|gr|gramos?|l|litros?|ml|cl|uds?|unidades?|paq|paquetes?|botes?|latas?|docenas?|barras?|bolsas?|x)?\s+(\S.*)$/i;

export type ParsedShoppingInput = { name: string; qty: string };

/** Splits a typed line into an optional leading quantity and the item name. */
export function parseShoppingInput(raw: string): ParsedShoppingInput {
  const text = String(raw).trim().replace(/\s+/g, " ");
  if (!text) return { name: "", qty: "" };
  const m = QTY_LEAD.exec(text);
  if (!m) return { name: text, qty: "" };
  const amount = m[1];
  const unit = m[2] ? ` ${m[2].toLowerCase()}` : "";
  return { name: m[3].trim(), qty: `${amount}${unit}` };
}

/** Match key for "is this already on the list": accent- and case-insensitive. */
export function shoppingKey(name: string): string {
  return norm(name).trim();
}

export function findShoppingItem(items: ShoppingItem[], name: string): ShoppingItem | undefined {
  const key = shoppingKey(name);
  if (!key) return undefined;
  return items.find((i) => shoppingKey(i.name) === key);
}

export function makeShoppingItem(input: { name: string; qty?: string; cat?: string; foodId?: string }): ShoppingItem {
  return {
    id: uid("s"),
    name: input.name.trim(),
    qty: (input.qty ?? "").trim(),
    done: false,
    cat: input.cat || SHOPPING_OTHER,
    ...(input.foodId ? { foodId: input.foodId } : {}),
    t: Date.now(),
  };
}

export type ShoppingGroup = { cat: string; name: string; items: ShoppingItem[] };

/**
 * Pending items grouped by aisle (in walk order), then the ticked ones as a
 * single trailing group. Within a group the original insertion order is kept
 * so a line does not jump around while you are standing in front of a shelf.
 */
export function groupShopping(items: ShoppingItem[]): { pending: ShoppingGroup[]; done: ShoppingItem[] } {
  const byCat = new Map<string, ShoppingItem[]>();
  const done: ShoppingItem[] = [];
  for (const item of items) {
    if (item.done) {
      done.push(item);
      continue;
    }
    const cat = item.cat || SHOPPING_OTHER;
    const bucket = byCat.get(cat);
    if (bucket) bucket.push(item);
    else byCat.set(cat, [item]);
  }
  const pending = [...byCat.entries()]
    .map(([cat, list]) => ({ cat, name: aisleName(cat), items: list }))
    .sort((a, b) => aisleRank(a.cat) - aisleRank(b.cat) || a.name.localeCompare(b.name, "es"));
  return { pending, done };
}

export function shoppingCounts(items: ShoppingItem[]): { total: number; pending: number; done: number } {
  let done = 0;
  for (const i of items) if (i.done) done += 1;
  return { total: items.length, pending: items.length - done, done };
}

/** One line per item for the clipboard / share sheet, grouped like the screen. */
export function shoppingAsText(items: ShoppingItem[]): string {
  const { pending } = groupShopping(items);
  const lines: string[] = [];
  for (const g of pending) {
    lines.push(`${g.name.toUpperCase()}`);
    for (const i of g.items) lines.push(`- ${i.qty ? `${i.qty} ` : ""}${i.name}`);
    lines.push("");
  }
  return lines.join("\n").trim();
}

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** Validates a persisted list the same way meals and workouts are validated. */
export function parseShopping(raw: unknown): ShoppingItem[] {
  if (!Array.isArray(raw)) return [];
  const out: ShoppingItem[] = [];
  const seen = new Set<string>();
  for (const v of raw) {
    if (!isObj(v)) continue;
    const name = typeof v.name === "string" ? v.name.trim() : "";
    if (!name) continue;
    const key = shoppingKey(name);
    if (seen.has(key)) continue;
    seen.add(key);
    const t = Number(v.t);
    const foodId = typeof v.foodId === "string" && v.foodId ? v.foodId : undefined;
    out.push({
      id: typeof v.id === "string" && v.id ? v.id : uid("s"),
      name,
      qty: typeof v.qty === "string" ? v.qty.trim() : "",
      done: !!v.done,
      cat: typeof v.cat === "string" && v.cat ? v.cat : SHOPPING_OTHER,
      ...(foodId ? { foodId } : {}),
      t: Number.isFinite(t) ? t : Date.now(),
    });
  }
  return out;
}
