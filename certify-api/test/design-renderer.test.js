import { test } from "node:test";
import assert from "node:assert/strict";
import { renderDesignToHtml } from "../src/templates/designRenderer.js";

const base = {
  width: 1123,
  height: 794,
  background: "#fef3c7",
  elements: [{ type: "text", left: 100, top: 100, text: "مرحبا" }],
};

test("renders the background color on the stage", () => {
  const html = renderDesignToHtml(base, {}, "");
  assert.match(html, /background-color: #fef3c7/);
});

test("injects a public https background image with cover sizing", () => {
  const html = renderDesignToHtml(
    { ...base, backgroundImage: "https://cdn.example.com/bg.png" },
    {},
    "",
  );
  assert.match(html, /background-image:url\("https:\/\/cdn\.example\.com\/bg\.png"\)/);
  assert.match(html, /background-size:cover/);
});

test("drops an internal/SSRF background image (safeImageSrc guard)", () => {
  for (const bad of [
    "http://169.254.169.254/latest/meta-data",
    "http://localhost:8000/storage/x.png",
    "file:///etc/passwd",
    "javascript:alert(1)",
  ]) {
    const html = renderDesignToHtml({ ...base, backgroundImage: bad }, {}, "");
    assert.doesNotMatch(html, /background-image:url/, `should drop: ${bad}`);
  }
});

test("no background-image rule when none is set", () => {
  const html = renderDesignToHtml(base, {}, "");
  assert.doesNotMatch(html, /background-image:url/);
});
