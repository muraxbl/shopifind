import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_SEARCH_QUERY_LENGTH,
  getSearchEcoFacets,
  isAiSearchEnabled,
  normalizeEcoTagFilters,
  normalizeSearchQuery,
  parseQueryIntent,
  parseQueryFiltersJson,
} from '../src/lib/ai/queryIntent';

test('AI search requires a key and honors the emergency kill switch', () => {
  assert.equal(isAiSearchEnabled(undefined, undefined), false);
  assert.equal(isAiSearchEnabled('  ', 'true'), false);
  assert.equal(isAiSearchEnabled('sk-test', undefined), true);
  assert.equal(isAiSearchEnabled('sk-test', ' TRUE '), true);
  assert.equal(isAiSearchEnabled('sk-test', ' false '), false);
  assert.equal(isAiSearchEnabled('sk-test', 'FALSE'), false);
});

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

test('search facets follow the niche and preserve a valid active tag', () => {
  assert.deepEqual(
    getSearchEcoFacets('iluminacion').map((facet) => facet.id),
    ['long-lifespan', 'recyclable', 'certified'],
  );
  assert.equal(getSearchEcoFacets(null)[0]?.id, 'vegan');
  assert.deepEqual(getSearchEcoFacets(null, 'led')[0], {
    id: 'led',
    label: 'led',
  });
  assert.equal(
    getSearchEcoFacets('iluminacion', 'invented-tag')
      .map((facet) => String(facet.id))
      .includes('invented-tag'),
    false,
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

test('intent parser kill switch bypasses OpenAI even when a key exists', async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousFlag = process.env.OPENAI_SEARCH_ENABLED;
  process.env.OPENAI_API_KEY = 'sk-must-not-be-used';
  process.env.OPENAI_SEARCH_ENABLED = 'false';
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
    if (previousFlag === undefined) delete process.env.OPENAI_SEARCH_ENABLED;
    else process.env.OPENAI_SEARCH_ENABLED = previousFlag;
  }
});
