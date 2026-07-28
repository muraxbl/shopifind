import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluatePriceAlert } from '../src/lib/alerts/evaluate';

test('any-drop evaluates the final available price against the prior baseline', () => {
  assert.deepEqual(
    evaluatePriceAlert({
      mode: 'any_drop',
      baselinePriceCents: 10_000,
      targetPriceCents: null,
      percentageDrop: null,
      events: [
        { id: 2, price_cents: 9_000, in_stock: true },
        { id: 3, price_cents: 9_500, in_stock: true },
        { id: 4, price_cents: 8_500, in_stock: true },
      ],
    }),
    {
      triggerHistoryId: 4,
      lastHistoryId: 4,
      nextBaselinePriceCents: 8_500,
      deactivate: false,
    },
  );
});

test('an out-of-stock final event does not trigger or move the baseline', () => {
  const result = evaluatePriceAlert({
    mode: 'any_drop',
    baselinePriceCents: 10_000,
    targetPriceCents: null,
    percentageDrop: null,
    events: [
      { id: 2, price_cents: 8_000, in_stock: true },
      { id: 3, price_cents: 8_000, in_stock: false },
    ],
  });
  assert.equal(result.triggerHistoryId, null);
  assert.equal(result.nextBaselinePriceCents, 10_000);
});

test('a transient drop that recovered before evaluation does not notify', () => {
  const result = evaluatePriceAlert({
    mode: 'any_drop',
    baselinePriceCents: 10_000,
    targetPriceCents: null,
    percentageDrop: null,
    events: [
      { id: 2, price_cents: 8_000, in_stock: true },
      { id: 3, price_cents: 10_500, in_stock: true },
    ],
  });
  assert.equal(result.triggerHistoryId, null);
  assert.equal(result.nextBaselinePriceCents, 10_500);
});

test('target and percentage alerts are one-shot', () => {
  const target = evaluatePriceAlert({
    mode: 'target_price',
    baselinePriceCents: 10_000,
    targetPriceCents: 8_000,
    percentageDrop: null,
    events: [{ id: 2, price_cents: 8_000, in_stock: true }],
  });
  assert.equal(target.triggerHistoryId, 2);
  assert.equal(target.deactivate, true);

  const percentage = evaluatePriceAlert({
    mode: 'percentage_drop',
    baselinePriceCents: 10_000,
    targetPriceCents: null,
    percentageDrop: 20,
    events: [{ id: 3, price_cents: 8_001, in_stock: true }],
  });
  assert.equal(percentage.triggerHistoryId, null);
  assert.equal(percentage.deactivate, false);
});
