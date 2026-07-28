import { Suspense } from 'react';
import { Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ProductGrid } from '@/components/product/ProductGrid';
import { CompareSelectionProvider } from '@/components/compare/CompareSelection';
import { Pagination } from '@/components/pagination/Pagination';
import { AiSearchBox } from '@/components/search/AiSearchBox';
import { searchProducts } from '@/actions/search';
import { normalizeEcoTagFilters } from '@/lib/ai/queryIntent';
import {
  isSearchSort,
  normalizePageNumber,
  normalizeNicheFilter,
  normalizePriceCents,
} from '@/lib/search/input';
import {
  NICHE_FACET,
  DEFAULT_PAGE_SIZE,
  MIN_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '@/lib/config';

// Search results are by definition user-specific (queries + filters vary
// per visitor) — keep them out of the static cache so any change in
// filters re-renders the page fresh. Pagination + filters revalidate
// the data layer on every request.
export const dynamic = 'force-dynamic';

type SearchParams = {
  q?: string;
  niche?: string;
  sort?: string;
  min?: string;
  max?: string;
  tag?: string;
  page?: string;
  page_size?: string;
};

// Coerce a searchParams value to a clamped positive integer with a
// fallback. Used for ?page= and ?page_size=.
function clampInt(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

// Persist filter state into the pagination hrefs so users don't lose
// filters when they page through results.
function buildQueryParams(
  sp: SearchParams,
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  if (sp.q) out.q = sp.q;
  if (sp.niche) out.niche = sp.niche;
  if (sp.sort) out.sort = sp.sort;
  if (sp.tag) out.tag = sp.tag;
  if (sp.min) out.min = sp.min;
  if (sp.max) out.max = sp.max;
  return out;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const q = (resolvedSearchParams.q ?? '').trim();
  const page = normalizePageNumber(resolvedSearchParams.page);
  const pageSize = clampInt(
    resolvedSearchParams.page_size,
    DEFAULT_PAGE_SIZE,
    MIN_PAGE_SIZE,
    MAX_PAGE_SIZE,
  );
  const niche = normalizeNicheFilter(resolvedSearchParams.niche);
  const ecoTags = normalizeEcoTagFilters(
    resolvedSearchParams.tag ? [resolvedSearchParams.tag] : [],
  );
  const minPrice = normalizePriceCents(
    resolvedSearchParams.min ? Number(resolvedSearchParams.min) * 100 : null,
  );
  const maxPrice = normalizePriceCents(
    resolvedSearchParams.max ? Number(resolvedSearchParams.max) * 100 : null,
  );
  const sort = isSearchSort(resolvedSearchParams.sort)
    ? resolvedSearchParams.sort
    : undefined;
  const hasSearchCriteria =
    Boolean(q) ||
    niche !== null ||
    ecoTags.length > 0 ||
    minPrice !== null ||
    maxPrice !== null ||
    sort !== undefined;

  const filters = {
    q,
    niche,
    max_price_cents: maxPrice,
    min_price_cents: minPrice,
    eco_tags: ecoTags,
    sort,
    page,
    pageSize,
  };

  // Filter-only URLs are valid searches too (for example ?niche=iluminacion).
  const result = hasSearchCriteria
    ? await searchProducts(filters)
    : { products: [], total: 0 };
  const products = result.products;
  const total = result.total;

  function keepPriceFilters(params: URLSearchParams): void {
    if (minPrice !== null) params.set('min', String(minPrice / 100));
    if (maxPrice !== null) params.set('max', String(maxPrice / 100));
  }

  // Sort links — set sort + clear page to 1 (so we land on the new sort's
  // first page instead of carrying over a stale page index).
  function sortHref(sort: 'newest' | 'price_asc' | 'price_desc'): string {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (niche) p.set('niche', niche);
    if (ecoTags[0]) p.set('tag', ecoTags[0]);
    keepPriceFilters(p);
    p.set('sort', sort);
    return `/search?${p.toString()}`;
  }

  // Niche link — set niche + clear page.
  function nicheHref(nicheId: string): string {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (sort) p.set('sort', sort);
    if (ecoTags[0]) p.set('tag', ecoTags[0]);
    keepPriceFilters(p);
    if (nicheId) p.set('niche', nicheId);
    return `/search?${p.toString()}`;
  }

  // Eco-tag link.
  function tagHref(tag: string): string {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (niche) p.set('niche', niche);
    if (sort) p.set('sort', sort);
    keepPriceFilters(p);
    if (ecoTags[0] !== tag) p.set('tag', tag);
    return `/search?${p.toString()}`;
  }

  return (
    <div className="container py-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Badge variant="eco" className="mb-3 inline-flex w-fit gap-1">
            <Sparkles className="h-3 w-3" /> AI search
          </Badge>
          <h1 className="font-display text-3xl md:text-4xl">
            {q ? (
              <>
                Resultados para{' '}
                <span className="text-primary">&ldquo;{q}&rdquo;</span>
              </>
            ) : hasSearchCriteria ? (
              sort && !niche && ecoTags.length === 0 && minPrice === null && maxPrice === null
                ? 'Catálogo'
                : 'Productos filtrados'
            ) : (
              '¿Qué estás buscando?'
            )}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasSearchCriteria
              ? `${total} producto${total === 1 ? '' : 's'} · página ${page} de ${Math.max(
                  1,
                  Math.ceil(total / pageSize),
                )}.`
              : 'Describe con tus palabras qué quieres encontrar — la IA traduce la intención a filtros.'}
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_3fr]">
        {/* Filters sidebar */}
        <aside className="space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Filtros rápidos
            </h3>
            <div className="space-y-1">
              {[
                { label: 'Recientes', sort: 'newest' as const },
                { label: 'Precio \u2191', sort: 'price_asc' as const },
                { label: 'Precio \u2193', sort: 'price_desc' as const },
              ].map(({ label, sort }) => (
                <a
                  key={sort}
                  href={sortHref(sort)}
                  aria-current={resolvedSearchParams.sort === sort ? 'page' : undefined}
                  className={`block rounded-md px-2 py-1.5 text-sm hover:bg-accent ${
                    resolvedSearchParams.sort === sort
                      ? 'bg-accent font-medium text-primary'
                      : ''
                  }`}
                >
                  {label}
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Nicho
            </h3>
            <div className="space-y-1">
              {NICHE_FACET.map((n) => {
                const active =
                  (n.id === '' && niche === null) || niche === n.id;
                return (
                  <a
                    key={n.id || 'all'}
                    href={nicheHref(n.id)}
                    aria-current={active ? 'page' : undefined}
                    className={`block rounded-md px-2 py-1.5 text-sm hover:bg-accent ${
                      active ? 'bg-accent font-medium text-primary' : ''
                    }`}
                  >
                    {n.label}
                  </a>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Eco-tags
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {[
                'vegan',
                'eu-made',
                'recycled',
                'organic',
                'b-corp',
                'female-founded',
              ].map((t) => {
                const active = ecoTags[0] === t;
                return (
                  <a
                    key={t}
                    href={tagHref(t)}
                    aria-current={active ? 'page' : undefined}
                    className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card hover:border-primary hover:text-primary'
                    }`}
                  >
                    {t}
                  </a>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Results column */}
        <section>
          <CompareSelectionProvider>
            <Suspense>
              <ProductGrid
                products={products}
                compareEnabled
                emptyMessage="Nada coincide — prueba a quitar algún filtro o buscar con otras palabras."
              />
            </Suspense>
          </CompareSelectionProvider>

          <Pagination
            currentPage={page}
            pageSize={pageSize}
            total={total}
            basePath="/search"
            queryParams={buildQueryParams(resolvedSearchParams)}
          />

          <div className="mt-8">
            <AiSearchBox initialValue={q} />
          </div>
        </section>
      </div>
    </div>
  );
}
