import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyCatalogHealth,
  isPlaceholderImageUrl,
} from "../src/lib/catalog/health";

test("placeholder product images are never publishable", () => {
  assert.equal(
    isPlaceholderImageUrl("https://placehold.co/600x600?text=Example"),
    true,
  );
  const result = classifyCatalogHealth({
    imageUrl: "https://placehold.co/600x600?text=Example",
    source: { status: 200, title: "Product" },
    image: null,
  });
  assert.equal(result.publishable, false);
  assert.deepEqual(result.reasons, ["placeholder-image"]);
});

test("hard 404s fail while a source WAF remains a warning", () => {
  const image = { status: 200, contentType: "image/webp" };
  const missing = classifyCatalogHealth({
    imageUrl: "https://cdn.example.test/product.webp",
    source: { status: 404, title: "404 Not Found" },
    image,
  });
  assert.equal(missing.publishable, false);
  assert.ok(missing.reasons.includes("source-http-404"));

  const protectedSource = classifyCatalogHealth({
    imageUrl: "https://cdn.example.test/product.webp",
    source: { status: 403, title: "Attention required" },
    image,
  });
  assert.equal(protectedSource.publishable, true);
  assert.deepEqual(protectedSource.warnings, ["source-http-403"]);
});
