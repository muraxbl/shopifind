import assert from "node:assert/strict";
import test from "node:test";
import {
  chunkShopifyLookupIds,
  mergeShopifyLookupPayloads,
  parseCuratedShopifyLookup,
} from "../src/lib/feeds/shopifyUcp";

function product(id: number) {
  return {
    id: `gid://shopify/Product/${id}`,
    handle: `product-${id}`,
    title: `Product ${id}`,
    description: { html: "Description" },
    price_range: {
      min: { amount: 1000, currency: "EUR" },
      max: { amount: 1000, currency: "EUR" },
    },
    media: [{ type: "image", url: `https://example.com/${id}.jpg` }],
    tags: [],
    variants: [
      {
        id: `gid://shopify/ProductVariant/${id}`,
        price: { amount: 1000, currency: "EUR" },
        availability: { available: true },
        options: [],
      },
    ],
    url: `https://example.com/products/product-${id}`,
  };
}

function payload(ids: number[]) {
  return {
    result: { structuredContent: { products: ids.map(product) } },
  };
}

test("Shopify storefront lookup chunks pilots at the ten-ID protocol cap", () => {
  const ids = Array.from(
    { length: 12 },
    (_, index) => `gid://shopify/Product/${index + 1}`,
  );
  assert.deepEqual(
    chunkShopifyLookupIds(ids).map((chunk) => chunk.length),
    [10, 2],
  );
  assert.throws(() => chunkShopifyLookupIds([]));
  assert.throws(() => chunkShopifyLookupIds([ids[0]!, ids[0]!]));
});

test("Shopify lookup payloads merge before exact curated-set validation", () => {
  const ids = Array.from(
    { length: 12 },
    (_, index) => `gid://shopify/Product/${index + 1}`,
  );
  const merged = mergeShopifyLookupPayloads([
    payload(Array.from({ length: 10 }, (_, index) => index + 1)),
    payload([11, 12]),
  ]);
  assert.deepEqual(
    parseCuratedShopifyLookup({
      payload: merged,
      productIds: ids,
      merchant: "Fixture",
    }).map((entry) => entry.id),
    ids,
  );
  assert.throws(() => mergeShopifyLookupPayloads([payload([1]), payload([1])]));
  assert.throws(
    () =>
      parseCuratedShopifyLookup({
        payload: payload([1]),
        productIds: ["gid://shopify/Product/1", "gid://shopify/Product/2"],
        merchant: "Fixture",
      }),
    /missing=gid:\/\/shopify\/Product\/2/,
  );
});
