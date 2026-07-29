import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRapanuiProduct,
  parseRapanuiMeta,
} from "../src/lib/feeds/rapanui";

const HTML = `
  <link data-vue-meta="1" href="https://rapanuiclothing.com/product/organic-cotton-t-shirt/" rel="canonical">
  <meta content="Soft &amp; circular" name="description">
  <meta content="https://images.podos.io/product.jpg?x=1&amp;y=2" property="og:image">
`;

test("Rapanui metadata accepts only canonical product and origin image hosts", () => {
  assert.deepEqual(parseRapanuiMeta(HTML), {
    canonicalUrl: "https://rapanuiclothing.com/product/organic-cotton-t-shirt/",
    imageUrl: "https://images.podos.io/product.jpg?x=1&y=2",
    description: "Soft & circular",
  });
  assert.throws(() =>
    parseRapanuiMeta(
      HTML.replace("images.podos.io", "untrusted.example").replace(
        "x=1&amp;y=2",
        "x=1",
      ),
    ),
  );
});

test("Rapanui product mapping keeps GBP, live stock and origin image", () => {
  const product = buildRapanuiProduct({
    handle: "organic-cotton-t-shirt",
    payload: {
      id: 42,
      urlName: "organic-cotton-t-shirt",
      name: "Organic Cotton T-shirt",
      description: "Organic and circular. Plastic-free packaging.",
      specifications: "Made in a renewable energy powered ethical factory.",
      price: 18,
      salePrice: 15,
      baseSku: "RNA1",
      ecoIcons: ["organic-icon.png", "low-carbon-icon.png"],
      options: { Black: { colour: "Black" } },
    },
    stock: { Black: { sizes: { M: 10, L: 0 } } },
    meta: parseRapanuiMeta(HTML),
    storeId: "store-id",
    observedAt: "2026-07-29T00:00:00.000Z",
  });
  assert.equal(product.price_cents, 1500);
  assert.equal(product.currency, "GBP");
  assert.equal(product.in_stock, true);
  assert.equal(product.image_url.startsWith("https://images.podos.io/"), true);
  assert.deepEqual(product.eco_tags, [
    "circular",
    "fair-trade",
    "low-impact",
    "organic",
    "plastic-free",
    "recycled",
  ]);
});
