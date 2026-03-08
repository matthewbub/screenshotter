import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { diffPngImages } from "./diff.js";
import { NotFoundError } from "./errors.js";
import {
  BrowserManager,
  captureScreenshotToPath,
  getScreenshotFileName,
  normalizeScreenshotUrl,
  type BrowserManagerLike,
} from "./screenshot.js";
import type {
  AssetRecord,
  DiffAssetRecord,
  PublicAsset,
  ScreenshotAssetRecord,
} from "./types.js";

type AssetIndex = {
  version: 1;
  assets: AssetRecord[];
};

export type AssetServiceLike = {
  listAssets(): Promise<AssetRecord[]>;
  getAsset(id: string): Promise<AssetRecord>;
  createScreenshot(url: string): Promise<AssetRecord>;
  createDiff(beforeAssetId: string, afterAssetId: string): Promise<AssetRecord>;
};

const EMPTY_INDEX: AssetIndex = {
  version: 1,
  assets: [],
};

export function getPublicAssetFileUrl(id: string): string {
  return `/api/assets/${id}/file`;
}

export function toPublicAsset(asset: AssetRecord): PublicAsset {
  const shared = {
    id: asset.id,
    kind: asset.kind,
    createdAt: asset.createdAt,
    fileName: asset.fileName,
    fileUrl: getPublicAssetFileUrl(asset.id),
    width: asset.width,
    height: asset.height,
  } as const;

  if (asset.kind === "screenshot") {
    return {
      ...shared,
      kind: "screenshot",
      sourceUrl: asset.sourceUrl,
    };
  }

  return {
    ...shared,
    kind: "diff",
    beforeAssetId: asset.beforeAssetId,
    afterAssetId: asset.afterAssetId,
    mismatchPixels: asset.mismatchPixels,
    totalPixels: asset.totalPixels,
    diffRatio: asset.diffRatio,
  };
}

export class AssetStore {
  readonly baseDir: string;
  readonly assetsDir: string;
  readonly indexPath: string;

  private readyPromise?: Promise<void>;
  private writeQueue = Promise.resolve();

  constructor(baseDir = path.resolve(process.cwd(), "data")) {
    this.baseDir = baseDir;
    this.assetsDir = path.join(baseDir, "assets");
    this.indexPath = path.join(baseDir, "index.json");
  }

  async ensureReady(): Promise<void> {
    if (!this.readyPromise) {
      this.readyPromise = (async () => {
        await mkdir(this.assetsDir, { recursive: true });

        try {
          await access(this.indexPath);
        } catch {
          await this.writeIndex(EMPTY_INDEX);
        }
      })();
    }

    await this.readyPromise;
  }

  async listAssets(): Promise<AssetRecord[]> {
    const index = await this.readIndex();
    return [...index.assets].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async getAsset(id: string): Promise<AssetRecord | undefined> {
    const index = await this.readIndex();
    return index.assets.find((asset) => asset.id === id);
  }

  async saveAsset(asset: AssetRecord): Promise<void> {
    const persist = async () => {
      const index = await this.readIndex();
      const remainingAssets = index.assets.filter((entry) => entry.id !== asset.id);

      await this.writeIndex({
        version: 1,
        assets: [asset, ...remainingAssets],
      });
    };

    this.writeQueue = this.writeQueue.then(persist, persist);

    await this.writeQueue;
  }

  private async readIndex(): Promise<AssetIndex> {
    await this.ensureReady();

    const raw = await readFile(this.indexPath, "utf8");
    return JSON.parse(raw) as AssetIndex;
  }

  private async writeIndex(index: AssetIndex): Promise<void> {
    await mkdir(this.baseDir, { recursive: true });

    const tempPath = `${this.indexPath}.${randomUUID()}.tmp`;
    await writeFile(tempPath, JSON.stringify(index, null, 2), "utf8");
    await rename(tempPath, this.indexPath);
  }
}

export class AssetService implements AssetServiceLike {
  constructor(
    private readonly store = new AssetStore(),
    private readonly browserManager: BrowserManagerLike = new BrowserManager(),
  ) {}

  async init(): Promise<void> {
    await this.store.ensureReady();
  }

  async listAssets(): Promise<AssetRecord[]> {
    return this.store.listAssets();
  }

  async getAsset(id: string): Promise<AssetRecord> {
    const asset = await this.store.getAsset(id);

    if (!asset) {
      throw new NotFoundError(`No asset found for id "${id}".`);
    }

    return asset;
  }

  async createScreenshot(url: string): Promise<ScreenshotAssetRecord> {
    const normalizedUrl = normalizeScreenshotUrl(url);
    const id = randomUUID();
    const sourceFileName = getScreenshotFileName(normalizedUrl);
    const fileName = `${id}-${sourceFileName}`;
    const filePath = path.join(this.store.assetsDir, fileName);
    const screenshot = await captureScreenshotToPath(normalizedUrl, filePath, {
      browserManager: this.browserManager,
    });

    const asset: ScreenshotAssetRecord = {
      id,
      kind: "screenshot",
      createdAt: new Date().toISOString(),
      fileName,
      filePath: screenshot.filePath,
      width: screenshot.width,
      height: screenshot.height,
      sourceUrl: normalizedUrl,
    };

    await this.store.saveAsset(asset);
    return asset;
  }

  async createDiff(beforeAssetId: string, afterAssetId: string): Promise<DiffAssetRecord> {
    const beforeAsset = await this.getAsset(beforeAssetId);
    const afterAsset = await this.getAsset(afterAssetId);
    const id = randomUUID();
    const fileName = `${id}-diff.png`;
    const filePath = path.join(this.store.assetsDir, fileName);
    const diff = await diffPngImages(beforeAsset.filePath, afterAsset.filePath, {
      outputPath: filePath,
    });

    const asset: DiffAssetRecord = {
      id,
      kind: "diff",
      createdAt: new Date().toISOString(),
      fileName,
      filePath,
      width: diff.width,
      height: diff.height,
      beforeAssetId: beforeAsset.id,
      afterAssetId: afterAsset.id,
      mismatchPixels: diff.mismatchPixels,
      totalPixels: diff.totalPixels,
      diffRatio: diff.diffRatio,
    };

    await this.store.saveAsset(asset);
    return asset;
  }

  async dispose(): Promise<void> {
    await this.browserManager.dispose();
  }
}
