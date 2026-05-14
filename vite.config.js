import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        snake: fileURLToPath(new URL("./snake.html", import.meta.url)),
      },
    },
  },
  preview: {
    allowedHosts: ["arissmiller.net", "arissmiller-net-production.up.railway.app"],
  },
});
