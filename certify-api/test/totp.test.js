import { test } from "node:test";
import assert from "node:assert/strict";
import { base32Encode, base32Decode, generate, verify, generateSecret, keyuri } from "../src/services/totp.js";

// RFC 6238 Appendix B reference seed (ASCII "12345678901234567890") and the
// SHA-1 test vectors. The RFC lists 8-digit codes; our 6-digit output is their
// last 6 digits (truncation mod 10^6).
const SECRET = base32Encode(Buffer.from("12345678901234567890"));

test("base32 round-trips arbitrary bytes", () => {
  for (const s of ["", "f", "fo", "foo", "foob", "fooba", "foobar"]) {
    assert.equal(base32Decode(base32Encode(Buffer.from(s))).toString(), s);
  }
});

test("TOTP matches RFC 6238 SHA-1 test vectors (6-digit)", () => {
  const cases = [
    [59, "287082"],
    [1111111109, "081804"],
    [1111111111, "050471"],
    [1234567890, "005924"],
    [2000000000, "279037"],
    [20000000000, "353130"],
  ];
  for (const [seconds, expected] of cases) {
    assert.equal(generate(SECRET, seconds * 1000), expected, `t=${seconds}`);
  }
});

test("verify accepts the current code and tolerates ±1 step drift", () => {
  const now = 1111111111 * 1000;
  assert.equal(verify(generate(SECRET, now), SECRET, { forTime: now }), true);
  // Previous and next 30s windows still pass (clock drift tolerance).
  assert.equal(verify(generate(SECRET, now - 30000), SECRET, { forTime: now }), true);
  assert.equal(verify(generate(SECRET, now + 30000), SECRET, { forTime: now }), true);
  // Two steps away is rejected.
  assert.equal(verify(generate(SECRET, now + 90000), SECRET, { forTime: now }), false);
});

test("verify rejects malformed / wrong codes", () => {
  const now = Date.now();
  assert.equal(verify("000000", SECRET, { forTime: now }), false);
  assert.equal(verify("abc", SECRET, { forTime: now }), false);
  assert.equal(verify("", SECRET, { forTime: now }), false);
  assert.equal(verify("12345", SECRET, { forTime: now }), false);
});

test("generateSecret is base32 and keyuri embeds it", () => {
  const s = generateSecret();
  assert.match(s, /^[A-Z2-7]+$/);
  const uri = keyuri("admin@x.com", s);
  assert.ok(uri.startsWith("otpauth://totp/Certify:admin%40x.com?"));
  assert.ok(uri.includes(`secret=${s}`));
});
