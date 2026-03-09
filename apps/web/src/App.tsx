import { startTransition, useEffect, useState } from "react";

import { createDiff, createScreenshot, listAssets, uploadScreenshot, type Asset } from "./api";

type Tab = "capture" | "compare";
type LibraryFilter = "all" | "captures" | "uploads" | "diffs";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function assetTitle(asset: Asset): string {
  if (asset.kind === "screenshot") {
    if (asset.source === "upload") {
      return asset.originalFileName ?? "Uploaded image";
    }
    try {
      return new URL(asset.sourceUrl ?? "").hostname;
    } catch {
      return asset.fileName;
    }
  }
  return "Diff";
}

function assetSubtitle(asset: Asset): string {
  if (asset.kind === "screenshot") {
    return asset.source === "upload" ? "Uploaded photo" : asset.sourceUrl ?? asset.fileName;
  }
  if (
    asset.mismatchPixels === undefined ||
    asset.totalPixels === undefined ||
    asset.diffRatio === undefined
  ) {
    return asset.fileName;
  }
  return `${asset.mismatchPixels.toLocaleString()} px · ${formatPercent(asset.diffRatio)}`;
}

function findAsset(assets: Asset[], id: string): Asset | undefined {
  return assets.find((a) => a.id === id);
}

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>("capture");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [captureUrl, setCaptureUrl] = useState("https://example.com");
  const [beforeAssetId, setBeforeAssetId] = useState("");
  const [afterAssetId, setAfterAssetId] = useState("");
  const [viewerAssetId, setViewerAssetId] = useState("");
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>("all");
  const [pageError, setPageError] = useState<string | null>(null);
  const [isLoadingAssets, setIsLoadingAssets] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDiffing, setIsDiffing] = useState(false);
  const [lastCapturedId, setLastCapturedId] = useState("");

  const screenshotAssets = assets.filter((a) => a.kind === "screenshot");
  const diffAssets = assets.filter((a) => a.kind === "diff");

  const filteredAssets = assets.filter((asset) => {
    switch (libraryFilter) {
      case "captures":
        return asset.kind === "screenshot" && asset.source === "capture";
      case "uploads":
        return asset.kind === "screenshot" && asset.source === "upload";
      case "diffs":
        return asset.kind === "diff";
      default:
        return true;
    }
  });

  useEffect(() => {
    async function load() {
      try {
        setIsLoadingAssets(true);
        const next = await listAssets();
        setAssets(next);
        setPageError(null);
      } catch (e) {
        setPageError(e instanceof Error ? e.message : String(e));
      } finally {
        setIsLoadingAssets(false);
      }
    }
    void load();
  }, []);

  useEffect(() => {
    startTransition(() => {
      if (screenshotAssets.length >= 1 && !beforeAssetId) {
        setBeforeAssetId(screenshotAssets[0]?.id ?? "");
      }
      if (screenshotAssets.length >= 2 && !afterAssetId) {
        setAfterAssetId(screenshotAssets[1]?.id ?? screenshotAssets[0]?.id ?? "");
      } else if (screenshotAssets.length === 1 && !afterAssetId) {
        setAfterAssetId(screenshotAssets[0]?.id ?? "");
      }
    });
  }, [afterAssetId, beforeAssetId, screenshotAssets]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setViewerAssetId("");
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const beforeAsset = findAsset(screenshotAssets, beforeAssetId);
  const afterAsset = findAsset(screenshotAssets, afterAssetId);
  const viewerAsset = findAsset(assets, viewerAssetId);
  const lastCaptured = findAsset(assets, lastCapturedId);

  async function refreshAssets() {
    const next = await listAssets();
    setAssets(next);
  }

  async function handleCapture(e: React.FormEvent) {
    e.preventDefault();
    try {
      setIsCapturing(true);
      setPageError(null);
      const asset = await createScreenshot(captureUrl);
      await refreshAssets();
      setLastCapturedId(asset.id);
      startTransition(() => {
        setBeforeAssetId(asset.id);
        setAfterAssetId(beforeAssetId || asset.id);
      });
    } catch (e) {
      setPageError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsCapturing(false);
    }
  }

  async function fileToPngBase64(file: File): Promise<string> {
    const objectUrl = URL.createObjectURL(file);

    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error("The selected file could not be read as an image."));
        element.src = objectUrl;
      });

      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;

      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("This browser could not prepare the uploaded image.");
      }

      context.drawImage(image, 0, 0);

      const dataUrl = canvas.toDataURL("image/png");
      const [, base64 = ""] = dataUrl.split(",", 2);
      if (!base64) {
        throw new Error("The uploaded image could not be converted to PNG.");
      }

      return base64;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";

    if (!file) return;

    try {
      setIsUploading(true);
      setPageError(null);
      const pngBase64 = await fileToPngBase64(file);
      const asset = await uploadScreenshot(file.name, pngBase64);
      await refreshAssets();
      setLastCapturedId(asset.id);
      startTransition(() => {
        setActiveTab("compare");
        setBeforeAssetId(asset.id);
        setAfterAssetId(beforeAssetId || asset.id);
      });
    } catch (e) {
      setPageError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDiff(e: React.FormEvent) {
    e.preventDefault();
    try {
      setIsDiffing(true);
      setPageError(null);
      await createDiff(beforeAssetId, afterAssetId);
      await refreshAssets();
    } catch (e) {
      setPageError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsDiffing(false);
    }
  }

  return (
    <>
      <header className="site-header">
        <span className="site-logo">screen<span>shotter</span></span>
        <div className="site-stats">
          <span>{screenshotAssets.length} screenshots</span>
          <span>{diffAssets.length} diffs</span>
        </div>
      </header>

      <div className="page">
        <div className="tool-card">
          <div className="tool-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={activeTab === "capture"}
              className="tool-tab"
              onClick={() => setActiveTab("capture")}
            >
              Capture
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "compare"}
              className="tool-tab"
              onClick={() => setActiveTab("compare")}
            >
              Compare
            </button>
          </div>

          <div className="tool-body">
            {activeTab === "capture" && (
              <div role="tabpanel">
                <form className="capture-row" onSubmit={handleCapture}>
                  <input
                    className="text-input"
                    type="url"
                    value={captureUrl}
                    onChange={(e) => setCaptureUrl(e.target.value)}
                    placeholder="https://example.com"
                    required
                    disabled={isCapturing}
                  />
                  <button className="btn btn-primary" disabled={isCapturing}>
                    {isCapturing ? "Capturing…" : "Capture"}
                  </button>
                </form>

                <div className="upload-panel">
                  <div>
                    <div className="capture-result-label">Upload Your Own Photo</div>
                    <p className="upload-copy">
                      Add a local image to the library so you can diff it in Compare.
                    </p>
                  </div>
                  <label className="btn btn-outline upload-btn">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUpload}
                      disabled={isUploading}
                    />
                    {isUploading ? "Uploading…" : "Upload photo"}
                  </label>
                </div>

                {lastCaptured && (
                  <div className="capture-result">
                    <div className="capture-result-label">Result</div>
                    <button
                      type="button"
                      className="capture-preview-btn"
                      onClick={() => setViewerAssetId(lastCaptured.id)}
                    >
                      <img src={lastCaptured.fileUrl} alt={assetTitle(lastCaptured)} />
                      <div className="capture-preview-meta">
                        <strong>{assetTitle(lastCaptured)}</strong>
                        <span>{lastCaptured.width} × {lastCaptured.height}</span>
                        <span>{formatDate(lastCaptured.createdAt)}</span>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === "compare" && (
              <div role="tabpanel">
                {screenshotAssets.length < 2 ? (
                  <p className="compare-need-more">
                    Capture at least two pages to compare them.
                  </p>
                ) : (
                  <form onSubmit={handleDiff}>
                    <div className="compare-layout">
                      <div className="compare-col">
                        <label className="field-label" htmlFor="before-select">Before</label>
                        <select
                          id="before-select"
                          className="select-input"
                          value={beforeAssetId}
                          onChange={(e) => setBeforeAssetId(e.target.value)}
                          required
                        >
                          <option value="">Select screenshot</option>
                          {screenshotAssets.map((a) => (
                            <option key={a.id} value={a.id}>
                              {assetTitle(a)} · {formatDate(a.createdAt)}
                            </option>
                          ))}
                        </select>
                        <div className="preview-frame">
                          {beforeAsset ? (
                            <button
                              type="button"
                              className="preview-frame-btn"
                              onClick={() => setViewerAssetId(beforeAsset.id)}
                            >
                              <img src={beforeAsset.fileUrl} alt={assetTitle(beforeAsset)} />
                            </button>
                          ) : (
                            <div className="preview-frame-empty">No screenshot</div>
                          )}
                        </div>
                      </div>

                      <div className="compare-mid">
                        <span className="compare-arrow">→</span>
                        <button
                          className="btn btn-primary"
                          disabled={isDiffing || !beforeAssetId || !afterAssetId}
                        >
                          {isDiffing ? "Diffing…" : "Diff"}
                        </button>
                      </div>

                      <div className="compare-col">
                        <label className="field-label" htmlFor="after-select">After</label>
                        <select
                          id="after-select"
                          className="select-input"
                          value={afterAssetId}
                          onChange={(e) => setAfterAssetId(e.target.value)}
                          required
                        >
                          <option value="">Select screenshot</option>
                          {screenshotAssets.map((a) => (
                            <option key={a.id} value={a.id}>
                              {assetTitle(a)} · {formatDate(a.createdAt)}
                            </option>
                          ))}
                        </select>
                        <div className="preview-frame">
                          {afterAsset ? (
                            <button
                              type="button"
                              className="preview-frame-btn"
                              onClick={() => setViewerAssetId(afterAsset.id)}
                            >
                              <img src={afterAsset.fileUrl} alt={assetTitle(afterAsset)} />
                            </button>
                          ) : (
                            <div className="preview-frame-empty">No screenshot</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>

        {pageError && (
          <div className="error-banner" role="alert">
            <strong>Error:</strong> {pageError}
            <button onClick={() => setPageError(null)} aria-label="Dismiss">✕</button>
          </div>
        )}

        <div className="library-card">
          <div className="library-top">
            <h2 className="library-heading">Library</h2>
            <select
              className="search-input"
              value={libraryFilter}
              onChange={(e) => setLibraryFilter(e.target.value as LibraryFilter)}
              aria-label="Filter library"
            >
              <option value="all">All assets</option>
              <option value="captures">Captured screenshots</option>
              <option value="uploads">Uploaded photos</option>
              <option value="diffs">Diffs</option>
            </select>
          </div>
          <div className="library-body">
            {isLoadingAssets && <p className="library-empty">Loading…</p>}
            {!isLoadingAssets && filteredAssets.length === 0 && (
              <p className="library-empty">
                {libraryFilter === "all"
                  ? "Nothing here yet — capture a page to get started."
                  : "No assets in this filter yet."}
              </p>
            )}
            <div className="asset-grid">
              {filteredAssets.map((asset) => (
                <article key={asset.id} className="asset-card">
                  <button
                    type="button"
                    className="asset-thumb-btn"
                    onClick={() => setViewerAssetId(asset.id)}
                  >
                    <img src={asset.fileUrl} alt={assetTitle(asset)} loading="lazy" />
                  </button>
                  <div className="asset-meta">
                    <div className="asset-meta-row">
                        <span className={`badge badge-${asset.kind}`}>{asset.kind}</span>
                      {asset.kind === "screenshot" && asset.source === "upload" && (
                        <span className="badge badge-upload">upload</span>
                      )}
                      <span className="asset-date">{formatDate(asset.createdAt)}</span>
                    </div>
                    <span className="asset-name">{assetTitle(asset)}</span>
                    <span className="asset-sub">{assetSubtitle(asset)}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>

      {viewerAsset && (
        <div
          className="viewer-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewerAssetId("");
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Image viewer"
        >
          <div className="viewer">
            <div className="viewer-topbar">
              <div>
                <span className="viewer-topbar-title">{assetTitle(viewerAsset)}</span>
                <span className="viewer-topbar-sub">
                  {" "}· {viewerAsset.width} × {viewerAsset.height}
                </span>
              </div>
              <div className="viewer-topbar-actions">
                <a
                  href={viewerAsset.fileUrl}
                  download={viewerAsset.fileName}
                  className="btn btn-primary"
                >
                  Download
                </a>
                <a
                  href={viewerAsset.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-outline"
                >
                  Open file
                </a>
                <button className="btn btn-outline" onClick={() => setViewerAssetId("")}>
                  Close
                </button>
              </div>
            </div>
            <div className="viewer-body">
              <img
                className="viewer-img"
                src={viewerAsset.fileUrl}
                alt={assetTitle(viewerAsset)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
