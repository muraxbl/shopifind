import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMerchantReferralUrl,
  normalizeClickoutPlacement,
  resolveClickoutTarget,
  resolveClickoutUrl,
} from "../src/lib/affiliate";

test("a safe approved affiliate URL wins without being mutated", () => {
  const result = resolveClickoutTarget({
    sourceUrl: "https://merchant.example/product",
    affiliateUrl: "https://network.example/click?merchant=1",
    productSlug: "product-slug",
    placement: "compare",
  });
  assert.equal(result.url, "https://network.example/click?merchant=1");
  assert.equal(result.channel, "merchant_affiliate");
  assert.equal(result.merchantHost, "merchant.example");
  assert.equal(result.targetHost, "network.example");
  assert.equal(result.utmApplied, false);
});

test("a canonical destination receives stable Shopifind UTMs", () => {
  const result = new URL(
    resolveClickoutUrl({
      sourceUrl: "https://merchant.example/product?variant=blue",
      affiliateUrl: null,
      productSlug: "desk-lamp",
      placement: "pdp",
    }),
  );
  assert.equal(result.searchParams.get("variant"), "blue");
  assert.equal(result.searchParams.get("utm_source"), "shopifind");
  assert.equal(result.searchParams.get("utm_medium"), "referral");
  assert.equal(result.searchParams.get("utm_campaign"), "product_discovery");
  assert.equal(result.searchParams.get("utm_content"), "pdp-desk-lamp");
});

test("unsafe affiliate URLs are ignored and source URLs must be HTTPS", () => {
  const result = resolveClickoutTarget({
    sourceUrl: "https://merchant.example/product",
    affiliateUrl: "javascript:alert(1)",
    productSlug: "product-slug",
  });
  assert.equal(result.channel, "referral");
  assert.equal(new URL(result.url).searchParams.get("utm_source"), "shopifind");
  assert.throws(() =>
    resolveClickoutUrl({
      sourceUrl: "http://merchant.example/product",
      affiliateUrl: null,
      productSlug: "product-slug",
    }),
  );
});

test("merchant attribution normalizes placement and overwrites stale UTMs", () => {
  const result = new URL(
    buildMerchantReferralUrl({
      sourceUrl: "https://merchant.example/product?utm_source=old",
      productSlug: "desk-lamp",
      placement: normalizeClickoutPlacement("compare"),
    }),
  );
  assert.equal(result.searchParams.get("utm_source"), "shopifind");
  assert.equal(result.searchParams.get("utm_content"), "compare-desk-lamp");
  assert.equal(normalizeClickoutPlacement("poisoned-value"), "unknown");
});
