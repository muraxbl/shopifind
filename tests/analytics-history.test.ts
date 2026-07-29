import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ANALYTICS_SCHEMA_VERSION,
  buildClickOutHistoryEvent,
  buildSearchHistoryEvent,
  RELEASE_SMOKE_USER_AGENT,
  shouldRecordHistoryEvent,
} from '../src/lib/analytics/history';
import { normalizePlausibleScriptSrc } from '../src/lib/analytics/plausible';

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
    schema_version: ANALYTICS_SCHEMA_VERSION,
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
    schema_version: ANALYTICS_SCHEMA_VERSION,
    product_slug: 'masterled-bombilla-gu10',
  });
});

test('release smoke traffic is excluded from internal analytics', () => {
  assert.equal(shouldRecordHistoryEvent(RELEASE_SMOKE_USER_AGENT), false);
  assert.equal(shouldRecordHistoryEvent(' SHOPIFIND-RELEASE-SMOKE/1.0 '), false);
  assert.equal(shouldRecordHistoryEvent('Mozilla/5.0'), true);
  assert.equal(shouldRecordHistoryEvent(null), true);
});

test('Plausible accepts only the current site-specific script URL', () => {
  assert.equal(
    normalizePlausibleScriptSrc(' https://plausible.io/js/pa-Abc_123-xYz.js '),
    'https://plausible.io/js/pa-Abc_123-xYz.js',
  );
  assert.equal(
    normalizePlausibleScriptSrc('https://plausible.io/js/script.js'),
    null,
  );
  assert.equal(
    normalizePlausibleScriptSrc('https://evil.example/js/pa-Abc123.js'),
    null,
  );
  assert.equal(normalizePlausibleScriptSrc(undefined), null);
});
