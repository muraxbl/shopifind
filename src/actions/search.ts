'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  normalizeEcoTagFilters,
  normalizeSearchQuery,
  parseQueryIntent,
} from '@/lib/ai/queryIntent';
import { buildProductTextOrFilter } from '@/lib/search/postgrest';
import {
  isSearchSort,
  normalizePageNumber,
  normalizeNicheFilter,
  normalizePriceCents,
  type SearchSort,
} from '@/lib/search/input';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MIN_PAGE_SIZE } from '@/lib/config';
import { buildSearchHistoryEvent } from '@/lib/analytics/history';
import { recordHistoryEvent } from '@/lib/analytics/record';

export type SearchInput = {
  q: string;
  niche?: string | null;
  eco_tags?: string[];
  min_price_cents?: number | null;
  max_price_cents?: number | null;
  sort?: SearchSort;
  /** 1-indexed page number; default 1. */
  page?: number;
  /** Items per page; default DEFAULT_PAGE_SIZE; clamped to [MIN, MAX]. */
  pageSize?: number;
};

export type SearchHit = {
  id: string;
  slug: string;
  title: string;
  price_cents: number;
  currency: string;
  image_url: string;
  store_name: string;
  store_slug: string;
  niche: string;
  eco_tags: string[];
  store_eco_score: number;
};

export type SearchResult = {
  products: SearchHit[];
  total: number;
};

function clampPageSize(raw: number | undefined): number {
  const n = raw ?? DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, Math.floor(n)));
}

export async function searchProducts(
  input: SearchInput,
): Promise<SearchResult> {
  const q = normalizeSearchQuery(input.q ?? '');
  const ecoTags = normalizeEcoTagFilters(input.eco_tags ?? []);
  const niche = normalizeNicheFilter(input.niche);
  const minPrice = normalizePriceCents(input.min_price_cents);
  const maxPrice = normalizePriceCents(input.max_price_cents);
  const requestedSort = isSearchSort(input.sort) ? input.sort : undefined;

  const hasAnyFilter =
    !!q ||
    !!niche ||
    ecoTags.length > 0 ||
    minPrice !== null ||
    maxPrice !== null ||
    requestedSort !== undefined;
  if (!hasAnyFilter) {
    return { products: [], total: 0 };
  }

  const sb = createServerSupabaseClient();

  // 1. Run the AI intent parser if needed.
  let parsed = {
    text: q,
    niche,
    eco_tags_any: ecoTags,
    min_price_cents: minPrice,
    max_price_cents: maxPrice,
    sort: requestedSort ?? 'relevance',
  };

  if (q && process.env.OPENAI_API_KEY) {
    try {
      const intent = await parseQueryIntent(q);
      const hasStructuredIntent =
        intent.niche !== null ||
        intent.eco_tags_any.length > 0 ||
        intent.min_price_cents !== null ||
        intent.max_price_cents !== null;
      parsed = {
        text: intent.text || (hasStructuredIntent ? '' : q),
        niche: parsed.niche ?? intent.niche,
        eco_tags_any:
          parsed.eco_tags_any.length > 0
            ? parsed.eco_tags_any
            : intent.eco_tags_any,
        min_price_cents: parsed.min_price_cents ?? intent.min_price_cents,
        max_price_cents: parsed.max_price_cents ?? intent.max_price_cents,
        sort: requestedSort ?? intent.sort,
      };
    } catch (e) {
      console.warn('[search] AI intent fallback:', e);
    }
  }

  // 2. Single DB call with offset pagination + count headers.
  const pageSize = clampPageSize(input.pageSize);
  const page = normalizePageNumber(input.page);
  const offset = (page - 1) * pageSize;

  let query = sb
    .from('v_products_with_store')
    .select(
      'id, slug, title, price_cents, currency, image_url, store_name, store_slug, niche, eco_tags, store_eco_score',
      { count: 'exact' },
    )
    .eq('in_stock', true);

  if (parsed.text) {
    // ILIKE wildcards (% _) from user input intentionally remain as wildcards —
    // they're search hints, not regex noise. Strip them would surprise the user
    // when they type "100%" or "M_XX" (likely real product names).
    query = query.or(buildProductTextOrFilter(parsed.text));
  }
  if (parsed.niche) query = query.eq('niche', parsed.niche);
  if (parsed.eco_tags_any.length)
    query = query.overlaps('eco_tags', parsed.eco_tags_any);
  if (parsed.min_price_cents != null)
    query = query.gte('price_cents', parsed.min_price_cents);
  if (parsed.max_price_cents != null)
    query = query.lte('price_cents', parsed.max_price_cents);
  if (parsed.sort === 'price_asc')
    query = query.order('price_cents', { ascending: true });
  if (parsed.sort === 'price_desc')
    query = query.order('price_cents', { ascending: false });
  if (parsed.sort === 'newest')
    query = query.order('updated_at', { ascending: false });

  // PostgREST uses an inclusive range. Page input is bounded to 100, which
  // limits offset cost without repeating the page at an artificial offset.
  query = query.range(offset, offset + pageSize - 1);

  const { data, count, error } = await query;
  if (error) {
    console.error('[search] supabase error:', error.message);
    return { products: [], total: 0 };
  }

  // 3. Best-effort anonymous history capture. Awaiting it matters on Vercel:
  // work left running after the response is not guaranteed to complete.
  await recordHistoryEvent(
    buildSearchHistoryEvent({
      query: q,
      intent: parsed,
      total: typeof count === 'number' ? count : (data?.length ?? 0),
      page,
      pageSize,
    }),
  );

  // No revalidatePath('/search') here — the page already uses
  // `export const dynamic = 'force-dynamic'` and is filtered per-request.
  // revalidatePath would only add cache invalidation cost with no effect.
  return {
    products: (data ?? []) as unknown as SearchHit[],
    total: typeof count === 'number' ? count : 0,
  };
}
