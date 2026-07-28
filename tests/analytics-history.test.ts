import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildClickOutHistoryEvent,
  buildSearchHistoryEvent,
} from '../src/lib/analytics/history';

test('search history records total results and pagination metadata', () => {
  const event = buildSearchHistoryEvent({
    query: 'bombillas eficientes',
    intent: { niche: 'iluminacion', max_price_cents: 2_000 },
    total: 1_452,
    page: 2,
    pageSize: 24,
  });

  assert.equal(event.user_id, null);
  assert.equal(event.results_count, 1_452);
  assert.deepEqual(event.filters, {
    event: 'search',
    intent: { niche: 'iluminacion', max_price_cents: 2_000 },
    page: 2,
    page_size: 24,
  });
});

test('search history bounds query length and invalid negative totals', () => {
  const event = buildSearchHistoryEvent({
    query: 'x'.repeat(250),
    intent: {},
    total: -4,
    page: 1,
    pageSize: 24,
  });

  assert.equal(event.query.length, 200);
  assert.equal(event.results_count, 0);

  assert.equal(
    buildSearchHistoryEvent({
      query: 'test',
      intent: {},
      total: Number.NaN,
      page: 1,
      pageSize: 24,
    }).results_count,
    0,
  );
});

test('click-out history has structured event metadata', () => {
  const event = buildClickOutHistoryEvent('masterled-bombilla-gu10');

  assert.equal(event.user_id, null);
  assert.equal(event.query, '[click-out] /product/masterled-bombilla-gu10');
  assert.deepEqual(event.filters, {
    event: 'click_out',
    product_slug: 'masterled-bombilla-gu10',
  });
});
