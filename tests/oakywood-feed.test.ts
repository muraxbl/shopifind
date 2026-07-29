import assert from "node:assert/strict";
import test from "node:test";
import { buildOakywoodProduct } from "../src/lib/feeds/oakywood";

const PAYLOAD = {
  id: "gid://shopify/Product/7552042008637",
  handle: "magnetic-cable-organizer",
  title: "Magnetic Cable Organizer",
  description: {
    html: "<p>A sturdy organizer made from solid wood and certified felt.</p>",
  },
  price_range: {
    min: { amount: 3900, currency: "EUR" },
    max: { amount: 4900, currency: "EUR" },
  },
  media: [
    {
      type: "image",
      url: "https://cdn.shopify.com/s/files/1/2447/0423/files/organizer.webp?v=1",
    },
  ],
  tags: ["wood", "desk organization"],
  variants: [
    {
      id: "gid://shopify/ProductVariant/41924723834941",
      sku: "1910OAKBLK",
      title: "Oak / Black",
      price: { amount: 3900, currency: "EUR" },
      availability: { available: true },
      options: [{ name: "Color", label: "Oak" }],
    },
  ],
  url: "https://oakywood.shop/products/magnetic-cable-organizer",
};

test("Oakywood mapping keeps localized EUR, stock and origin media", () => {
  const product = buildOakywoodProduct({
    payload: PAYLOAD,
    storeId: "store-id",
    observedAt: "2026-07-29T00:00:00.000Z",
  });
  assert.equal(product.price_cents, 3900);
  assert.equal(product.currency, "EUR");
  assert.equal(product.in_stock, true);
  assert.equal(product.image_url.startsWith("https://cdn.shopify.com/"), true);
  assert.deepEqual(product.eco_tags, ["certified", "long-lifespan"]);
  assert.equal(product.attributes.materials, "solid wood");
});

test("Oakywood mapping rejects media outside its Shopify folder", () => {
  assert.throws(() =>
    buildOakywoodProduct({
      payload: {
        ...PAYLOAD,
        media: [{ type: "image", url: "https://attacker.test/image.jpg" }],
      },
      storeId: "store-id",
      observedAt: "2026-07-29T00:00:00.000Z",
    }),
  );
});
