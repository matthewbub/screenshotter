import { chromium } from "playwright";

export const DEFAULT_VIEWPORT = {
  width: 1440,
  height: 900,
} as const;

export function normalizeScreenshotUrl(input: string): string {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(input);
  } catch {
    throw new Error("Please provide a valid URL.");
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error("URL must start with http:// or https://.");
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

export async function captureScreenshot(url: string): Promise<string> {
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage({
      viewport: DEFAULT_VIEWPORT,
    });

    await page.goto(url, {
      waitUntil: "networkidle",
    });

    const fileName = getScreenshotFileName(url);

    await page.screenshot({
      path: fileName,
      fullPage: true,
    });

    return fileName;
  } finally {
    await browser.close();
  }
}
