#!/usr/bin/env node
/** Text summary of dist/assets gzip sizes. Used by `npm run analyze`. */
import { gzipSync } from "node:zlib";
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const dir = "dist/assets";
const files = readdirSync(dir).sort();
const rows = [];
let jsRaw = 0;
let jsGz = 0;

for (const name of files) {
  const p = join(dir, name);
  const raw = statSync(p).size;
  const gz = gzipSync(readFileSync(p)).length;
  rows.push({ name, raw, gz });
  if (name.endsWith(".js")) {
    jsRaw += raw;
    jsGz += gz;
  }
}

const lines = [];
lines.push("Brío — resumen de chunks (zlib.gzipSync, mismo criterio que Vite)");
lines.push(`Generado: ${new Date().toISOString()}`);
lines.push("");
lines.push("| archivo | bytes disco | gzip | kB Vite | gzip kB |");
lines.push("|---|---:|---:|---:|---:|");
for (const r of rows) {
  lines.push(`| ${r.name} | ${r.raw} | ${r.gz} | ${(r.raw / 1000).toFixed(2)} | ${(r.gz / 1000).toFixed(2)} |`);
}
lines.push("");
lines.push(`Total JS: ${jsRaw} B disco / ${jsGz} B gzip`);
lines.push("");

const html = readFileSync("dist/index.html", "utf8");
const initial = [...html.matchAll(/\/assets\/([^"'>\s]+)/g)].map((m) => m[1]);
lines.push("Carga inicial (referencias en dist/index.html):");
let initRaw = 0;
let initGz = 0;
for (const name of initial) {
  const r = rows.find((x) => x.name === name);
  if (!r) {
    lines.push(`- ${name} (no está en dist/assets)`);
    continue;
  }
  initRaw += r.raw;
  initGz += r.gz;
  lines.push(`- ${name}: ${r.raw} B / gzip ${r.gz} B`);
}
lines.push(`Suma inicial: ${initRaw} B disco / ${initGz} B gzip`);
lines.push("");
lines.push("stats.html (treemap de rollup-plugin-visualizer) queda en dist/ y no se commitea.");

const text = lines.join("\n") + "\n";
mkdirSync("docs", { recursive: true });
writeFileSync("docs/bundle-stats.txt", text);
writeFileSync("dist/bundle-stats.txt", text);
process.stdout.write(text);
