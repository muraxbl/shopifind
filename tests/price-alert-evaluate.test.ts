import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluatePriceAlert,
  isPriceAlertDeliveryCurrent,
} from '../src/lib/alerts/evaluate';

test('any-drop evaluates the final available price against the prior baseline', () => {
  assert.deepEqual(
    evaluatePriceAlert({
      mode: 'any_drop',
      baselinePriceCents: 10_000,
      baselineCurrency: 'EUR',
      targetPriceCents: null,
      percentageDrop: null,
      events: [
        { id: 2, price_cents: 9_000, currency: 'EUR', in_stock: true },
        { id: 3, price_cents: 9_500, currency: 'EUR', in_stock: true },
        { id: 4, price_cents: 8_500, currency: 'EUR', in_stock: true },
      ],
    }),
    {
      triggerHistoryId: 4,
      lastHistoryId: 4,
      nextBaselinePriceCents: 8_500,
      nextBaselineCurrency: 'EUR',
      deactivate: false,
    },
  );
});

test('an out-of-stock final event does not trigger or move the baseline', () => {
  const result = evaluatePriceAlert({
    mode: 'any_drop',
    baselinePriceCents: 10_000,
    baselineCurrency: 'EUR',
    targetPriceCents: null,
    percentageDrop: null,
    events: [
      { id: 2, price_cents: 8_000, currency: 'EUR', in_stock: true },
      { id: 3, price_cents: 8_000, currency: 'EUR', in_stock: false },
    ],
  });
  assert.equal(result.triggerHistoryId, null);
  assert.equal(result.nextBaselinePriceCents, 10_000);
});

test('a transient drop that recovered before evaluation does not notify', () => {
  const result = evaluatePriceAlert({
    mode: 'any_drop',
    baselinePriceCents: 10_000,
    baselineCurrency: 'EUR',
    targetPriceCents: null,
    percentageDrop: null,
    events: [
      { id: 2, price_cents: 8_000, currency: 'EUR', in_stock: true },
      { id: 3, price_cents: 10_500, currency: 'EUR', in_stock: true },
    ],
  });
  assert.equal(result.triggerHistoryId, null);
  assert.equal(result.nextBaselinePriceCents, 10_500);
});

test('target and percentage alerts are one-shot', () => {
  const target = evaluatePriceAlert({
    mode: 'target_price',
    baselinePriceCents: 10_000,
    baselineCurrency: 'EUR',
    targetPriceCents: 8_000,
    percentageDrop: null,
    events: [{ id: 2, price_cents: 8_000, currency: 'EUR', in_stock: true }],
  });
  assert.equal(target.triggerHistoryId, 2);
  assert.equal(target.deactivate, true);

  const percentage = evaluatePriceAlert({
    mode: 'percentage_drop',
    baselinePriceCents: 10_000,
    baselineCurrency: 'EUR',
    targetPriceCents: null,
    percentageDrop: 20,
    events: [{ id: 3, price_cents: 8_001, currency: 'EUR', in_stock: true }],
  });
  assert.equal(percentage.triggerHistoryId, null);
  assert.equal(percentage.deactivate, false);
});

test('currency changes reset relative alerts and deactivate fixed targets', () => {
  const event = { id: 8, price_cents: 120, currency: 'USD', in_stock: true };
  const relative = evaluatePriceAlert({
    mode: 'percentage_drop',
    baselinePriceCents: 10_000,
    baselineCurrency: 'EUR',
    targetPriceCents: null,
    percentageDrop: 10,
    events: [event],
  });
  assert.deepEqual(relative, {
    triggerHistoryId: null,
    lastHistoryId: 8,
    nextBaselinePriceCents: 120,
    nextBaselineCurrency: 'USD',
    deactivate: false,
  });

  const fixed = evaluatePriceAlert({
    mode: 'target_price',
    baselinePriceCents: 10_000,
    baselineCurrency: 'EUR',
    targetPriceCents: 8_000,
    percentageDrop: null,
    events: [event],
  });
  assert.equal(fixed.triggerHistoryId, null);
  assert.equal(fixed.deactivate, true);
});

test('delivery requires the same current, in-stock price and currency', () => {
  const snapshot = {
    referenceCurrency: 'EUR',
    history: { priceCents: 8_000, currency: 'EUR', inStock: true },
    product: { priceCents: 8_000, currency: 'EUR', inStock: true },
  };
  assert.equal(isPriceAlertDeliveryCurrent(snapshot), true);
  assert.equal(
    isPriceAlertDeliveryCurrent({
      ...snapshot,
      history: { ...snapshot.history, currency: 'USD' },
      product: { ...snapshot.product, currency: 'USD' },
    }),
    false,
  );
  assert.equal(
    isPriceAlertDeliveryCurrent({
      ...snapshot,
      product: { ...snapshot.product, priceCents: 8_500 },
    }),
    false,
  );
  assert.equal(
    isPriceAlertDeliveryCurrent({
      ...snapshot,
      product: { ...snapshot.product, inStock: false },
    }),
    false,
  );
});
