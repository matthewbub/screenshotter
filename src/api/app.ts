import path from "node:path";
import { existsSync } from "node:fs";

import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { ZodError, z } from "zod";

import { AppError, ValidationError } from "../errors.js";
import { toPublicAsset, type AssetServiceLike } from "../assets.js";

const screenshotRequestSchema = z.object({
  url: z.string().trim().min(1, "Please provide a URL."),
});

const uploadScreenshotRequestSchema = z.object({
  fileName: z.string().trim().min(1, "Please choose an image to upload."),
  pngBase64: z.string().trim().min(1, "The uploaded image payload is missing."),
});

const diffRequestSchema = z.object({
  beforeAssetId: z.string().trim().min(1, "Please select a baseline asset."),
  afterAssetId: z.string().trim().min(1, "Please select an updated asset."),
});

function toValidationError(error: ZodError): ValidationError {
  return new ValidationError(
    error.issues.map((issue) => issue.message).join("; ") || "The request payload is invalid.",
  );
}

function attachWebApp(app: express.Express, webDistDir: string): void {
  const indexPath = path.join(webDistDir, "index.html");

  if (!existsSync(indexPath)) {
    app.get("/", (_request, response) => {
      response.type("html").send(`<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>screenshotter api</title></head>
  <body style="font-family: ui-sans-serif, system-ui, sans-serif; padding: 2rem;">
    <h1>screenshotter api</h1>
    <p>The Vite app has not been built yet. Run <code>pnpm build:web</code> or <code>pnpm dev</code>.</p>
  </body>
</html>`);
    });

    return;
  }

  app.use(express.static(webDistDir));
  app.get(/^(?!\/api\/).*/, (_request, response) => {
    response.sendFile(indexPath);
  });
}

export function createApiApp(options: {
  assetService: AssetServiceLike;
  webDistDir?: string;
}): express.Express {
  const app = express();
  const webDistDir = options.webDistDir ?? path.resolve(process.cwd(), "apps/web/dist");

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_request, response) => {
    response.json({ ok: true });
  });

  app.get("/api/assets", async (_request, response, next) => {
    try {
      const assets = await options.assetService.listAssets();
      response.json({
        assets: assets.map(toPublicAsset),
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/assets/:id", async (request, response, next) => {
    try {
      const asset = await options.assetService.getAsset(request.params.id);
      response.json({
        asset: toPublicAsset(asset),
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/assets/:id/file", async (request, response, next) => {
    try {
      const asset = await options.assetService.getAsset(request.params.id);
      response.sendFile(asset.filePath);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/screenshots", async (request, response, next) => {
    try {
      const payload = screenshotRequestSchema.parse(request.body);
      const asset = await options.assetService.createScreenshot(payload.url);

      response.status(201).json({
        asset: toPublicAsset(asset),
      });
    } catch (error) {
      next(error instanceof ZodError ? toValidationError(error) : error);
    }
  });

  app.post("/api/uploads", async (request, response, next) => {
    try {
      const payload = uploadScreenshotRequestSchema.parse(request.body);
      const asset = await options.assetService.uploadScreenshot(payload);

      response.status(201).json({
        asset: toPublicAsset(asset),
      });
    } catch (error) {
      next(error instanceof ZodError ? toValidationError(error) : error);
    }
  });

  app.post("/api/diffs", async (request, response, next) => {
    try {
      const payload = diffRequestSchema.parse(request.body);
      const asset = await options.assetService.createDiff(
        payload.beforeAssetId,
        payload.afterAssetId,
      );

      response.status(201).json({
        asset: toPublicAsset(asset),
      });
    } catch (error) {
      next(error instanceof ZodError ? toValidationError(error) : error);
    }
  });

  attachWebApp(app, webDistDir);

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof AppError) {
      response.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
        },
      });
      return;
    }

    const message = error instanceof Error ? error.message : "Unexpected server error.";
    response.status(500).json({
      error: {
        code: "internal_error",
        message,
      },
    });
  });

  return app;
}
