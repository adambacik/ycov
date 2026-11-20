import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Port of `ycov view` (src/ycov/view.py, default 8000).
const API = "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react()],

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
    // plotly.js-dist-min alone is ~4.5 MB; local app, so a single big chunk is fine.
    chunkSizeWarningLimit: 6000,
  },
});
