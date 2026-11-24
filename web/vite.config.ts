import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
// vitest/config re-exports Vite's defineConfig and adds the `test` section to its type.
import { defineConfig } from "vitest/config";

// Port of `ycov view` (src/ycov/view.py, default 8000).
const API = "http://127.0.0.1:8000";

export default defineConfig({
  // tailwindcss(): compiles the utility classes used in src/ and the tokens in styles/globals.css.
  plugins: [react(), tailwindcss()],

  // "@/..." -> "src/...", the same alias as "paths" in tsconfig.json and in components.json (shadcn/ui).
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },

  // Relative asset paths: dist/ is served by FastAPI's StaticFiles at "/".
  base: "./",

  // `npm run dev`: hot reload on 5173, /api forwarded to the running `ycov view`.
  // Same origin for the browser, so the server needs no CORS. Localhost only.
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: { "/api": API },
  },

  // `npm run build` -> web/dist, the FRONTEND_DIR that `ycov view` serves.
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // plotly.js-basic-dist-min alone is ~1.2 MB; local app, so a single big chunk is fine.
    chunkSizeWarningLimit: 2000,
  },

  // `npm test`: unit tests of the pure helpers in src/lib/, no browser (DOM) needed.
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
