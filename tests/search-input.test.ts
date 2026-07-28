import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isSearchSort,
  normalizeNicheFilter,
  normalizePriceCents,
} from '../src/lib/search/input';

test('search URL enums reject unsupported values', () => {
  assert.equal(normalizeNicheFilter('iluminacion'), 'iluminacion');
  assert.equal(normalizeNicheFilter('unknown'), null);
  assert.equal(isSearchSort('price_asc'), true);
  assert.equal(isSearchSort('random()'), false);
});

test('price filters accept finite non-negative cents only', () => {
  assert.equal(normalizePriceCents(1999.6), 2000);
  assert.equal(normalizePriceCents(0), 0);
  assert.equal(normalizePriceCents(-1), null);
  assert.equal(normalizePriceCents(Number.NaN), null);
  assert.equal(normalizePriceCents(Number.POSITIVE_INFINITY), null);
  assert.equal(normalizePriceCents('1200'), null);
});
