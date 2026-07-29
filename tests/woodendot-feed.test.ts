import assert from "node:assert/strict";
import test from "node:test";
import { buildWoodendotProduct } from "../src/lib/feeds/woodendot";

const PAYLOAD = {
  id: "gid://shopify/Product/7941041717496",
  handle: "pelican-wall-shelf-medium-oak",
  title: "Estante de pared Pelican · Roble medio",
  description: {
    html: "<p>Estante duradero de madera de roble y acero.</p>",
  },
  price_range: {
    min: { amount: 10100, currency: "EUR" },
    max: { amount: 10100, currency: "EUR" },
  },
  media: [
    {
      type: "image",
      url: "https://cdn.shopify.com/s/files/1/0661/7029/0424/products/pelican.jpg?v=1",
    },
  ],
  tags: ["PELICAN"],
  variants: [
    {
      id: "gid://shopify/ProductVariant/43677000000001",
      sku: "PE-M-OAK",
      title: "Default Title",
      price: { amount: 10100, currency: "EUR" },
      availability: { available: true },
      options: [{ name: "Title", label: "Default Title" }],
    },
  ],
  url: "https://woodendot.com/es/products/pelican-wall-shelf-medium-oak",
};

test("Woodendot mapping keeps Spanish EUR destination and scoped origin media", () => {
  const product = buildWoodendotProduct({
    payload: PAYLOAD,
    storeId: "store-id",
    observedAt: "2026-07-29T00:00:00.000Z",
  });
  assert.equal(product.price_cents, 10100);
  assert.equal(product.currency, "EUR");
  assert.equal(product.in_stock, true);
  assert.equal(product.attributes.provenance, "Íscar, España");
  assert.equal(product.attributes.materials, "oak, wood, steel");
  assert.deepEqual(product.eco_tags, [
    "certified",
    "circular",
    "eu-made",
    "long-lifespan",
  ]);
});

test("Woodendot mapping rejects another locale or Shopify media folder", () => {
  assert.throws(() =>
    buildWoodendotProduct({
      payload: {
        ...PAYLOAD,
        url: "https://woodendot.com/products/pelican-wall-shelf-medium-oak",
      },
      storeId: "store-id",
      observedAt: "2026-07-29T00:00:00.000Z",
    }),
  );
  assert.throws(() =>
    buildWoodendotProduct({
      payload: {
        ...PAYLOAD,
        media: [
          {
            type: "image",
            url: "https://cdn.shopify.com/s/files/1/9999/9999/files/pelican.jpg",
          },
        ],
      },
      storeId: "store-id",
      observedAt: "2026-07-29T00:00:00.000Z",
    }),
  );
});
