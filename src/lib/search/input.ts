import { SITE_CONFIG, type NicheId } from '@/lib/config';

export const SEARCH_SORTS = [
  'relevance',
  'price_asc',
  'price_desc',
  'newest',
] as const;

export type SearchSort = (typeof SEARCH_SORTS)[number];

export function isSearchSort(value: unknown): value is SearchSort {
  return (
    typeof value === 'string' &&
    (SEARCH_SORTS as readonly string[]).includes(value)
  );
}

export function normalizeNicheFilter(value: unknown): NicheId | null {
  if (typeof value !== 'string') return null;
  return (SITE_CONFIG.primaryNiches as readonly string[]).includes(value)
    ? (value as NicheId)
    : null;
}

export function normalizePriceCents(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }
  const cents = Math.round(value);
  return Number.isSafeInteger(cents) ? cents : null;
}
