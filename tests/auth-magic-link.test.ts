import assert from "node:assert/strict";
import test from "node:test";
import {
  isSameOriginFormPost,
  isValidEmailTokenHash,
} from "../src/lib/auth/magic-link";

test("isValidEmailTokenHash accepts bounded URL-safe token hashes", () => {
  assert.equal(isValidEmailTokenHash("a".repeat(32)), true);
  assert.equal(isValidEmailTokenHash(`abc_${"Z".repeat(40)}-123`), true);
});

test("isValidEmailTokenHash rejects missing, short, oversized and unsafe values", () => {
  assert.equal(isValidEmailTokenHash(null), false);
  assert.equal(isValidEmailTokenHash("a".repeat(31)), false);
  assert.equal(isValidEmailTokenHash("a".repeat(513)), false);
  assert.equal(isValidEmailTokenHash(`${"a".repeat(31)}!`), false);
});

test("isSameOriginFormPost allows privacy omissions but rejects foreign origins", () => {
  const origin = "https://shopifind.app";
  assert.equal(isSameOriginFormPost(null, origin), true);
  assert.equal(isSameOriginFormPost(origin, origin), true);
  assert.equal(isSameOriginFormPost("https://attacker.example", origin), false);
});
