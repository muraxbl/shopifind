import assert from "node:assert/strict";
import test from "node:test";
import { buildOrbitkeyProduct } from "../src/lib/feeds/orbitkey";

const PAYLOAD = {
  id: "gid://shopify/Product/7122460344416",
  handle: "2-in-1-tech-pouch",
  title: "Bolsa tecnológica 2 en 1",
  description: {
    html: "<p>Durable and water-resistant. External textile: 600D 100% Cyclepet (Recycled PET). Lining: polyester 100% recycled. 2-Year Limited Warranty.</p>",
  },
  price_range: {
    min: { amount: 6990, currency: "EUR" },
    max: { amount: 6990, currency: "EUR" },
  },
  media: [
    {
      type: "image",
      url: "https://cdn.shopify.com/s/files/1/2161/4233/files/pouch.jpg?v=1",
    },
  ],
  tags: [],
  variants: [
    {
      id: "gid://shopify/ProductVariant/50000000000003",
      sku: "DTP-2IN1-BLK",
      title: "Black",
      price: { amount: 6990, currency: "EUR" },
      availability: { available: true },
      options: [{ name: "Color", label: "Black" }],
    },
  ],
  url: "https://www.orbitkey.eu/es/products/2-in-1-tech-pouch",
};

test("Orbitkey mapping keeps exact EU media and product-level material evidence", () => {
  const product = buildOrbitkeyProduct({
    payload: PAYLOAD,
    storeId: "store-id",
    observedAt: "2026-07-29T00:00:00.000Z",
  });
  assert.equal(product.price_cents, 6990);
  assert.equal(
    product.attributes.materials,
    "recycled PET, recycled polyester",
  );
  assert.equal(product.attributes.warranty, "2-Year Limited Warranty");
  assert.equal(product.attributes.options, "Color: Black");
  assert.deepEqual(product.eco_tags, ["long-lifespan", "recycled"]);
});

test("Orbitkey mapping rejects another storefront or Shopify folder", () => {
  assert.throws(() =>
    buildOrbitkeyProduct({
      payload: {
        ...PAYLOAD,
        url: "https://www.orbitkey.com/es/products/2-in-1-tech-pouch",
      },
      storeId: "store-id",
      observedAt: "2026-07-29T00:00:00.000Z",
    }),
  );
  assert.throws(() =>
    buildOrbitkeyProduct({
      payload: {
        ...PAYLOAD,
        media: [
          {
            type: "image",
            url: "https://cdn.shopify.com/s/files/1/9999/9999/files/pouch.jpg",
          },
        ],
      },
      storeId: "store-id",
      observedAt: "2026-07-29T00:00:00.000Z",
    }),
  );
});
