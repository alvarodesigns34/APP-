import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
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
