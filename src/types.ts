export type AssetKind = "screenshot" | "diff";

type BaseAssetRecord = {
  id: string;
  kind: AssetKind;
  createdAt: string;
  fileName: string;
  filePath: string;
  width: number;
  height: number;
};

export type ScreenshotAssetRecord = BaseAssetRecord & {
  kind: "screenshot";
  sourceUrl: string;
};

export type DiffAssetRecord = BaseAssetRecord & {
  kind: "diff";
  beforeAssetId: string;
  afterAssetId: string;
  mismatchPixels: number;
  totalPixels: number;
  diffRatio: number;
};

export type AssetRecord = ScreenshotAssetRecord | DiffAssetRecord;

type BasePublicAsset = Omit<BaseAssetRecord, "filePath"> & {
  fileUrl: string;
};

export type PublicScreenshotAsset = BasePublicAsset & {
  kind: "screenshot";
  sourceUrl: string;
};

export type PublicDiffAsset = BasePublicAsset & {
  kind: "diff";
  beforeAssetId: string;
  afterAssetId: string;
  mismatchPixels: number;
  totalPixels: number;
  diffRatio: number;
};

export type PublicAsset = PublicScreenshotAsset | PublicDiffAsset;
