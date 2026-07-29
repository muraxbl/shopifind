import assert from "node:assert/strict";
import test from "node:test";
import { buildShiftcamProduct } from "../src/lib/feeds/shiftcam";

const PAYLOAD = {
  id: "gid://shopify/Product/7410824839227",
  handle: "snapgrip-pro",
  title: "SnapGrip Pro*",
  description: { html: "<p>A modular mobile photography grip.</p>" },
  price_range: {
    min: { amount: 9999, currency: "EUR" },
    max: { amount: 9999, currency: "EUR" },
  },
  media: [
    {
      type: "image",
      url: "https://cdn.shopify.com/s/files/1/0600/4300/1915/files/grip.webp?v=1",
    },
  ],
  tags: ["mobile photography"],
  variants: [
    {
      id: "gid://shopify/ProductVariant/42631234567890",
      sku: "SG-PRO-MN",
      title: "Midnight",
      price: { amount: 9999, currency: "EUR" },
      availability: { available: true },
      options: [{ name: "Color", label: "Midnight" }],
    },
  ],
  url: "https://www.shiftcam.com/products/snapgrip-pro",
};

test("ShiftCam mapping keeps EUR and marks eco claims as unevaluated", () => {
  const product = buildShiftcamProduct({
    payload: PAYLOAD,
    storeId: "store-id",
    observedAt: "2026-07-29T00:00:00.000Z",
  });
  assert.equal(product.title, "SnapGrip Pro");
  assert.equal(product.price_cents, 9999);
  assert.equal(product.currency, "EUR");
  assert.deepEqual(product.eco_tags, []);
  assert.equal(product.attributes.options, "Color: Midnight");
});

test("ShiftCam mapping rejects another Shopify merchant's image folder", () => {
  assert.throws(() =>
    buildShiftcamProduct({
      payload: {
        ...PAYLOAD,
        media: [
          {
            type: "image",
            url: "https://cdn.shopify.com/s/files/1/9999/9999/files/grip.webp",
          },
        ],
      },
      storeId: "store-id",
      observedAt: "2026-07-29T00:00:00.000Z",
    }),
  );
});
