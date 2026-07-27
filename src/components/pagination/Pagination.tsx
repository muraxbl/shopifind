import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Server Component — offset-based pagination nav rendered below a list of
 * items (ProductGrid on /explore/<niche>/ and /search). Plain <Link>
 * anchors so navigation works without any client-side JS.
 *
 * Props contract:
 *   - currentPage: 1-indexed page number the user is viewing.
 *   - pageSize:    items per page (must be > 0; the caller clamps invalid
 *                  values upstream so we don't re-validate here).
 *   - total:       total count of items that match the active filters.
 *   - basePath:    path prefix for the href (e.g. "/search" or
 *                  "/explore/iluminacion"). No trailing slash.
 *   - queryParams: existing query string to preserve (filters). Keys whose
 *                  value is null/undefined/'' are dropped.
 *
 * Behavior:
 *   - Returns null when totalPages <= 1 (single page → no nav needed).
 *   - Out-of-range currentPage is the caller's responsibility to clamp
 *     to the last valid page. We render a forward-link even if the
 *     user-requested page is empty (the destination page will render
 *     the empty ProductGrid with the nav).
 */
export interface PaginationProps {
  currentPage: number;
  pageSize: number;
  total: number;
  basePath: string;
  queryParams?: Record<string, string | number | null | undefined>;
}

function buildHref(
  basePath: string,
  queryParams: Record<string, string | number | null | undefined>,
  page: number,
  pageSize: number
): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(queryParams)) {
    if (v == null || v === '') continue;
    qs.set(k, String(v));
  }
  qs.set('page', String(page));
  qs.set('page_size', String(pageSize));
  return `${basePath}?${qs.toString()}`;
}

export function Pagination({
  currentPage,
  pageSize,
  total,
  basePath,
  queryParams = {},
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <nav
      aria-label="Paginación"
      className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border/60 pt-6"
    >
      <div className="text-sm text-muted-foreground">
        Página <span className="font-semibold text-foreground">{currentPage}</span> de{' '}
        <span className="font-semibold text-foreground">{totalPages}</span>
        <span className="ml-2 text-muted-foreground/70">\u00b7 {total} productos totales</span>
      </div>

      <div className="flex items-center gap-2">
        {hasPrev ? (
          <Link
            href={buildHref(basePath, queryParams, currentPage - 1, pageSize)}
            rel="prev"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-sm transition-colors hover:border-primary hover:text-primary"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Anterior
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className="inline-flex cursor-not-allowed items-center gap-1 rounded-md border border-border/40 bg-card/50 px-3 py-1.5 text-sm text-muted-foreground/60"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Anterior
          </span>
        )}

        {hasNext ? (
          <Link
            href={buildHref(basePath, queryParams, currentPage + 1, pageSize)}
            rel="next"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-sm transition-colors hover:border-primary hover:text-primary"
          >
            Siguiente <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className="inline-flex cursor-not-allowed items-center gap-1 rounded-md border border-border/40 bg-card/50 px-3 py-1.5 text-sm text-muted-foreground/60"
          >
            Siguiente <ChevronRight className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
    </nav>
  );
}
