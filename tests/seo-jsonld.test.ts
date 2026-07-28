import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildProductJsonLd,
  serializeJsonLd,
} from '../src/lib/seo/jsonLd';

test('product JSON-LD describes a snippet page and the actual seller', () => {
  const value = buildProductJsonLd({
    slug: 'bombilla-gu10',
    title: 'Bombilla GU10',
    description: 'LED eficiente',
    imageUrl: 'https://merchant.example/image.jpg',
    priceCents: 499,
    currency: 'EUR',
    inStock: true,
    storeName: 'Tienda Luz',
    storeSlug: 'tienda-luz',
    siteUrl: 'https://shopifind.app/',
  });

  assert.equal(value.url, 'https://shopifind.app/product/bombilla-gu10');
  assert.equal(value.offers.price, '4.99');
  assert.equal(value.offers.priceCurrency, 'EUR');
  assert.deepEqual(value.offers.seller, {
    '@type': 'Organization',
    name: 'Tienda Luz',
    url: 'https://shopifind.app/store/tienda-luz',
  });
  assert.equal('brand' in value, false);
  assert.equal('priceValidUntil' in value.offers, false);
});

test('JSON-LD serialization cannot terminate its script element', () => {
  const serialized = serializeJsonLd({
    name: '</script><script>alert(1)</script>',
  });

  assert.equal(serialized.includes('</script>'), false);
  assert.match(serialized, /\\u003c\/script>/);
  assert.deepEqual(JSON.parse(serialized), {
    name: '</script><script>alert(1)</script>',
  });
});
