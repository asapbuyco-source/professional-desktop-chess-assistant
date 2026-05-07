import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  worker: {
    format: "es",
  },
  build: {
    minify: "terser",
    cssMinify: true,
    sourcemap: false,
    target: "es2020",
    // Let Rollup handle chunking naturally; don't force single-file
    rollupOptions: {
      output: {
        // Split vendor and worker into separate chunks for better caching
        manualChunks: (id) => {
          if (id.includes("node_modules/chess.js")) return "chess";
          if (id.includes("node_modules/react")) return "react-vendor";
        },
      },
    },
  },
});