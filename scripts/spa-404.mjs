// GitHub Pages has no server-side rewrites: a direct visit (or refresh) to a
// route like /APP-/comida has no matching file, so Pages serves 404.html
// instead of returning a real 404. Copying the built index.html there means
// the browser gets the SPA shell either way, and TanStack Router — reading
// the real address bar, which GitHub Pages does not alter — renders the
// right screen from it. Standard trick for SPAs on GitHub Pages.
import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import console from "node:console";
import process from "node:process";

const dist = resolve(import.meta.dirname, "..", "dist");
const from = resolve(dist, "index.html");
const to = resolve(dist, "404.html");

if (!existsSync(from)) {
  console.error(`spa-404: ${from} not found — run the build first.`);
  process.exit(1);
}
copyFileSync(from, to);
console.log(`spa-404: copied index.html -> 404.html`);
