import { mkdir } from "node:fs/promises";
import path from "node:path";

import { PNG } from "pngjs";
import { chromium, type Browser, type Page } from "playwright";

import { ValidationError } from "./errors.js";

export const DEFAULT_VIEWPORT = {
  width: 1440,
  height: 900,
} as const;

export type BrowserManagerLike = {
  withPage<T>(callback: (page: Page) => Promise<T>): Promise<T>;
  dispose(): Promise<void>;
};

export class BrowserManager implements BrowserManagerLike {
  private browserPromise?: Promise<Browser>;

  private async getBrowser(): Promise<Browser> {
    if (!this.browserPromise) {
      this.browserPromise = chromium.launch();
    }

    return this.browserPromise;
  }

  async withPage<T>(callback: (page: Page) => Promise<T>): Promise<T> {
    const browser = await this.getBrowser();
    const page = await browser.newPage({
      viewport: DEFAULT_VIEWPORT,
    });

    try {
      return await callback(page);
    } finally {
      await page.close();
    }
  }

  async dispose(): Promise<void> {
    if (!this.browserPromise) {
      return;
    }

    const browser = await this.browserPromise;
    this.browserPromise = undefined;
    await browser.close();
  }
}

export function normalizeScreenshotUrl(input: string): string {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(input);
  } catch {
    throw new ValidationError("Please provide a valid URL.");
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new ValidationError("URL must start with http:// or https://.");
  }

  return parsedUrl.toString();
}

export function getScreenshotFileName(url: string): string {
  const fileBaseName = url
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .replace(/[\/?#&=:%]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .trim();

  return fileBaseName.length > 0 ? `${fileBaseName}.png` : "screenshot.png";
}

export async function captureScreenshotToPath(
  url: string,
  outputPath: string,
  options: {
    browserManager?: BrowserManagerLike;
    delayMs?: number;
  } = {},
): Promise<{
  filePath: string;
  width: number;
  height: number;
}> {
  const browserManager = options.browserManager ?? new BrowserManager();
  const shouldDispose = options.browserManager === undefined;
  const delayMs = options.delayMs ?? 0;

  try {
    await mkdir(path.dirname(outputPath), { recursive: true });

    const screenshotBuffer = await browserManager.withPage(async (page) => {
      await page.goto(url, {
        waitUntil: "networkidle",
      });

      if (delayMs > 0) {
        await page.waitForTimeout(delayMs);
      }

      return page.screenshot({
        path: outputPath,
        fullPage: true,
      });
    });

    const image = PNG.sync.read(screenshotBuffer);

    return {
      filePath: outputPath,
      width: image.width,
      height: image.height,
    };
  } finally {
    if (shouldDispose) {
      await browserManager.dispose();
    }
  }
}

export async function captureScreenshot(
  url: string,
  options: { delayMs?: number } = {},
): Promise<string> {
  const fileName = getScreenshotFileName(url);
  await captureScreenshotToPath(url, fileName, { delayMs: options.delayMs });
  return fileName;
}
