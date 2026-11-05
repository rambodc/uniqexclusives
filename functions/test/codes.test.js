import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_ATTEMPTS, MAX_SENDS_PER_HOUR, HOUR_MS, checkCode, cleanCode, codeDocId, hashCode, newCode, newSalt, normalizeEmail, sendWindow } from "../codes.js";

test("normalizeEmail trims, lower-cases and rejects junk", () => {
  assert.equal(normalizeEmail("  Rambod@Uniquem.CA "), "rambod@uniquem.ca");
  for (const bad of ["", "nope", "a@b", 5, null, "a b@c.d"]) assert.equal(normalizeEmail(bad), null);
});
test("codes are six digits", () => { for (let i = 0; i < 200; i++) assert.match(newCode(), /^\d{6}$/); });
test("cleanCode accepts spaced codes only when six digits", () => {
  assert.equal(cleanCode("123 456"), "123456"); assert.equal(cleanCode("12-34-56"), "123456");
  assert.equal(cleanCode("12345"), null); assert.equal(cleanCode("abcdef"), null); assert.equal(cleanCode(123456), null);
});
test("doc id hides the address", () => { assert.match(codeDocId("a@b.co"), /^[0-9a-f]{64}$/); assert.ok(!codeDocId("a@b.co").includes("a@b")); });
test("checkCode: ok, wrong, expired, burned", () => {
  const salt = newSalt(), now = 1_000_000, rec = { hash: hashCode("123456", salt), salt, expiresAt: now + 1000, attempts: 0 };
  assert.equal(checkCode(rec, "123456", now), "ok");
  assert.equal(checkCode(rec, "654321", now), "wrong");
  assert.equal(checkCode(rec, "123456", now + 1000), "dead");
  assert.equal(checkCode({ ...rec, attempts: MAX_ATTEMPTS }, "123456", now), "dead");
  assert.equal(checkCode(undefined, "123456", now), "dead");
  assert.equal(checkCode({ ...rec, hash: undefined }, "123456", now), "dead");
});
test("sendWindow allows five sends per rolling hour", () => {
  const now = 10 * HOUR_MS, sends = Array.from({ length: MAX_SENDS_PER_HOUR }, (_, i) => now - i * 60_000);
  assert.equal(sendWindow(sends, now).allowed, false);
  assert.equal(sendWindow(sends, now + HOUR_MS).allowed, true);
  assert.deepEqual(sendWindow([now - HOUR_MS - 1, now - 5], now).recent, [now - 5]);
  assert.equal(sendWindow(undefined, now).allowed, true);
});
