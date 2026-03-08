# screenshotter

`screenshotter` is a small Playwright-powered CLI that captures a full-page PNG for a URL.

## Install

```bash
pnpm install
```

## Run

Use either of these commands:

```bash
pnpm screenshot -- https://example.com
```

```bash
pnpm exec screenshotter https://example.com
```

The screenshot is written to the current directory and uses the URL as the filename, sanitized to match the previous behavior.

## CLI

```bash
screenshotter --help
```

The CLI requires a single `http://` or `https://` URL argument.
