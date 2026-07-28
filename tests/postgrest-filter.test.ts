import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildProductTextOrFilter,
  quotePostgrestValue,
} from '../src/lib/search/postgrest';

test('PostgREST values quote filter grammar characters', () => {
  assert.equal(
    quotePostgrestValue('lamp,or(test) "blue" \\'),
    '"lamp,or(test) \\"blue\\" \\\\"',
  );
});

test('product text search applies one safely quoted pattern to both fields', () => {
  assert.equal(
    buildProductTextOrFilter('GU10,price.eq.0'),
    'title.ilike."%GU10,price.eq.0%",description.ilike."%GU10,price.eq.0%"',
  );
});
