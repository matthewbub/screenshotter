import { Command, CommanderError } from "commander";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { diffPngImages, type ImageDiffResult } from "./diff.js";
import { captureScreenshot, normalizeScreenshotUrl } from "./screenshot.js";

type OutputWriter = (text: string) => void;

export type CliDependencies = {
  capture: (url: string) => Promise<string>;
  diffImages: (
    beforeImagePath: string,
    afterImagePath: string,
    options?: { outputPath?: string },
  ) => Promise<ImageDiffResult>;
  writeOut: OutputWriter;
  writeErr: OutputWriter;
  version: string;
};

function readVersion(): string {
  const packageJsonPath = new URL("../package.json", import.meta.url);
  const packageJson = JSON.parse(
    readFileSync(packageJsonPath, "utf8"),
  ) as { version?: string };

  return packageJson.version ?? "0.0.0";
}

function getDefaultDependencies(): CliDependencies {
  return {
    capture: captureScreenshot,
    diffImages: diffPngImages,
    writeOut: (text) => process.stdout.write(text),
    writeErr: (text) => process.stderr.write(text),
    version: readVersion(),
  };
}

export function createProgram(overrides: Partial<CliDependencies> = {}): Command {
  const dependencies = {
    ...getDefaultDependencies(),
    ...overrides,
  };

  const program = new Command()
    .name("screenshotter")
    .description("Capture screenshots and diff PNG images.")
    .version(dependencies.version)
    .showHelpAfterError();

  program
    .argument("<url>", "URL to capture")
    .action(async (inputUrl: string) => {
      const normalizedUrl = normalizeScreenshotUrl(inputUrl);
      const fileName = await dependencies.capture(normalizedUrl);

      dependencies.writeOut(`Saved screenshot to ${fileName}\n`);
    });

  program
    .command("diff")
    .description("Compare two PNG images and highlight differences in red.")
    .argument("<beforeImage>", "Baseline PNG image")
    .argument("<afterImage>", "Updated PNG image")
    .option("-o, --output <path>", "Output path for the diff image", "diff.png")
    .action(
      async (
        beforeImage: string,
        afterImage: string,
        options: { output: string },
      ) => {
        const result = await dependencies.diffImages(beforeImage, afterImage, {
          outputPath: options.output,
        });

        dependencies.writeOut(`Saved diff to ${result.outputPath}\n`);
        dependencies.writeOut(
          `Changed pixels: ${result.mismatchPixels}/${result.totalPixels} (${(result.diffRatio * 100).toFixed(2)}%)\n`,
        );
      },
    );

  program.configureOutput({
    writeOut: dependencies.writeOut,
    writeErr: dependencies.writeErr,
  });

  return program;
}

export async function executeCli(
  args: string[],
  overrides: Partial<CliDependencies> = {},
): Promise<number> {
  const dependencies = {
    ...getDefaultDependencies(),
    ...overrides,
  };
  const program = createProgram(dependencies);

  program.exitOverride();

  try {
    await program.parseAsync(args, { from: "user" });
    return 0;
  } catch (error) {
    if (error instanceof CommanderError) {
      return error.exitCode;
    }

    const message = error instanceof Error ? error.message : String(error);
    dependencies.writeErr(`${message}\n`);
    return 1;
  }
}

const isEntrypoint =
  process.argv[1] !== undefined &&
  pathToFileURL(process.argv[1]).href === import.meta.url;

if (isEntrypoint) {
  const exitCode = await executeCli(process.argv.slice(2));

  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}
