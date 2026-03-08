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

## Diff Two Images

Compare two PNG images and generate a diff image with red-highlighted changes:

```bash
pnpm exec screenshotter diff before.png after.png --output diff.png
```

The diff command reports the changed pixel count and writes the resulting PNG to the output path.

## CLI

```bash
screenshotter --help
```

The root command requires a single `http://` or `https://` URL argument. The `diff` subcommand currently supports PNG inputs.
