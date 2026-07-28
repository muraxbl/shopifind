import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSkimlinksUrl } from '../src/lib/skimlinks';

test('buildSkimlinksUrl preserves the merchant URL and product attribution', () => {
  const previous = process.env.SKIMLINKS_DOMAIN_ID;
  process.env.SKIMLINKS_DOMAIN_ID = 'publisher-123';
  try {
    const result = new URL(
      buildSkimlinksUrl('https://merchant.example/product?a=1&b=2', 'product-slug')
    );
    assert.equal(result.origin, 'https://go.redirectingat.com');
    assert.equal(result.searchParams.get('id'), 'publisher-123');
    assert.equal(result.searchParams.get('url'), 'https://merchant.example/product?a=1&b=2');
    assert.equal(result.searchParams.get('xcust'), 'shopifind-product-slug');
  } finally {
    if (previous === undefined) delete process.env.SKIMLINKS_DOMAIN_ID;
    else process.env.SKIMLINKS_DOMAIN_ID = previous;
  }
});
