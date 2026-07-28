import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePriceAlertInput } from '../src/lib/alerts/input';

const PRODUCT_ID = '550e8400-e29b-41d4-a716-446655440000';

test('price alert input normalizes all three modes', () => {
  assert.deepEqual(
    normalizePriceAlertInput({ productId: PRODUCT_ID, mode: 'any_drop' }),
    {
      success: true,
      data: {
        productId: PRODUCT_ID,
        mode: 'any_drop',
        targetPriceCents: null,
        percentageDrop: null,
      },
    },
  );
  assert.deepEqual(
    normalizePriceAlertInput({
      productId: PRODUCT_ID,
      mode: 'target_price',
      targetPrice: '19,99',
    }),
    {
      success: true,
      data: {
        productId: PRODUCT_ID,
        mode: 'target_price',
        targetPriceCents: 1999,
        percentageDrop: null,
      },
    },
  );
  assert.equal(
    normalizePriceAlertInput({
      productId: PRODUCT_ID,
      mode: 'percentage_drop',
      percentageDrop: '15',
    }).success,
    true,
  );
});

test('price alert input rejects invalid targets, percentages and ids', () => {
  assert.deepEqual(
    normalizePriceAlertInput({
      productId: PRODUCT_ID,
      mode: 'target_price',
      targetPrice: 'free',
    }),
    { success: false, error: 'invalid_target' },
  );
  assert.deepEqual(
    normalizePriceAlertInput({
      productId: PRODUCT_ID,
      mode: 'percentage_drop',
      percentageDrop: 100,
    }),
    { success: false, error: 'invalid_percentage' },
  );
  assert.deepEqual(
    normalizePriceAlertInput({ productId: 'bad', mode: 'any_drop' }),
    { success: false, error: 'invalid_input' },
  );
});
