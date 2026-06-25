import { test } from "node:test";
import assert from "node:assert/strict";
import { csvField } from "../src/controllers/certificateController.js";

// Guards the certificate CSV export against spreadsheet formula injection while
// keeping RFC 4180 quoting intact.

test("neutralizes formula-injection leading characters", () => {
  for (const dangerous of ["=HYPERLINK(\"x\")", "+1+1", "-2", "@SUM(A1)"]) {
    const out = csvField(dangerous);
    assert.ok(out.startsWith("'") || out.startsWith('"\''), `should be quoted/prefixed: ${out}`);
  }
});

test("quotes fields with comma/quote/newline (RFC 4180)", () => {
  assert.equal(csvField("a,b"), '"a,b"');
  assert.equal(csvField('he said "hi"'), '"he said ""hi"""');
  assert.equal(csvField("line1\nline2"), '"line1\nline2"');
});

test("leaves plain values untouched", () => {
  assert.equal(csvField("أحمد محمد"), "أحمد محمد");
  assert.equal(csvField("Course 101"), "Course 101");
  assert.equal(csvField(null), "");
});
