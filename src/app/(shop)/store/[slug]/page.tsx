import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { BadgeCheck, Globe, Leaf } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ProductGrid } from '@/components/product/ProductGrid';
import { formatEcoScore, cn } from '@/lib/utils';
import { SITE_CONFIG } from '@/lib/config';
import { createPublicSupabaseClient } from '@/lib/supabase/public';

export const revalidate = 60;

type StoreRow = {
  id: string;
  slug: string;
  name: string;
  country: string | null;
  eco_score: number;
  values: string[];
  short_description: string | null;
  long_description: string | null;
  niche: string;
  verified: boolean;
  featured: boolean;
};

type ProductHit = Parameters<typeof ProductGrid>[0]['products'][number];

export async function generateStaticParams() {
  const sb = createPublicSupabaseClient();
  const { data } = await sb.from('stores').select('slug').eq('active', true);
  return (data ?? []).map(({ slug }) => ({ slug }));
}

async function fetchStore(slug: string): Promise<(StoreRow & { products: ProductHit[] }) | null> {
  const sb = createPublicSupabaseClient();
  const storeRes = await sb
    .from('stores')
    .select('id, slug, name, country, eco_score, values, short_description, long_description, niche, verified, featured')
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle();
  const store = storeRes.data as StoreRow | null;
  if (!store) return null;

  const productsRes = await sb
    .from('v_products_with_store')
    .select('id, slug, title, image_url, price_cents, currency, store_name, store_slug, niche, eco_tags, store_eco_score')
    .eq('store_slug', slug)
    .eq('in_stock', true)
    .limit(36);

  return { ...store, products: (productsRes.data ?? []) as unknown as ProductHit[] };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const s = await fetchStore(slug);
  if (!s) return { title: 'Tienda no encontrada', robots: { index: false } };

  const title = `${s.name}: productos de una tienda independiente`;
  const description = s.short_description ?? `Descubre los productos de ${s.name} en Shopifind.`;
  const url = `${SITE_CONFIG.url}/store/${s.slug}`;
  const shareImage = s.products[0]?.image_url;
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
      images: shareImage ? [{ url: shareImage, alt: s.name }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: shareImage ? [shareImage] : [],
    },
  };
}

export default async function StorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await fetchStore(slug);
  if (!store) notFound();
  const eco = formatEcoScore(store.eco_score);

  return (
    <div className="container py-12">
      <header className="rounded-3xl border border-border/60 bg-gradient-to-b from-secondary/40 to-background p-8 md:p-12">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="font-display text-4xl md:text-5xl">
            <span className="inline-flex items-center gap-2">
              {store.name}
              {store.verified && <BadgeCheck className="h-6 w-6 text-primary" />}
            </span>
          </h1>
          <div className="flex flex-wrap items-baseline gap-2">
            {store.featured && <Badge variant="eco">Featured</Badge>}
            <Badge className={cn('border-transparent', eco.variant)}>
              ● {eco.label} · {store.eco_score}/100
            </Badge>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {store.country && (
            <span className="inline-flex items-center gap-1">
              <Globe className="h-3.5 w-3.5" /> {store.country}
            </span>
          )}
          <Link href={`/explore/${store.niche}`} className="capitalize hover:text-primary">
            Nicho: {store.niche.replace('-', ' ')}
          </Link>
        </div>

        {store.short_description && (
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">{store.short_description}</p>
        )}

        {store.long_description && (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{store.long_description}</p>
        )}

        {store.values.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {store.values.map((v) => (
              <span
                key={v}
                className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-800"
              >
                <Leaf className="h-3 w-3" /> {v}
              </span>
            ))}
          </div>
        )}
      </header>

      <section className="mt-10">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 className="font-display text-2xl">Productos de la tienda</h2>
          <span className="text-sm text-muted-foreground">{store.products.length} productos</span>
        </div>
        <ProductGrid
          products={store.products}
          emptyMessage="Esta tienda aún no tiene productos activos en el índice."
        />
      </section>
    </div>
  );
}
