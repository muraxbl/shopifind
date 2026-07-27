import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { ProductGrid } from '@/components/product/ProductGrid';
import { NICHE_LABEL, NicheId, SITE_CONFIG } from '@/lib/config';
import { createServerSupabaseClient } from '@/lib/supabase/server';

type ProductHit = Parameters<typeof ProductGrid>[0]['products'][number];

async function fetchProductsByNiche(niche: NicheId, limit = 48): Promise<ProductHit[]> {
  const sb = createServerSupabaseClient();
  const { data } = await sb
    .from('v_products_with_store')
    .select('id, slug, title, image_url, price_cents, currency, store_name, store_slug, niche, eco_tags, store_eco_score')
    .eq('niche', niche)
    .eq('in_stock', true)
    .limit(limit);
  return (data ?? []) as ProductHit[];
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

export default async function ExploreNichePage({
  params,
}: {
  params: { niche: string };
}) {
  // Spanish speakers naturally type the URL with a tilde ("iluminación").
  // Strip diacritics via Unicode NFD decomposition + remove combining marks
  // so "iluminación" resolves to the canonical ASCII slug "iluminacion".
  // When the typed form differs from the canonical form, 301-redirect so
  // Google sees ONE canonical URL (no duplicate-content split) and visitors
  // land on the form that matches `generateStaticParams()`.
  const normalized = (params.niche ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (normalized !== params.niche) {
    redirect(`/explore/${normalized}`);
  }
  if (!SITE_CONFIG.primaryNiches.includes(normalized as NicheId)) notFound();
  const niche = normalized as NicheId;
  const meta = NICHE_LABEL[niche];
  const products = await fetchProductsByNiche(niche);

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

      <ProductGrid
        products={products}
        emptyMessage="Aún estamos curando tiendas en este nicho. Vuelve en unos días."
      />
    </div>
  );
}
