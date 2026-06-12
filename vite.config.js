import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const seaOfSimulationOrigin = process.env.SEA_OF_SIMULATION_ORIGIN;

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        snake: fileURLToPath(new URL("./snake.html", import.meta.url)),
        gallery: fileURLToPath(new URL("./gallery.html", import.meta.url)),
      },
    },
  },
  server: seaOfSimulationOrigin
    ? {
        proxy: {
          "/sea-of-simulation": {
            target: seaOfSimulationOrigin,
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/sea-of-simulation/, "") || "/",
          },
        },
      }
    : undefined,
  preview: {
    allowedHosts: ["arissmiller.net", "arissmiller-net-production.up.railway.app"],
  },
});
