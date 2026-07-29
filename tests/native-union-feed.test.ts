import assert from "node:assert/strict";
import test from "node:test";
import { buildNativeUnionProduct } from "../src/lib/feeds/nativeUnion";

const PAYLOAD = {
  id: "gid://shopify/Product/7880445886603",
  handle: "belt-cable-2-in-1-usb-c-to-usb-c-usb-c-cable-140w",
  title: "Belt Cable 2-in-1 USB-C 140W",
  description: {
    html: "<p>A durable 140W cable made with 100% recycled PET braiding, recycled TPU housing and an aramid fiber core. Lifetime Limited Warranty.</p>",
  },
  price_range: {
    min: { amount: 2999, currency: "EUR" },
    max: { amount: 2999, currency: "EUR" },
  },
  media: [
    {
      type: "image",
      url: "https://cdn.shopify.com/s/files/1/0066/9050/4822/files/cable.png?v=1",
    },
  ],
  tags: [],
  variants: [
    {
      id: "gid://shopify/ProductVariant/50000000000002",
      sku: "BELT-2IN1-COS",
      title: "Cosmos",
      price: { amount: 2999, currency: "EUR" },
      availability: { available: true },
      options: [{ name: "Color", label: "Cosmos" }],
    },
  ],
  url: "https://www.nativeunion.com/products/belt-cable-2-in-1-usb-c-to-usb-c-usb-c-cable-140w",
};

test("Native Union mapping keeps exact merchant media and explicit product evidence", () => {
  const product = buildNativeUnionProduct({
    payload: PAYLOAD,
    storeId: "store-id",
    observedAt: "2026-07-29T00:00:00.000Z",
  });
  assert.equal(product.price_cents, 2999);
  assert.equal(
    product.attributes.materials,
    "recycled PET, recycled TPU, aramid fiber",
  );
  assert.equal(product.attributes.power, "140W");
  assert.equal(product.attributes.warranty, "Lifetime Limited Warranty");
  assert.deepEqual(product.eco_tags, ["long-lifespan", "recycled"]);
});

test("Native Union mapping rejects another storefront or Shopify folder", () => {
  assert.throws(() =>
    buildNativeUnionProduct({
      payload: {
        ...PAYLOAD,
        url: "https://nativeunion.com/products/belt-cable-2-in-1-usb-c-to-usb-c-usb-c-cable-140w",
      },
      storeId: "store-id",
      observedAt: "2026-07-29T00:00:00.000Z",
    }),
  );
  assert.throws(() =>
    buildNativeUnionProduct({
      payload: {
        ...PAYLOAD,
        media: [
          {
            type: "image",
            url: "https://cdn.shopify.com/s/files/1/9999/9999/files/cable.png",
          },
        ],
      },
      storeId: "store-id",
      observedAt: "2026-07-29T00:00:00.000Z",
    }),
  );
});
