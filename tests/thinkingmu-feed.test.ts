import assert from "node:assert/strict";
import test from "node:test";
import { buildThinkingMuProduct } from "../src/lib/feeds/thinkingmu";

const PAYLOAD = {
  id: "gid://shopify/Product/8100832674082",
  handle: "bermuda-navy-hemp-alex",
  title: "Bermuda azul hemp Alex",
  description: {
    html: "<p>Prenda de cáñamo mezclado con algodón orgánico.</p>",
  },
  price_range: {
    min: { amount: 4990, currency: "EUR" },
    max: { amount: 5990, currency: "EUR" },
  },
  media: [
    {
      type: "image",
      url: "https://cdn.shopify.com/s/files/1/0578/8001/8989/files/alex.jpg?v=1",
    },
  ],
  tags: [],
  variants: [
    {
      id: "gid://shopify/ProductVariant/50000000000001",
      sku: "MST00039-S",
      title: "S",
      price: { amount: 5490, currency: "EUR" },
      availability: { available: true },
      options: [{ name: "Talla", label: "S" }],
    },
  ],
  url: "https://thinkingmu.com/products/bermuda-navy-hemp-alex",
};

test("Thinking MU mapping uses an available price and product-level material evidence", () => {
  const product = buildThinkingMuProduct({
    payload: PAYLOAD,
    storeId: "store-id",
    observedAt: "2026-07-29T00:00:00.000Z",
  });
  assert.equal(product.price_cents, 5490);
  assert.equal(product.attributes.materials, "organic cotton, hemp");
  assert.equal(product.attributes.options, "Talla: S");
  assert.deepEqual(product.eco_tags, [
    "cotton",
    "long-lifespan",
    "low-impact",
    "low-water",
    "organic",
  ]);
});

test("Thinking MU mapping rejects unsupported origins and missing materials", () => {
  assert.throws(() =>
    buildThinkingMuProduct({
      payload: {
        ...PAYLOAD,
        url: "https://example.com/products/bermuda-navy-hemp-alex",
      },
      storeId: "store-id",
      observedAt: "2026-07-29T00:00:00.000Z",
    }),
  );
  assert.throws(() =>
    buildThinkingMuProduct({
      payload: {
        ...PAYLOAD,
        description: { html: "<p>Una prenda sin composición publicada.</p>" },
      },
      storeId: "store-id",
      observedAt: "2026-07-29T00:00:00.000Z",
    }),
  );
});
