import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Badge } from '@/components/ui/badge';
import { ProductGrid } from '@/components/product/ProductGrid';
import { CollectionSpotlight } from '@/components/collection/CollectionSpotlight';
import { Pagination } from '@/components/pagination/Pagination';
import {
  NICHE_LABEL,
  NicheId,
  SITE_CONFIG,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
} from '@/lib/config';
import { createPublicSupabaseClient } from '@/lib/supabase/public';
import { normalizePageNumber } from '@/lib/search/input';

type ProductHit = Parameters<typeof ProductGrid>[0]['products'][number];

async function fetchProductsByNiche(
  niche: NicheId,
  pageSize: number,
  offset: number
): Promise<{ products: ProductHit[]; total: number }> {
  const sb = createPublicSupabaseClient();
  const { data, count } = await sb
    .from('v_products_with_store')
    .select(
      'id, slug, title, image_url, price_cents, currency, store_name, store_slug, niche, eco_tags, store_eco_score',
      { count: 'exact' }
    )
    .eq('niche', niche)
    .eq('in_stock', true)
    .range(offset, offset + pageSize - 1);
  return {
    products: (data ?? []) as ProductHit[],
    total: typeof count === 'number' ? count : 0,
  };
}

export async function generateStaticParams() {
  return SITE_CONFIG.primaryNiches.map((niche) => ({ niche }));
}

// Render any unscheduled niche on-demand (defensive: ensures /explore/<x>
// is reachable even if Vercel's static-build cache missed a recent niche
// add). Costs an extra RSC render per uncached request; negligible traffic.
export const dynamicParams = true;

// ISR: re-render the page every 60s so stock changes in the Supabase
// v_products_with_store view (filtered by in_stock=true) propagate to
// visitors without needing a full Vercel redeploy.
export const revalidate = 60;

function normalizeNicheSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ niche: string }>;
}): Promise<Metadata> {
  const { niche: rawNiche } = await params;
  const normalized = normalizeNicheSlug(rawNiche ?? '');
  if (!SITE_CONFIG.primaryNiches.includes(normalized as NicheId)) {
    return { title: 'Nicho no encontrado', robots: { index: false } };
  }

  const niche = normalized as NicheId;
  const meta = NICHE_LABEL[niche];
  const title = `${meta.label}: productos y tiendas independientes`;
  const description = `${meta.tagline} Descubre una selección curada en Shopifind.`;
  const url = `${SITE_CONFIG.url}/explore/${niche}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      title,
      description,
      url,
      siteName: SITE_CONFIG.name,
      locale: 'es_ES',
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function ExploreNichePage({
  params,
  searchParams,
}: {
  params: Promise<{ niche: string }>;
  searchParams: Promise<{ page?: string; page_size?: string }>;
}) {
  const [resolvedParams, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);
  // Spanish speakers naturally type the URL with a tilde ("iluminación").
  // Strip diacritics via Unicode NFD decomposition + remove combining marks
  // so "iluminación" resolves to the canonical ASCII slug "iluminacion".
  // When the typed form differs from the canonical form, 301-redirect so
  // Google sees ONE canonical URL (no duplicate-content split) and visitors
  // land on the form that matches `generateStaticParams()`.
  const normalized = normalizeNicheSlug(resolvedParams.niche ?? '');
  if (normalized !== resolvedParams.niche) {
    redirect(`/explore/${normalized}`);
  }
  if (!SITE_CONFIG.primaryNiches.includes(normalized as NicheId)) notFound();
  const niche = normalized as NicheId;
  const meta = NICHE_LABEL[niche];

  // Pagination (server-clamped so users can't pass page=-1 or page_size=9999).
  const page = normalizePageNumber(resolvedSearchParams.page);
  const pageSize = (() => {
    const n = Number(resolvedSearchParams.page_size);
    if (!Number.isFinite(n) || n < MIN_PAGE_SIZE) return DEFAULT_PAGE_SIZE;
    return Math.min(MAX_PAGE_SIZE, Math.floor(n));
  })();
  const offset = (page - 1) * pageSize;
  const { products, total } = await fetchProductsByNiche(niche, pageSize, offset);

  return (
    <div className="container py-12">
      <header className="mb-10">
        <Badge variant="eco" className="mb-3 inline-flex w-fit">
          {meta.emoji} Nicho curado
        </Badge>
        <h1 className="font-display text-4xl md:text-5xl">{meta.label}</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">{meta.tagline}</p>
        <nav className="mt-6 flex flex-wrap gap-2">
          {SITE_CONFIG.primaryNiches.map((n) => (
            <Link
              key={n}
              href={`/explore/${n}`}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                n === niche
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background hover:border-primary hover:text-primary'
              }`}
            >
              {NICHE_LABEL[n as NicheId].emoji} {NICHE_LABEL[n as NicheId].label}
            </Link>
          ))}
        </nav>
      </header>

      {/* Editorial spotlight — only the iluminacion niche has curated
          Verano 2026 capsules for now; other niches re-use the default
          ProductGrid without a spotlight band. Conditional render keeps
          /explore/<other> free of empty-state spotlight. */}
      {niche === 'iluminacion' && (
        <CollectionSpotlight niche={niche} />
      )}

      <ProductGrid
        products={products}
        emptyMessage={
          total === 0
            ? 'Aún estamos curando tiendas en este nicho. Vuelve en unos días.'
            : 'No hay productos en esta página.'
        }
      />

      <Pagination
        currentPage={page}
        pageSize={pageSize}
        total={total}
        basePath={`/explore/${niche}`}
      />
    </div>
  );
}
