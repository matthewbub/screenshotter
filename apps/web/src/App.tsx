import { startTransition, useDeferredValue, useEffect, useState } from "react";

import { createDiff, createScreenshot, listAssets, type Asset } from "./api";

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
    try {
      return new URL(asset.sourceUrl ?? "").hostname;
    } catch {
      return asset.fileName;
    }
  }

  return "Diff capture";
}

function assetSubtitle(asset: Asset): string {
  if (asset.kind === "screenshot") {
    return asset.sourceUrl ?? asset.fileName;
  }

  if (asset.mismatchPixels === undefined || asset.totalPixels === undefined || asset.diffRatio === undefined) {
    return asset.fileName;
  }

  return `${asset.mismatchPixels}/${asset.totalPixels} changed • ${formatPercent(asset.diffRatio)}`;
}

function findAsset(assets: Asset[], id: string): Asset | undefined {
  return assets.find((asset) => asset.id === id);
}

export function App() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [captureUrl, setCaptureUrl] = useState("https://example.com");
  const [beforeAssetId, setBeforeAssetId] = useState("");
  const [afterAssetId, setAfterAssetId] = useState("");
  const [viewerAssetId, setViewerAssetId] = useState("");
  const [libraryFilter, setLibraryFilter] = useState("");
  const [pageError, setPageError] = useState<string | null>(null);
  const [isLoadingAssets, setIsLoadingAssets] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isDiffing, setIsDiffing] = useState(false);
  const deferredFilter = useDeferredValue(libraryFilter.trim().toLowerCase());

  const screenshotAssets = assets.filter((asset) => asset.kind === "screenshot");
  const filteredAssets = (() => {
    if (deferredFilter.length === 0) {
      return assets;
    }

    return assets.filter((asset) => {
      return [
        assetTitle(asset),
        assetSubtitle(asset),
        asset.fileName,
      ]
        .join(" ")
        .toLowerCase()
        .includes(deferredFilter);
    });
  })();

  useEffect(() => {
    async function loadAssets() {
      try {
        setIsLoadingAssets(true);
        const nextAssets = await listAssets();
        setAssets(nextAssets);
        setPageError(null);
      } catch (error) {
        setPageError(error instanceof Error ? error.message : String(error));
      } finally {
        setIsLoadingAssets(false);
      }
    }

    void loadAssets();
  }, []);

  useEffect(() => {
    startTransition(() => {
      if (screenshotAssets.length >= 1 && beforeAssetId.length === 0) {
        setBeforeAssetId(screenshotAssets[0]?.id ?? "");
      }

      if (screenshotAssets.length >= 2 && afterAssetId.length === 0) {
        setAfterAssetId(screenshotAssets[1]?.id ?? screenshotAssets[0]?.id ?? "");
      } else if (screenshotAssets.length === 1 && afterAssetId.length === 0) {
        setAfterAssetId(screenshotAssets[0]?.id ?? "");
      }
    });
  }, [afterAssetId.length, beforeAssetId.length, screenshotAssets]);

  const beforeAsset = findAsset(screenshotAssets, beforeAssetId);
  const afterAsset = findAsset(screenshotAssets, afterAssetId);
  const latestDiff = assets.find((asset) => asset.kind === "diff");
  const viewerAsset = findAsset(assets, viewerAssetId);

  async function refreshAssets() {
    const nextAssets = await listAssets();
    setAssets(nextAssets);
  }

  async function handleCapture(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsCapturing(true);
      setPageError(null);
      const asset = await createScreenshot(captureUrl);
      await refreshAssets();
      startTransition(() => {
        setBeforeAssetId(asset.id);
        setAfterAssetId(beforeAssetId || asset.id);
      });
    } catch (error) {
      setPageError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsCapturing(false);
    }
  }

  async function handleDiff(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsDiffing(true);
      setPageError(null);
      await createDiff(beforeAssetId, afterAssetId);
      await refreshAssets();
    } catch (error) {
      setPageError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsDiffing(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Express 5 + Vite 7 + React 19</p>
          <h1>screenshotter</h1>
          <p className="hero-text">
            Capture full-page screenshots, compare any two PNG assets, and keep a visual history
            of every run in one place.
          </p>
        </div>
        <div className="hero-stats">
          <article>
            <span>assets</span>
            <strong>{assets.length}</strong>
          </article>
          <article>
            <span>screenshots</span>
            <strong>{screenshotAssets.length}</strong>
          </article>
          <article>
            <span>latest diff</span>
            <strong>{latestDiff ? formatPercent(latestDiff.diffRatio ?? 0) : "n/a"}</strong>
          </article>
        </div>
      </section>

      {pageError ? <p className="error-banner">{pageError}</p> : null}

      <section className="workspace-grid">
        <article className="panel panel-accent">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Capture</p>
              <h2>Take a fresh screenshot</h2>
            </div>
            <span className="status-pill">{isCapturing ? "Working" : "Ready"}</span>
          </div>

          <form className="stacked-form" onSubmit={handleCapture}>
            <label className="field">
              <span>URL</span>
              <input
                type="url"
                value={captureUrl}
                onChange={(event) => setCaptureUrl(event.target.value)}
                placeholder="https://example.com"
                required
              />
            </label>
            <button className="primary-button" disabled={isCapturing}>
              {isCapturing ? "Capturing..." : "Capture screenshot"}
            </button>
          </form>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Compare</p>
              <h2>Generate a red-pixel diff</h2>
            </div>
            <span className="status-pill">{isDiffing ? "Diffing" : "Idle"}</span>
          </div>

          <form className="stacked-form" onSubmit={handleDiff}>
            <label className="field">
              <span>Baseline asset</span>
              <select
                value={beforeAssetId}
                onChange={(event) => setBeforeAssetId(event.target.value)}
                required
              >
                <option value="">Select a screenshot</option>
                {screenshotAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {assetTitle(asset)} • {formatDate(asset.createdAt)}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Updated asset</span>
              <select
                value={afterAssetId}
                onChange={(event) => setAfterAssetId(event.target.value)}
                required
              >
                <option value="">Select a screenshot</option>
                {screenshotAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {assetTitle(asset)} • {formatDate(asset.createdAt)}
                  </option>
                ))}
              </select>
            </label>

            <button
              className="secondary-button"
              disabled={isDiffing || beforeAssetId.length === 0 || afterAssetId.length === 0}
            >
              {isDiffing ? "Rendering diff..." : "Create diff"}
            </button>
          </form>

          <div className="compare-preview">
            {[beforeAsset, afterAsset].map((asset, index) => (
              <div className="preview-card" key={asset?.id ?? index}>
                <p>{index === 0 ? "Before" : "After"}</p>
                {asset ? (
                  <>
                    <button
                      type="button"
                      className="image-button"
                      onClick={() => setViewerAssetId(asset.id)}
                    >
                      <img src={asset.fileUrl} alt={assetTitle(asset)} loading="lazy" />
                    </button>
                    <strong>{assetTitle(asset)}</strong>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setViewerAssetId(asset.id)}
                    >
                      View full screenshot
                    </button>
                  </>
                ) : (
                  <div className="preview-empty">Choose a screenshot</div>
                )}
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="library-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Library</p>
            <h2>Saved captures and diffs</h2>
          </div>
          <label className="filter-field">
            <span>Filter</span>
            <input
              type="search"
              value={libraryFilter}
              onChange={(event) => setLibraryFilter(event.target.value)}
              placeholder="Search by host, URL, or file"
            />
          </label>
        </div>

        {isLoadingAssets ? <p className="helper-copy">Loading saved assets...</p> : null}
        {!isLoadingAssets && filteredAssets.length === 0 ? (
          <p className="helper-copy">No assets yet. Capture a page to get started.</p>
        ) : null}

        <div className="asset-grid">
          {filteredAssets.map((asset) => (
            <article className="asset-card" key={asset.id}>
              <div className="asset-meta">
                <span className={`kind-badge kind-${asset.kind}`}>{asset.kind}</span>
                <span>{formatDate(asset.createdAt)}</span>
              </div>
              <button
                type="button"
                className="image-button card-image-button"
                onClick={() => setViewerAssetId(asset.id)}
              >
                <img src={asset.fileUrl} alt={assetTitle(asset)} loading="lazy" />
              </button>
              <div className="asset-copy">
                <h3>{assetTitle(asset)}</h3>
                <p>{assetSubtitle(asset)}</p>
                <span>
                  {asset.width} x {asset.height}
                </span>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setViewerAssetId(asset.id)}
                >
                  Open full image
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {viewerAsset ? (
        <section className="viewer-backdrop" aria-label="Full screenshot viewer">
          <div className="viewer-panel">
            <div className="viewer-header">
              <div>
                <p className="eyebrow">Full Viewer</p>
                <h2>{assetTitle(viewerAsset)}</h2>
                <p className="helper-copy">
                  {viewerAsset.width} x {viewerAsset.height}
                </p>
              </div>
              <div className="viewer-actions">
                <a
                  className="text-button text-button-link"
                  href={viewerAsset.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open raw file
                </a>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setViewerAssetId("")}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="viewer-scroll">
              <img
                className="viewer-image"
                src={viewerAsset.fileUrl}
                alt={assetTitle(viewerAsset)}
              />
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
