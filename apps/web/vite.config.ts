import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const apiPort = Number(process.env.SCREENSHOTTER_API_PORT ?? "4310");
const webPort = Number(process.env.SCREENSHOTTER_WEB_PORT ?? "4173");

export default defineConfig({
  root: projectRoot,
  plugins: [react()],
  server: {
    port: webPort,
    strictPort: true,
    proxy: {
      "/api": `http://localhost:${apiPort}`,
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
