import assert from "node:assert/strict";
import test from "node:test";
import {
  isProtectedPath,
  safeAuthRedirectNext,
  safeNextPath,
} from "../src/lib/auth/redirect";

test("safeNextPath keeps valid internal paths and query strings", () => {
  assert.equal(safeNextPath("/wishlist"), "/wishlist");
  assert.equal(
    safeNextPath("/product/example?from=login"),
    "/product/example?from=login",
  );
});

test("safeNextPath rejects external and encoded redirect payloads", () => {
  const fallback = "/wishlist";
  assert.equal(safeNextPath("https://attacker.example", fallback), fallback);
  assert.equal(safeNextPath("//attacker.example/path", fallback), fallback);
  assert.equal(safeNextPath("/%2f%2fattacker.example", fallback), fallback);
  assert.equal(safeNextPath("/%5c%5cattacker.example", fallback), fallback);
  assert.equal(safeNextPath("/%E0%A4%A", fallback), fallback);
});

test("isProtectedPath matches route boundaries, not lookalike prefixes", () => {
  const protectedPaths = ["/wishlist", "/account", "/settings"];
  assert.equal(isProtectedPath("/wishlist", protectedPaths), true);
  assert.equal(isProtectedPath("/wishlist/shared", protectedPaths), true);
  assert.equal(isProtectedPath("/wishlist-public", protectedPaths), false);
  assert.equal(isProtectedPath("/accounting", protectedPaths), false);
});

test("safeAuthRedirectNext unwraps only the canonical same-origin callback", () => {
  const origin = "https://shopifind.app";
  assert.equal(
    safeAuthRedirectNext(
      "https://shopifind.app/api/auth/callback?next=%2Faccount",
      origin,
      "/wishlist",
    ),
    "/account",
  );
  assert.equal(
    safeAuthRedirectNext(
      "https://shopifind.app/api/auth/callback?next=%2Fproduct%2Flamp%3Ffrom%3Dlogin",
      origin,
      "/wishlist",
    ),
    "/product/lamp?from=login",
  );
});

test("safeAuthRedirectNext rejects foreign, malformed and unexpected wrappers", () => {
  const origin = "https://shopifind.app";
  const fallback = "/wishlist";
  assert.equal(
    safeAuthRedirectNext(
      "https://attacker.example/api/auth/callback?next=%2Faccount",
      origin,
      fallback,
    ),
    fallback,
  );
  assert.equal(
    safeAuthRedirectNext(
      "https://shopifind.app/other?next=%2Faccount",
      origin,
      fallback,
    ),
    fallback,
  );
  assert.equal(
    safeAuthRedirectNext(
      "https://shopifind.app/api/auth/callback?next=%2F%252f%252fattacker.example",
      origin,
      fallback,
    ),
    fallback,
  );
  assert.equal(safeAuthRedirectNext("not a URL", origin, fallback), fallback);
});
