import OpenAI from 'openai';
import { unstable_cache } from 'next/cache';
import { z } from 'zod';

export const MAX_SEARCH_QUERY_LENGTH = 240;
export const AI_INTENT_CACHE_TTL_SECONDS = 60 * 60;

// Keep this list synchronized with tags produced by the active seed scripts.
// Structured Outputs can then choose only filters that can actually match rows.
export const SEARCH_ECO_TAGS = [
  'amazonian-rubber',
  'b-corp',
  'certified',
  'circular',
  'cotton',
  'cruelty-free',
  'ecovero',
  'eu-import',
  'eu-made',
  'fair-trade',
  'fair-wage',
  'female-founded',
  'gots',
  'lease-program',
  'led',
  'long-lifespan',
  'low-energy',
  'low-impact',
  'low-water',
  'mulesing-free',
  'natural-dye',
  'ocean-plastic',
  'on-demand',
  'organic',
  'permanent-collection',
  'pfc-free',
  'recyclable',
  'recycled',
  'renewable-energy',
  'rws-wool',
  'slow-fashion',
  'tara-tanned',
  'tencel',
  'transparent-pricing',
  'transparent-supply-chain',
  'upf50',
  'vegan',
  'vegan-leather',
] as const;

export type SearchEcoTag = (typeof SEARCH_ECO_TAGS)[number];
const SearchEcoTagSchema = z.enum(SEARCH_ECO_TAGS);

type SearchEcoFacet = { id: SearchEcoTag; label: string };

const DEFAULT_SEARCH_ECO_FACETS: readonly SearchEcoFacet[] = [
  { id: 'vegan', label: 'Vegano' },
  { id: 'eu-made', label: 'Hecho en UE' },
  { id: 'recycled', label: 'Reciclado' },
  { id: 'organic', label: 'Orgánico' },
  { id: 'b-corp', label: 'B Corp' },
  { id: 'female-founded', label: 'Fundada por mujeres' },
];

const LIGHTING_SEARCH_ECO_FACETS: readonly SearchEcoFacet[] = [
  { id: 'long-lifespan', label: 'Larga vida útil' },
  { id: 'recyclable', label: 'Reciclable' },
  { id: 'certified', label: 'CE + RoHS' },
];

export function getSearchEcoFacets(
  niche: string | null,
  activeTag?: string,
): SearchEcoFacet[] {
  const base =
    niche === 'iluminacion'
      ? [...LIGHTING_SEARCH_ECO_FACETS]
      : [...DEFAULT_SEARCH_ECO_FACETS];
  const active = normalizeEcoTagFilters([activeTag])[0];
  if (active && !base.some((facet) => facet.id === active)) {
    base.unshift({ id: active, label: active.replaceAll('-', ' ') });
  }
  return base;
}

/**
 * Convert a free-text user query into typed search filters using
 * OpenAI Structured Outputs (function-calling-equivalent). Then
 * the SQL layer (Postgres + pg_trgm) executes the actual search.
 */
export const QueryFiltersSchema = z
  .object({
    text: z
      .string()
      .max(MAX_SEARCH_QUERY_LENGTH)
      .describe(
        'Essential product terms only. Empty string for a pure filter query.',
      ),
    niche: z
      .enum([
        'sustainable-fashion',
        'indie-gadgets',
        'home-deco',
        'iluminacion',
      ])
      .nullable()
      .describe('Detected niche, or null if not specified.'),
    eco_tags_any: z
      .array(SearchEcoTagSchema)
      .max(5)
      .describe('At most five catalog-backed eco tags.'),
    max_price_cents: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .describe('Upper price in cents, e.g. 8000 = 80€. Null if no max.'),
    min_price_cents: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .describe('Lower price in cents. Null if no min.'),
    sort: z
      .enum(['relevance', 'price_asc', 'price_desc', 'newest'])
      .default('relevance'),
  })
  .strict();

export type QueryFilters = z.infer<typeof QueryFiltersSchema>;

const FALLBACK: QueryFilters = {
  text: '',
  eco_tags_any: [],
  sort: 'relevance',
  niche: null,
  max_price_cents: null,
  min_price_cents: null,
};

let cachedClient: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (cachedClient) return cachedClient;
  cachedClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 4_000,
    maxRetries: 0,
  });
  return cachedClient;
}

export function normalizeSearchQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ').slice(0, MAX_SEARCH_QUERY_LENGTH);
}

export function normalizeEcoTagFilters(
  values: readonly unknown[],
): SearchEcoTag[] {
  const allowed = new Set<string>(SEARCH_ECO_TAGS);
  const result: SearchEcoTag[] = [];
  for (const value of values) {
    if (typeof value !== 'string' || !allowed.has(value)) continue;
    const tag = value as SearchEcoTag;
    if (!result.includes(tag)) result.push(tag);
    if (result.length === 5) break;
  }
  return result;
}

export function parseQueryFiltersJson(raw: string): QueryFilters {
  return QueryFiltersSchema.parse(JSON.parse(raw));
}

export function isAiSearchEnabled(
  apiKey = process.env.OPENAI_API_KEY,
  enabledFlag = process.env.OPENAI_SEARCH_ENABLED,
): boolean {
  return (
    Boolean(apiKey?.trim()) &&
    enabledFlag?.trim().toLowerCase() !== 'false'
  );
}

const getCachedQueryIntent = unstable_cache(
  async (trimmed: string, model: string): Promise<QueryFilters> => {
    const completion = await getOpenAI().chat.completions.create({
      model,
      temperature: 0,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'search_filters',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              text: { type: 'string', maxLength: MAX_SEARCH_QUERY_LENGTH },
              niche: {
                type: ['string', 'null'],
                enum: [
                  'sustainable-fashion',
                  'indie-gadgets',
                  'home-deco',
                  'iluminacion',
                  null,
                ],
              },
              eco_tags_any: {
                type: 'array',
                items: { type: 'string', enum: SEARCH_ECO_TAGS },
                maxItems: 5,
              },
              max_price_cents: { type: ['integer', 'null'], minimum: 0 },
              min_price_cents: { type: ['integer', 'null'], minimum: 0 },
              sort: {
                type: 'string',
                enum: ['relevance', 'price_asc', 'price_desc', 'newest'],
              },
            },
            required: [
              'text',
              'eco_tags_any',
              'sort',
              'niche',
              'max_price_cents',
              'min_price_cents',
            ],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: 'system',
          content:
            'You are a curator for Shopifind, an indie product search engine. ' +
            'Translate the user request into structured filters. ' +
            'If the user explicitly mentions a price ceiling/floor, convert to cents (EUR). ' +
            'Map fashion/moda to sustainable-fashion, gadgets/tech to indie-gadgets, ' +
            'decoracion/hogar to home-deco, and luces/lamparas/bombillas/LED to iluminacion. ' +
            'Return only essential product words in text; use an empty text when filters fully express the request. ' +
            'Never invent eco tags: choose only values allowed by the schema.',
        },
        { role: 'user', content: trimmed },
      ],
      max_tokens: 250,
    });

    const choice = completion.choices[0];
    if (!choice || choice.finish_reason !== 'stop' || !choice.message.content) {
      throw new Error(
        `incomplete_intent_response:${choice?.finish_reason ?? 'missing'}`,
      );
    }
    const filters = parseQueryFiltersJson(choice.message.content);
    console.info('[ai/queryIntent] OpenAI usage', {
      model,
      promptTokens: completion.usage?.prompt_tokens ?? null,
      completionTokens: completion.usage?.completion_tokens ?? null,
      totalTokens: completion.usage?.total_tokens ?? null,
    });
    return filters;
  },
  ['shopifind-query-intent-v1'],
  { revalidate: AI_INTENT_CACHE_TTL_SECONDS },
);

/**
 * Parse a user query into typed filters. Returns graceful fallback
 * (just the literal text) if OpenAI is unavailable or schema fails. Only
 * successful structured responses enter the one-hour shared Data Cache.
 */
export async function parseQueryIntent(query: string): Promise<QueryFilters> {
  const trimmed = normalizeSearchQuery(query);
  if (!trimmed || !isAiSearchEnabled()) {
    return { ...FALLBACK, text: trimmed };
  }

  try {
    return await getCachedQueryIntent(
      trimmed,
      process.env.OPENAI_SEARCH_MODEL ?? 'gpt-4o-mini',
    );
  } catch (err) {
    console.warn('[ai/queryIntent] Falling back to literal text:', err);
    return { ...FALLBACK, text: trimmed };
  }
}
