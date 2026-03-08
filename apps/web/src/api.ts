export type Asset = {
  id: string;
  kind: "screenshot" | "diff";
  createdAt: string;
  fileName: string;
  fileUrl: string;
  width: number;
  height: number;
  sourceUrl?: string;
  beforeAssetId?: string;
  afterAssetId?: string;
  mismatchPixels?: number;
  totalPixels?: number;
  diffRatio?: number;
};

type ApiResponse<T> = {
  asset?: T;
  assets?: T[];
  error?: {
    code: string;
    message: string;
  };
};

async function readJson<T>(response: Response): Promise<ApiResponse<T>> {
  return (await response.json()) as ApiResponse<T>;
}

async function expectOk<T>(response: Response): Promise<ApiResponse<T>> {
  const payload = await readJson<T>(response);

  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Request failed.");
  }

  return payload;
}

export async function listAssets(): Promise<Asset[]> {
  const response = await fetch("/api/assets");
  const payload = await expectOk<Asset>(response);
  return payload.assets ?? [];
}

export async function createScreenshot(url: string): Promise<Asset> {
  const response = await fetch("/api/screenshots", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
  });
  const payload = await expectOk<Asset>(response);

  if (!payload.asset) {
    throw new Error("The API did not return a screenshot asset.");
  }

  return payload.asset;
}

export async function createDiff(beforeAssetId: string, afterAssetId: string): Promise<Asset> {
  const response = await fetch("/api/diffs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      beforeAssetId,
      afterAssetId,
    }),
  });
  const payload = await expectOk<Asset>(response);

  if (!payload.asset) {
    throw new Error("The API did not return a diff asset.");
  }

  return payload.asset;
}
