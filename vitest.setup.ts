import { readFileSync } from "node:fs";
import path from "node:path";

const dataDir = path.join(process.cwd(), "src/data");
const originalFetch = globalThis.fetch;

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const m = url.match(/(?:^|\/)data\/(foods|recipes|routines)\.json(?:\?|$)/);
  if (m) {
    const json = readFileSync(path.join(dataDir, `${m[1]}.json`), "utf8");
    return new Response(json, { status: 200, headers: { "Content-Type": "application/json" } });
  }
  if (typeof originalFetch === "function") return originalFetch(input, init);
  throw new Error(`unmocked fetch: ${url}`);
}) as typeof fetch;
