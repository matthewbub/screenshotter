import assert from "node:assert/strict";
import test from "node:test";

import {
  getScreenshotFileName,
  normalizeScreenshotUrl,
} from "../src/screenshot.js";

test("normalizes valid http and https urls", () => {
  assert.equal(normalizeScreenshotUrl("https://example.com"), "https://example.com/");
  assert.equal(normalizeScreenshotUrl("http://example.com/path"), "http://example.com/path");
});

test("rejects invalid urls", () => {
  assert.throws(() => normalizeScreenshotUrl("not-a-url"), /Please provide a valid URL/);
});

test("preserves the previous filename sanitization behavior", () => {
  assert.equal(getScreenshotFileName("https://example.com"), "example.com.png");
  assert.equal(
    getScreenshotFileName("https://example.com/blog/post?ref=abc#section"),
    "example.com_blog_post_ref_abc_section.png",
  );
  assert.equal(getScreenshotFileName("https://example.com/"), "example.com.png");
});
