import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_SEARCH_QUERY_LENGTH,
  normalizeEcoTagFilters,
  normalizeSearchQuery,
  parseQueryIntent,
  parseQueryFiltersJson,
} from '../src/lib/ai/queryIntent';

test('query filter contract accepts lighting and catalog-backed tags', () => {
  assert.deepEqual(
    parseQueryFiltersJson(
      JSON.stringify({
        text: 'bombilla GU10',
        niche: 'iluminacion',
        eco_tags_any: ['led', 'low-energy'],
        max_price_cents: 2500,
        min_price_cents: null,
        sort: 'price_asc',
      }),
    ),
    {
      text: 'bombilla GU10',
      niche: 'iluminacion',
      eco_tags_any: ['led', 'low-energy'],
      max_price_cents: 2500,
      min_price_cents: null,
      sort: 'price_asc',
    },
  );
});

test('query filter contract rejects invented tags and retired attributes', () => {
  assert.throws(() =>
    parseQueryFiltersJson(
      JSON.stringify({
        text: '',
        niche: null,
        eco_tags_any: ['invented-tag'],
        max_price_cents: null,
        min_price_cents: null,
        sort: 'relevance',
      }),
    ),
  );
  assert.throws(() =>
    parseQueryFiltersJson(
      JSON.stringify({
        text: 'blue lamp',
        niche: 'iluminacion',
        eco_tags_any: [],
        max_price_cents: null,
        min_price_cents: null,
        attributes: { color: 'blue' },
        sort: 'relevance',
      }),
    ),
  );
});

test('search input normalization bounds cost and filters unknown tags', () => {
  assert.equal(
    normalizeSearchQuery(`  ${'x'.repeat(MAX_SEARCH_QUERY_LENGTH + 20)}  `)
      .length,
    MAX_SEARCH_QUERY_LENGTH,
  );
  assert.deepEqual(
    normalizeEcoTagFilters(['led', 'unknown', 'led', 'recycled']),
    ['led', 'recycled'],
  );
});

test('intent parser falls back to bounded literal text without an API key', async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    assert.deepEqual(await parseQueryIntent('  lámpara    de mesa  '), {
      text: 'lámpara de mesa',
      niche: null,
      eco_tags_any: [],
      max_price_cents: null,
      min_price_cents: null,
      sort: 'relevance',
    });
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});
