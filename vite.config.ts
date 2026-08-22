import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
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

export default defineConfig({
  base,
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
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
