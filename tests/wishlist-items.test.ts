import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendWishlistItem,
  hasWishlistItem,
  normalizeWishlistItems,
  type WishlistItem,
  withoutWishlistItem,
} from '../src/lib/wishlist/items';

const item: WishlistItem = {
  product_id: '11111111-1111-4111-8111-111111111111',
  store_url: 'https://merchant.example/product',
  price_when_added: 4999,
  notify: true,
  added_at: '2026-07-28T00:00:00.000Z',
};

test('normalizeWishlistItems discards malformed JSONB entries', () => {
  assert.deepEqual(normalizeWishlistItems([item, null, { product_id: 'broken' }]), [item]);
  assert.deepEqual(normalizeWishlistItems({}), []);
});

test('appendWishlistItem is idempotent by product id', () => {
  const once = appendWishlistItem([], item);
  const twice = appendWishlistItem(once, { ...item, price_when_added: 100 });
  assert.equal(twice.length, 1);
  assert.equal(twice[0]?.price_when_added, 4999);
  assert.equal(hasWishlistItem(twice, item.product_id), true);
});

test('withoutWishlistItem removes only the requested product', () => {
  const another = { ...item, product_id: '22222222-2222-4222-8222-222222222222' };
  assert.deepEqual(withoutWishlistItem([item, another], item.product_id), [another]);
});
