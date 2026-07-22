# screenshotter

`screenshotter` now includes three pieces:

- a Playwright-powered CLI for captures and PNG diffs
- an Express 5 API for storing screenshots and generating diffs
- a Vite 7 + React 19 interface for capture, compare, and browsing saved assets

## Install

```bash
pnpm install
```

## Run The UI And API

```bash
pnpm dev
```

- API: `http://localhost:4310`
- Web UI: `http://localhost:4173`

You can override those defaults with `SCREENSHOTTER_API_PORT` and `SCREENSHOTTER_WEB_PORT`.

To serve the API by itself:

```bash
pnpm serve
```

If you want Express to serve the built frontend too:

```bash
pnpm build:web
pnpm serve
```

Generated asset metadata and files are stored under `data/`.

## API Endpoints

- `GET /api/health`
- `GET /api/assets`
- `GET /api/assets/:id`
- `GET /api/assets/:id/file`
- `POST /api/screenshots` with `{ "url": "https://example.com" }`
- `POST /api/diffs` with `{ "beforeAssetId": "...", "afterAssetId": "..." }`

## CLI

Capture a page:

```bash
pnpm screenshot -- https://example.com
```

Or:

```bash
pnpm exec screenshotter https://example.com
```

Wait extra time after the page settles before capturing (useful for animations or lazy content):

```bash
pnpm exec screenshotter https://example.com --delay 2000
```

Diff two PNG files:

```bash
pnpm exec screenshotter diff before.png after.png --output diff.png
```

## Verification

```bash
pnpm typecheck
pnpm test
pnpm build:web
```
