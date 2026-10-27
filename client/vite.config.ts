import { defineConfig } from "vitest/config";

// In dev the Worker (`npm run dev` in ../worker) serves /api on :8787; Vite proxies to it.
export default defineConfig({
  server: { port: 5173, proxy: { "/api": "http://localhost:8787" } },
  build: {
    target: "es2022",
    rollupOptions: { input: { main: "index.html", spikeB: "spike-b.html" } },
  },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
