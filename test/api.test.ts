import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import request from "supertest";
import { PNG } from "pngjs";

import { createApiApp } from "../src/api/app.js";
import { NotFoundError } from "../src/errors.js";
import type { AssetRecord } from "../src/types.js";

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

test("serves health, assets, and file responses", async (t) => {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "screenshotter-api-"));

  t.after(async () => {
    await rm(tempDirectory, { recursive: true, force: true });
  });

  const screenshotPath = path.join(tempDirectory, "screenshot.png");
  await writeFile(screenshotPath, createSolidPng(2, 1, [255, 255, 255, 255]));

  const screenshotAsset: AssetRecord = {
    id: "shot-1",
    kind: "screenshot",
    source: "capture",
    createdAt: "2026-03-08T18:10:00.000Z",
    fileName: "shot-1-example.com.png",
    filePath: screenshotPath,
    width: 2,
    height: 1,
    sourceUrl: "https://example.com/",
  };

  const diffAsset: AssetRecord = {
    id: "diff-1",
    kind: "diff",
    createdAt: "2026-03-08T18:11:00.000Z",
    fileName: "diff-1-diff.png",
    filePath: screenshotPath,
    width: 2,
    height: 1,
    beforeAssetId: "shot-1",
    afterAssetId: "shot-1",
    mismatchPixels: 0,
    totalPixels: 2,
    diffRatio: 0,
  };

  const app = createApiApp({
    assetService: {
      async listAssets() {
        return [diffAsset, screenshotAsset];
      },
      async getAsset(id: string) {
        const asset = [diffAsset, screenshotAsset].find((entry) => entry.id === id);

        if (!asset) {
          throw new NotFoundError(`No asset found for id "${id}".`);
        }

        return asset;
      },
      async createScreenshot() {
        return screenshotAsset;
      },
      async uploadScreenshot() {
        return screenshotAsset;
      },
      async createDiff() {
        return diffAsset;
      },
    },
    webDistDir: tempDirectory,
  });

  const healthResponse = await request(app).get("/api/health");
  assert.equal(healthResponse.status, 200);
  assert.deepEqual(healthResponse.body, { ok: true });

  const assetsResponse = await request(app).get("/api/assets");
  assert.equal(assetsResponse.status, 200);
  assert.equal(assetsResponse.body.assets.length, 2);
  assert.equal(assetsResponse.body.assets[0].fileUrl, "/api/assets/diff-1/file");

  const fileResponse = await request(app).get("/api/assets/shot-1/file");
  assert.equal(fileResponse.status, 200);
  assert.match(fileResponse.headers["content-type"] ?? "", /image\/png/);
});

test("validates screenshot and diff payloads", async () => {
  const app = createApiApp({
    assetService: {
      async listAssets() {
        return [];
      },
      async getAsset() {
        throw new NotFoundError("missing");
      },
      async createScreenshot(url: string) {
        return {
          id: "shot-1",
          kind: "screenshot",
          source: "capture",
          createdAt: "2026-03-08T18:10:00.000Z",
          fileName: "shot-1-example.com.png",
          filePath: "/tmp/shot-1-example.com.png",
          width: 2,
          height: 1,
          sourceUrl: url,
        } satisfies AssetRecord;
      },
      async uploadScreenshot(file: { fileName: string; pngBase64: string }) {
        return {
          id: "upload-1",
          kind: "screenshot",
          source: "upload",
          createdAt: "2026-03-08T18:10:00.000Z",
          fileName: "upload-1-upload.png",
          filePath: "/tmp/upload-1-upload.png",
          width: 2,
          height: 1,
          originalFileName: file.fileName,
        } satisfies AssetRecord;
      },
      async createDiff(beforeAssetId: string, afterAssetId: string) {
        return {
          id: "diff-1",
          kind: "diff",
          createdAt: "2026-03-08T18:11:00.000Z",
          fileName: "diff-1-diff.png",
          filePath: "/tmp/diff-1-diff.png",
          width: 2,
          height: 1,
          beforeAssetId,
          afterAssetId,
          mismatchPixels: 1,
          totalPixels: 2,
          diffRatio: 0.5,
        } satisfies AssetRecord;
      },
    },
    webDistDir: path.join(os.tmpdir(), "screenshotter-missing-web"),
  });

  const invalidScreenshotResponse = await request(app)
    .post("/api/screenshots")
    .send({ url: "" });
  assert.equal(invalidScreenshotResponse.status, 400);
  assert.match(invalidScreenshotResponse.body.error.message, /url/i);

  const screenshotResponse = await request(app)
    .post("/api/screenshots")
    .send({ url: "https://example.com" });
  assert.equal(screenshotResponse.status, 201);
  assert.equal(screenshotResponse.body.asset.kind, "screenshot");
  assert.equal(screenshotResponse.body.asset.source, "capture");

  const invalidUploadResponse = await request(app)
    .post("/api/uploads")
    .send({ fileName: "", pngBase64: "" });
  assert.equal(invalidUploadResponse.status, 400);

  const uploadResponse = await request(app)
    .post("/api/uploads")
    .send({ fileName: "selfie.jpg", pngBase64: "ZmFrZQ==" });
  assert.equal(uploadResponse.status, 201);
  assert.equal(uploadResponse.body.asset.kind, "screenshot");
  assert.equal(uploadResponse.body.asset.source, "upload");
  assert.equal(uploadResponse.body.asset.originalFileName, "selfie.jpg");

  const invalidDiffResponse = await request(app)
    .post("/api/diffs")
    .send({ beforeAssetId: "", afterAssetId: "" });
  assert.equal(invalidDiffResponse.status, 400);

  const diffResponse = await request(app)
    .post("/api/diffs")
    .send({ beforeAssetId: "shot-1", afterAssetId: "shot-2" });
  assert.equal(diffResponse.status, 201);
  assert.equal(diffResponse.body.asset.kind, "diff");
});
