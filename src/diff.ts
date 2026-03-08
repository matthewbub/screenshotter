import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { mkdir } from "node:fs/promises";

import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

import { ValidationError } from "./errors.js";

export type ImageDiffResult = {
  outputPath: string;
  mismatchPixels: number;
  totalPixels: number;
  diffRatio: number;
  width: number;
  height: number;
};

type ImageDiffOptions = {
  outputPath?: string;
};

const DEFAULT_DIFF_OUTPUT = "diff.png";
const RED_DIFF_COLOR: [number, number, number] = [255, 0, 0];

async function readPngImage(filePath: string): Promise<PNG> {
  try {
    const buffer = await readFile(filePath);
    return PNG.sync.read(buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ValidationError(`Could not read PNG image at ${filePath}: ${message}`);
  }
}

export async function diffPngImages(
  beforeImagePath: string,
  afterImagePath: string,
  options: ImageDiffOptions = {},
): Promise<ImageDiffResult> {
  const beforeImage = await readPngImage(beforeImagePath);
  const afterImage = await readPngImage(afterImagePath);

  if (
    beforeImage.width !== afterImage.width ||
    beforeImage.height !== afterImage.height
  ) {
    throw new ValidationError(
      `Images must have the same dimensions. Received ${beforeImage.width}x${beforeImage.height} and ${afterImage.width}x${afterImage.height}.`,
    );
  }

  const diffImage = new PNG({
    width: beforeImage.width,
    height: beforeImage.height,
  });

  const mismatchPixels = pixelmatch(
    beforeImage.data,
    afterImage.data,
    diffImage.data,
    beforeImage.width,
    beforeImage.height,
    {
      diffColor: RED_DIFF_COLOR,
    },
  );
  const outputPath = options.outputPath ?? DEFAULT_DIFF_OUTPUT;
  const totalPixels = beforeImage.width * beforeImage.height;

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, PNG.sync.write(diffImage));

  return {
    outputPath,
    mismatchPixels,
    totalPixels,
    diffRatio: mismatchPixels / totalPixels,
    width: beforeImage.width,
    height: beforeImage.height,
  };
}
