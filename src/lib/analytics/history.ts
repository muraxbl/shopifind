import type { Json } from '@/types/database.types';

export const ANALYTICS_SCHEMA_VERSION = 2;
export const RELEASE_SMOKE_USER_AGENT = 'shopifind-release-smoke/1.0';

export function shouldRecordHistoryEvent(
  userAgent: string | null | undefined,
): boolean {
  return userAgent?.trim().toLowerCase() !== RELEASE_SMOKE_USER_AGENT;
}

export type SearchHistoryInsert = {
  user_id: null;
  query: string;
  filters: Json;
  results_count: number;
};

type SearchHistoryInput = {
  query: string;
  intent: Record<string, unknown>;
  total: number;
  page: number;
  pageSize: number;
};

export function buildSearchHistoryEvent(
  input: SearchHistoryInput,
): SearchHistoryInsert {
  const total = Number.isFinite(input.total)
    ? Math.max(0, Math.floor(input.total))
    : 0;
  return {
    user_id: null,
    query: input.query.slice(0, 200),
    filters: {
      event: 'search',
      schema_version: ANALYTICS_SCHEMA_VERSION,
      intent: input.intent as Json,
      page: input.page,
      page_size: input.pageSize,
    },
    results_count: total,
  };
}

export function buildClickOutHistoryEvent(
  productSlug: string,
): SearchHistoryInsert {
  const slug = productSlug.slice(0, 160);
  return {
    user_id: null,
    query: `[click-out] /product/${slug}`,
    filters: {
      event: 'click_out',
      schema_version: ANALYTICS_SCHEMA_VERSION,
      product_slug: slug,
    },
    results_count: 1,
  };
}
