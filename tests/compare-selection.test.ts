import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCompareHref,
  MAX_COMPARE_PRODUCTS,
  parseCompareIds,
} from '../src/lib/compare/selection';

const IDS = [
  '550e8400-e29b-41d4-a716-446655440000',
  '550e8400-e29b-41d4-a716-446655440001',
  '550e8400-e29b-41d4-a716-446655440002',
  '550e8400-e29b-41d4-a716-446655440003',
  '550e8400-e29b-41d4-a716-446655440004',
  '550e8400-e29b-41d4-a716-446655440005',
];

test('compare ids preserve order, deduplicate and reject invalid values', () => {
  assert.deepEqual(parseCompareIds(`${IDS[1]},bad,${IDS[0]},${IDS[1]}`), [
    IDS[1],
    IDS[0],
  ]);
});

test('compare ids are capped at five and accept repeated query values', () => {
  assert.deepEqual(
    parseCompareIds([IDS.slice(0, 3).join(','), IDS.slice(3).join(',')]),
    IDS.slice(0, MAX_COMPARE_PRODUCTS),
  );
});

test('compare href keeps only the supported number of ids', () => {
  assert.equal(
    buildCompareHref(IDS),
    `/compare?ids=${IDS.slice(0, MAX_COMPARE_PRODUCTS).join(',')}`,
  );
});
