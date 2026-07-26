import { notFound } from 'next/navigation';
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

export default async function ExploreNichePage({
  params,
}: {
  params: { niche: string };
}) {
  if (!SITE_CONFIG.primaryNiches.includes(params.niche as NicheId)) notFound();
  const niche = params.niche as NicheId;
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
