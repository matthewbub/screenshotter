import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { PNG } from "pngjs";

import { diffPngImages } from "../src/diff.js";

function createSolidPng(
  width: number,
  height: number,
  rgba: [number, number, number, number],
): Buffer {
  const image = new PNG({ width, height });

  for (let index = 0; index < image.data.length; index += 4) {
    image.data[index] = rgba[0];
    image.data[index + 1] = rgba[1];
    image.data[index + 2] = rgba[2];
    image.data[index + 3] = rgba[3];
  }

  return PNG.sync.write(image);
}

test("writes a red-pixel diff image and reports mismatch stats", async (t) => {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "screenshotter-diff-"));

  t.after(async () => {
    await rm(tempDirectory, { recursive: true, force: true });
  });

  const beforeImagePath = path.join(tempDirectory, "before.png");
  const afterImagePath = path.join(tempDirectory, "after.png");
  const outputPath = path.join(tempDirectory, "diff.png");

  await writeFile(beforeImagePath, createSolidPng(2, 1, [255, 255, 255, 255]));
  await writeFile(afterImagePath, createSolidPng(2, 1, [255, 255, 255, 255]));

  const afterImage = PNG.sync.read(await readFile(afterImagePath));
  afterImage.data[0] = 0;
  afterImage.data[1] = 0;
  afterImage.data[2] = 0;
  await writeFile(afterImagePath, PNG.sync.write(afterImage));

  const result = await diffPngImages(beforeImagePath, afterImagePath, {
    outputPath,
  });
  const diffImage = PNG.sync.read(await readFile(outputPath));

  assert.equal(result.outputPath, outputPath);
  assert.equal(result.mismatchPixels, 1);
  assert.equal(result.totalPixels, 2);
  assert.equal(result.diffRatio, 0.5);
  assert.equal(diffImage.data[0], 255);
  assert.equal(diffImage.data[1], 0);
  assert.equal(diffImage.data[2], 0);
});

test("rejects images with different dimensions", async (t) => {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "screenshotter-diff-"));

  t.after(async () => {
    await rm(tempDirectory, { recursive: true, force: true });
  });

  const beforeImagePath = path.join(tempDirectory, "before.png");
  const afterImagePath = path.join(tempDirectory, "after.png");

  await writeFile(beforeImagePath, createSolidPng(2, 2, [255, 255, 255, 255]));
  await writeFile(afterImagePath, createSolidPng(3, 2, [255, 255, 255, 255]));

  await assert.rejects(
    diffPngImages(beforeImagePath, afterImagePath),
    /Images must have the same dimensions/,
  );
});
