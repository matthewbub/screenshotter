import { chmod, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFilePath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(currentFilePath), "..");
const binDirectory = path.join(projectRoot, "node_modules", ".bin");
const scriptTarget = path.join(projectRoot, "bin", "screenshotter.mjs");
const unixShimPath = path.join(binDirectory, "screenshotter");
const windowsShimPath = path.join(binDirectory, "screenshotter.cmd");

const unixShim = `#!/bin/sh
exec node "${scriptTarget}" "$@"
`;

const windowsShim = `@ECHO OFF
node "${scriptTarget}" %*
`;

await mkdir(binDirectory, { recursive: true });
await writeFile(unixShimPath, unixShim, "utf8");
await chmod(unixShimPath, 0o755);
await writeFile(windowsShimPath, windowsShim, "utf8");
