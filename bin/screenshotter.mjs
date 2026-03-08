#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const tsxImport = pathToFileURL(require.resolve("tsx")).href;
const cliEntry = new URL("../src/cli.ts", import.meta.url);

const child = spawn(
  process.execPath,
  ["--import", tsxImport, cliEntry.pathname, ...process.argv.slice(2)],
  {
    stdio: "inherit",
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error(`Failed to launch screenshotter: ${error.message}`);
  process.exit(1);
});
