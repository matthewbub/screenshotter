import assert from "node:assert/strict";
import test from "node:test";

import { executeCli } from "../src/cli.js";

function createWriters() {
  const stdout: string[] = [];
  const stderr: string[] = [];

  return {
    stdout,
    stderr,
    writeOut: (text: string) => {
      stdout.push(text);
    },
    writeErr: (text: string) => {
      stderr.push(text);
    },
  };
}

test("shows help output", async () => {
  const writers = createWriters();

  const exitCode = await executeCli(["--help"], {
    version: "1.2.3",
    writeOut: writers.writeOut,
    writeErr: writers.writeErr,
  });

  assert.equal(exitCode, 0);
  assert.match(writers.stdout.join(""), /Usage: screenshotter \[options\] <url>/);
});

test("rejects a missing url argument", async () => {
  const writers = createWriters();

  const exitCode = await executeCli([], {
    version: "1.2.3",
    writeOut: writers.writeOut,
    writeErr: writers.writeErr,
  });

  assert.equal(exitCode, 1);
  assert.match(writers.stderr.join(""), /missing required argument 'url'/i);
});

test("rejects unsupported protocols", async () => {
  const writers = createWriters();

  const exitCode = await executeCli(["ftp://example.com"], {
    capture: async () => {
      throw new Error("capture should not run");
    },
    version: "1.2.3",
    writeOut: writers.writeOut,
    writeErr: writers.writeErr,
  });

  assert.equal(exitCode, 1);
  assert.match(writers.stderr.join(""), /URL must start with http:\/\/ or https:\/\//);
});

test("passes a normalized url to the capture step", async () => {
  const writers = createWriters();
  const capturedUrls: string[] = [];

  const exitCode = await executeCli(["https://example.com"], {
    capture: async (url) => {
      capturedUrls.push(url);
      return "example.com.png";
    },
    version: "1.2.3",
    writeOut: writers.writeOut,
    writeErr: writers.writeErr,
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(capturedUrls, ["https://example.com/"]);
  assert.match(writers.stdout.join(""), /Saved screenshot to example\.com\.png/);
});
