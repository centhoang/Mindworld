import { defineConfig } from "vitest/config";

// In dev the Worker (`npm run dev` in ../worker) serves /api on :8787; Vite proxies to it (WebSockets too,
// for the live room). API_PROXY=http://localhost:<port> points it at a Worker on another port.
export default defineConfig({
  server: { port: 5173, proxy: { "/api": { target: process.env.API_PROXY ?? "http://localhost:8787", ws: true }, "/mlc/": process.env.API_PROXY ?? "http://localhost:8787" } },
  build: {
    target: "es2022",
    rollupOptions: { input: { main: "index.html", spikeB: "spike-b.html", labNpc: "lab/npc.html", labPet: "lab/pet.html", labNet: "lab/net.html", labVisual: "lab/visual.html" } },
  },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
