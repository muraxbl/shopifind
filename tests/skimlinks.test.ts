import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSkimlinksUrl,
  isSkimlinksEnabled,
  resolveClickoutUrl,
} from "../src/lib/skimlinks";

function withSkimlinksEnv(
  values: { enabled?: string; domainId?: string },
  run: () => void,
): void {
  const previousEnabled = process.env.SKIMLINKS_ENABLED;
  const previousDomainId = process.env.SKIMLINKS_DOMAIN_ID;
  if (values.enabled === undefined) delete process.env.SKIMLINKS_ENABLED;
  else process.env.SKIMLINKS_ENABLED = values.enabled;
  if (values.domainId === undefined) delete process.env.SKIMLINKS_DOMAIN_ID;
  else process.env.SKIMLINKS_DOMAIN_ID = values.domainId;
  try {
    run();
  } finally {
    if (previousEnabled === undefined) delete process.env.SKIMLINKS_ENABLED;
    else process.env.SKIMLINKS_ENABLED = previousEnabled;
    if (previousDomainId === undefined) delete process.env.SKIMLINKS_DOMAIN_ID;
    else process.env.SKIMLINKS_DOMAIN_ID = previousDomainId;
  }
}

test("buildSkimlinksUrl preserves the merchant URL and product attribution", () => {
  withSkimlinksEnv({ enabled: "true", domainId: "publisher-123" }, () => {
    const result = new URL(
      buildSkimlinksUrl(
        "https://merchant.example/product?a=1&b=2",
        "product-slug",
      ),
    );
    assert.equal(result.origin, "https://go.redirectingat.com");
    assert.equal(result.searchParams.get("id"), "publisher-123");
    assert.equal(
      result.searchParams.get("url"),
      "https://merchant.example/product?a=1&b=2",
    );
    assert.equal(result.searchParams.get("xcust"), "shopifind-product-slug");
  });
});

test("Skimlinks stays disabled unless both the strict flag and ID are present", () => {
  withSkimlinksEnv({ domainId: "rejected-publisher" }, () => {
    assert.equal(isSkimlinksEnabled(), false);
    assert.equal(
      resolveClickoutUrl({
        sourceUrl: "https://merchant.example/product",
        affiliateUrl: null,
        productSlug: "product-slug",
      }),
      "https://merchant.example/product",
    );
  });
  withSkimlinksEnv({ enabled: "TRUE", domainId: "publisher-123" }, () => {
    assert.equal(isSkimlinksEnabled(), false);
  });
});

test("a safe vendor affiliate URL wins over every aggregator", () => {
  withSkimlinksEnv({ enabled: "true", domainId: "publisher-123" }, () => {
    assert.equal(
      resolveClickoutUrl({
        sourceUrl: "https://merchant.example/product",
        affiliateUrl: "https://network.example/click?merchant=1",
        productSlug: "product-slug",
      }),
      "https://network.example/click?merchant=1",
    );
  });
});

test("an unsafe vendor URL is ignored and source URLs must be HTTPS", () => {
  withSkimlinksEnv({}, () => {
    assert.equal(
      resolveClickoutUrl({
        sourceUrl: "https://merchant.example/product",
        affiliateUrl: "javascript:alert(1)",
        productSlug: "product-slug",
      }),
      "https://merchant.example/product",
    );
    assert.throws(() =>
      resolveClickoutUrl({
        sourceUrl: "http://merchant.example/product",
        affiliateUrl: null,
        productSlug: "product-slug",
      }),
    );
  });
});
