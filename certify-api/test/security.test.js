import { test } from "node:test";
import assert from "node:assert/strict";
import { computeHash, computeHashFor, hashMatches, toDateOnly } from "../src/services/certificateHasher.js";
import { renderDesignToHtml } from "../src/templates/designRenderer.js";

// ── Certificate tamper-evidence hash ─────────────────────────────────────────
test("computeHash is deterministic for the same input", () => {
  const d = { id: "a", organizationId: "o", recipientName: "x", recipientEmail: null, courseName: "c", issueDate: "2026-01-01", verificationCode: "CERT-1" };
  assert.equal(computeHash(d), computeHash(d));
});

test("hashMatches validates an untampered certificate and rejects tampering", () => {
  const cert = {
    id: "a", organizationId: "o", recipientName: "محمد",
    recipientEmail: "e@x.com", courseName: "دورة", issueDate: new Date("2026-01-01"),
    verificationCode: "CERT-ABCD-EFGH-IJKL-MNOP",
  };
  const verificationHash = computeHashFor(cert);
  assert.equal(hashMatches({ ...cert, verificationHash }), true);
  // any change to an immutable field must break the match
  assert.equal(hashMatches({ ...cert, recipientName: "مزوّر", verificationHash }), false);
  assert.equal(hashMatches({ ...cert, verificationCode: "CERT-XXXX", verificationHash }), false);
});

test("toDateOnly returns YYYY-MM-DD or null", () => {
  assert.equal(toDateOnly(new Date("2026-06-14T10:00:00Z")), "2026-06-14");
  assert.equal(toDateOnly(null), null);
});

// ── Design renderer: XSS / SSRF / injection safety ───────────────────────────
test("renderDesignToHtml escapes user text (no raw <script>)", () => {
  const html = renderDesignToHtml({ elements: [{ type: "text", left: 0, top: 0, text: "<script>alert(1)</script>" }] }, {}, "");
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.ok(html.includes("&lt;script&gt;"));
});

test("renderDesignToHtml substitutes variables and escapes their values", () => {
  const html = renderDesignToHtml({ elements: [{ type: "variable", variableKey: "recipient_name", left: 0, top: 0 }] }, { recipient_name: "<b>x</b>" }, "");
  assert.ok(html.includes("&lt;b&gt;x&lt;/b&gt;"));
});

test("image src rejects javascript: and SSRF hosts, allows data: and public https", () => {
  const render = (src) => renderDesignToHtml({ elements: [{ type: "image", left: 0, top: 0, width: 10, src }] }, {}, "");
  assert.match(render("javascript:alert(1)"), /src=""/);
  assert.match(render("http://localhost/x.png"), /src=""/);
  assert.match(render("http://169.254.169.254/latest/meta-data"), /src=""/);
  assert.match(render("http://192.168.1.5/p.png"), /src=""/);
  assert.ok(render("https://cdn.example.com/logo.png").includes('src="https://cdn.example.com/logo.png"'));
  assert.ok(render("data:image/png;base64,AAAA").includes('src="data:image/png;base64,AAAA"'));
});

test("unknown ornament name renders no SVG", () => {
  const html = renderDesignToHtml({ elements: [{ type: "ornament", name: "__nope__", left: 0, top: 0, width: 10 }] }, {}, "");
  assert.ok(!html.includes("<svg"));
});

test("rect fill cannot break out of the style attribute", () => {
  const html = renderDesignToHtml({ elements: [{ type: "rect", left: 0, top: 0, width: 10, height: 10, fill: 'red" onload="x' }] }, {}, "");
  assert.ok(!html.includes('onload="x'));
  assert.ok(html.includes("&quot;"));
});
