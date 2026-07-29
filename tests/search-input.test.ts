import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isSearchSort,
  normalizePageNumber,
  normalizeNicheFilter,
  normalizePriceCents,
  normalizeStoreSlug,
} from '../src/lib/search/input';

test('search URL enums reject unsupported values', () => {
  assert.equal(normalizeNicheFilter('iluminacion'), 'iluminacion');
  assert.equal(normalizeNicheFilter('unknown'), null);
  assert.equal(isSearchSort('price_asc'), true);
  assert.equal(isSearchSort('random()'), false);
});

test('store slugs are bounded and cannot alter filter syntax', () => {
  assert.equal(normalizeStoreSlug(' Masterled-ES '), 'masterled-es');
  assert.equal(normalizeStoreSlug('masterled.es'), null);
  assert.equal(normalizeStoreSlug('x'.repeat(81)), null);
  assert.equal(normalizeStoreSlug('store,or(in_stock.eq.false)'), null);
});

test('price filters accept finite non-negative cents only', () => {
  assert.equal(normalizePriceCents(1999.6), 2000);
  assert.equal(normalizePriceCents(0), 0);
  assert.equal(normalizePriceCents(-1), null);
  assert.equal(normalizePriceCents(Number.NaN), null);
  assert.equal(normalizePriceCents(Number.POSITIVE_INFINITY), null);
  assert.equal(normalizePriceCents('1200'), null);
});

test('page numbers are finite positive integers capped at 100', () => {
  assert.equal(normalizePageNumber(undefined), 1);
  assert.equal(normalizePageNumber('-4'), 1);
  assert.equal(normalizePageNumber('2.9'), 2);
  assert.equal(normalizePageNumber(101), 100);
  assert.equal(normalizePageNumber(Number.POSITIVE_INFINITY), 1);
});
