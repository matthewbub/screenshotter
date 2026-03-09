import process from "node:process";

import { AssetService, AssetStore } from "../assets.js";
import { createApiApp } from "./app.js";

const port = Number(process.env.SCREENSHOTTER_API_PORT ?? process.env.PORT ?? "4310");
const dataDirectory = process.env.SCREENSHOTTER_DATA_DIR;

const assetStore = dataDirectory ? new AssetStore(dataDirectory) : new AssetStore();
const assetService = new AssetService(assetStore);

await assetService.init();

const app = createApiApp({
  assetService,
});

const server = app.listen(port, () => {
  process.stdout.write(`screenshotter api listening on http://localhost:${port}\n`);
});

async function shutdown(signal: string): Promise<void> {
  process.stdout.write(`\nReceived ${signal}, shutting down...\n`);

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  await assetService.dispose();
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    shutdown(signal)
      .then(() => {
        process.exit(0);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`${message}\n`);
        process.exit(1);
      });
  });
}
