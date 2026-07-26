import OpenAI from 'openai';
import { z } from 'zod';

/**
 * Convert a free-text user query into typed search filters using
 * OpenAI Structured Outputs (function-calling-equivalent). Then
 * the SQL layer (Postgres + pg_trgm) executes the actual search.
 */
const QueryFiltersSchema = z.object({
  text: z.string().describe('Cleaned search text (e.g. "zellige rug"). Empty string if a pure filter query.'),
  niche: z
    .enum(['sustainable-fashion', 'indie-gadgets', 'home-deco'])
    .nullable()
    .describe('Detected niche, or null if not specified.'),
  eco_tags_any: z
    .array(z.string())
    .describe('Any of these eco_tags must be present (vegan, eu-made, b-corp, ...).'),
  max_price_cents: z.number().int().nullable().describe('Upper price in cents, e.g. 8000 = 80€. Null if no max.'),
  min_price_cents: z.number().int().nullable().describe('Lower price in cents. Null if no min.'),
  attributes: z
    .record(z.string())
    .describe('Structured filters by attribute key, e.g. {"material":"wool","color":"blue"}'),
  sort: z
    .enum(['relevance', 'price_asc', 'price_desc', 'newest'])
    .default('relevance'),
});

export type QueryFilters = z.infer<typeof QueryFiltersSchema>;

const FALLBACK: QueryFilters = {
  text: '',
  eco_tags_any: [],
  attributes: {},
  sort: 'relevance',
  niche: null,
  max_price_cents: null,
  min_price_cents: null,
};

let cachedClient: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (cachedClient) return cachedClient;
  cachedClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return cachedClient;
}

/**
 * Parse a user query into typed filters. Returns graceful fallback
 * (just the literal text) if OpenAI is unavailable or schema fails.
 */
export async function parseQueryIntent(query: string): Promise<QueryFilters> {
  const trimmed = query.trim();
  if (!trimmed || !process.env.OPENAI_API_KEY) {
    return { ...FALLBACK, text: trimmed };
  }

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'search_filters',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              niche: {
                type: ['string', 'null'],
                enum: ['sustainable-fashion', 'indie-gadgets', 'home-deco', null],
              },
              eco_tags_any: { type: 'array', items: { type: 'string' } },
              max_price_cents: { type: ['integer', 'null'] },
              min_price_cents: { type: ['integer', 'null'] },
              attributes: { type: 'object', additionalProperties: { type: 'string' } },
              sort: { type: 'string', enum: ['relevance', 'price_asc', 'price_desc', 'newest'] },
            },
            required: ['text', 'eco_tags_any', 'attributes', 'sort', 'niche', 'max_price_cents', 'min_price_cents'],
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
            'If they mention a vertical (fashion/gadgets/deco) set the niche accordingly. ' +
            'eco_tags_any should contain lower-case tags only (vegan, eu-made, b-corp, organic, female-founded, recycled, handmade, repairable, solid-wood, fair-wage, transparent-pricing, eu-shipped, wool, traditional-craft, small-batch, cotton, oak, ...).',
        },
        { role: 'user', content: trimmed },
      ],
      max_tokens: 200,
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    const parsed = QueryFiltersSchema.parse(JSON.parse(raw));
    return parsed;
  } catch (err) {
    console.warn('[ai/queryIntent] Falling back to literal text:', err);
    return { ...FALLBACK, text: trimmed };
  }
}
