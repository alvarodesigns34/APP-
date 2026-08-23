import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { visualizer } from "rollup-plugin-visualizer";

// GitHub Pages serves this repo under /APP-/, not the domain root, so every
// absolute "/xyz" reference in the app needs that prefix in a Pages build.
// Local dev and `npm run build` stay at "/" (e.g. for a future custom-domain
// or Vercel/Netlify deploy, which do serve from the root); only the deploy
// workflow sets GH_PAGES=true.
const base = process.env.GH_PAGES === "true" ? "/APP-/" : "/";

/**
 * Chunks por encima de esto no se precachean: son mejoras opcionales que la app
 * ya carga con `import()` y que degradan solas (Tendencias tiene su esqueleto,
 * el escáner necesita cámara de todos modos). Hoy separa limpiamente los dos
 * pesos pesados —Recharts (~420 kB) y ZXing (~450 kB)— del resto, donde el
 * mayor es react-vendor (~195 kB).
 */
const PRECACHE_MAX_BYTES = 250_000;

/**
 * Mete los assets de este build en el precache del service worker.
 *
 * `public/sw.js` se copia tal cual, así que su lista de precache solo podía
 * contener rutas fijas: el shell, los iconos, las fuentes y los JSON. Ningún
 * chunk con hash, y con `autoCodeSplitting` cada pantalla es el suyo. Resultado:
 * quien instalaba la PWA, abría Hoy y se metía en el metro, al tocar "Comida"
 * se encontraba la pantalla de error del router, porque ese chunk no se había
 * descargado nunca y el worker no lo tenía. Offline solo funcionaba en la
 * pantalla por la que hubieras pasado, aunque el README prometiera otra cosa.
 */
function swPrecacheBuildAssets(): Plugin {
  return {
    name: "brio-sw-precache",
    apply: "build",
    writeBundle(options, bundle) {
      const outDir = options.dir;
      if (!outDir) return;
      const swPath = join(outDir, "sw.js");
      let src: string;
      try {
        src = readFileSync(swPath, "utf8");
      } catch {
        return; // sin service worker no hay nada que inyectar
      }

      // Lo que index.html referencia hace falta para arrancar, pese el tamaño
      // que pese; el resto entra solo si es de los ligeros.
      const html = bundle["index.html"];
      const booted = new Set<string>();
      if (html && html.type === "asset") {
        const text = String(html.source);
        for (const name of Object.keys(bundle)) {
          if (text.includes(name)) booted.add(name);
        }
      }

      const assets = Object.entries(bundle)
        .filter(([name, out]) => {
          if (!/\.(js|css)$/.test(name)) return false;
          if (booted.has(name)) return true;
          const size = out.type === "chunk" ? Buffer.byteLength(out.code) : Buffer.byteLength(String(out.source));
          return size <= PRECACHE_MAX_BYTES;
        })
        .map(([name]) => `./${name}`)
        .sort();

      const marker = "/* __BRIO_BUILD_ASSETS__ */ []";
      if (!src.includes(marker)) {
        this.warn("sw.js no tiene el marcador de precache; los chunks no se han inyectado");
        return;
      }
      writeFileSync(swPath, src.replace(marker, JSON.stringify(assets)));
    },
  };
}

export default defineConfig({
  base,
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
    swPrecacheBuildAssets(),
    ...(process.env.ANALYZE === "true"
      ? [
          visualizer({
            filename: "dist/stats.html",
            title: "Brío bundle stats",
            gzipSize: true,
            brotliSize: true,
            template: "treemap",
            open: false,
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // 1.5: vendor estable. El JSON de alimentos/recetas NO entra aquí.
        manualChunks(id) {
          const norm = id.replaceAll("\\", "/");
          if (!norm.includes("/node_modules/")) return;
          if (
            norm.includes("/node_modules/react/") ||
            norm.includes("/node_modules/react-dom/") ||
            norm.includes("/node_modules/scheduler/")
          ) {
            return "react-vendor";
          }
          if (norm.includes("/node_modules/@tanstack/")) {
            return "router-vendor";
          }
        },
      },
    },
  },
});
