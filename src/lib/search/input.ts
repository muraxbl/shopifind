import { SITE_CONFIG, type NicheId } from '@/lib/config';

export const SEARCH_SORTS = [
  'relevance',
  'price_asc',
  'price_desc',
  'newest',
] as const;

export type SearchSort = (typeof SEARCH_SORTS)[number];

export const MAX_PAGE_NUMBER = 100;

export function normalizePageNumber(value: unknown): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(MAX_PAGE_NUMBER, Math.floor(parsed));
}

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
