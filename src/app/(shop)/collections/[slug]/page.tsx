import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ProductGrid } from '@/components/product/ProductGrid';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { SITE_CONFIG } from '@/lib/config';
import { serializeJsonLd } from '@/lib/seo/jsonLd';

type CollectionRow = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  cover_image_url: string | null;
  niche: string | null;
  product_ids: string[];
  published_at: string | null;
};

type CollectionProduct = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  image_url: string;
  price_cents: number;
  currency: string;
  in_stock: boolean;
  store_name: string;
  store_slug: string;
  niche: string;
  eco_tags: string[];
  store_eco_score: number;
};

type ProductHit = CollectionProduct;

async function fetchCollection(slug: string): Promise<(CollectionRow & { products: ProductHit[] }) | null> {
  const sb = await createServerSupabaseClient();
  const collectionRes = await sb
    .from('editorial_collections')
    .select('id, slug, title, subtitle, description, cover_image_url, niche, product_ids, published_at')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();
  const collection = collectionRes.data as CollectionRow | null;
  if (!collection) return null;

  const ids = collection.product_ids ?? [];
  if (ids.length === 0) {
    return { ...collection, products: [] };
  }

  const productsRes = await sb
    .from('v_products_with_store')
    .select(
      'id, slug, title, description, image_url, price_cents, currency, in_stock, store_name, store_slug, niche, eco_tags, store_eco_score'
    )
    .in('id', ids.slice(0, 36));
  return { ...collection, products: (productsRes.data ?? []) as unknown as ProductHit[] };
}

/**
 * Build the JSON-LD ItemList payload injected as `<script type="application/ld+json">`.
 *
 * Why ItemList (not CollectionPage):
 *   Google rewards structured product lists with rich-result eligibility on the
 *   collection page. It also surfaces ItemList → Product on some merchant SERPs.
 *
 * Price policy:
 *   - Schema.org requires `price` as a decimal string ("89.00"), not integer cents.
 *   - `priceCurrency` MUST be ISO-4217 alpha-3 ("EUR").
 *   - `availability` MUST be a schema.org URL (InStock / OutOfStock).
 *   - We deliberately point `offers.url` at OUR product page, not the merchant's
 *     `source_url`, to keep the affiliate redirect flow intact (and to avoid
 *     leaking source URLs to ad-blockers on the public surface).
 *
 * Brand policy:
 *   - Use the merchant's display name as the `Brand`. If you ever ingest brand
 *     manufacturer separately from the merchant, add a `@id` here.
 */
function buildItemListJsonLd(
  collection: CollectionRow,
  products: ProductHit[]
): Record<string, unknown> {
  const url = `${SITE_CONFIG.url}/collections/${collection.slug}`;
  const description = collection.description ?? collection.subtitle ?? collection.title;
  // Mirror the same fallback chain used by generateMetadata so the JSON-LD
  // ItemList.image and the OG/Twitter share cards never disagree: cover first,
  // then the first product's image, then quietly absent.
  const shareImage = collection.cover_image_url ?? products[0]?.image_url ?? null;

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: collection.title,
    description,
    ...(shareImage ? { image: [shareImage] } : {}),
    url,
    numberOfItems: products.length,
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    itemListElement: products.map((p, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      item: {
        '@type': 'Product',
        name: p.title,
        description: p.description ?? undefined,
        image: p.image_url,
        url: `${SITE_CONFIG.url}/product/${p.slug}`,
        sku: p.slug,
        offers: {
          '@type': 'Offer',
          price: (p.price_cents / 100).toFixed(2),
          priceCurrency: p.currency,
          availability: p.in_stock
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
          url: `${SITE_CONFIG.url}/product/${p.slug}`,
          seller: {
            '@type': 'Organization',
            name: p.store_name,
            url: `${SITE_CONFIG.url}/store/${p.store_slug}`,
          },
        },
      },
    })),
  };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await fetchCollection(slug);
  if (!c) return { title: 'Colección' };
  const url = `${SITE_CONFIG.url}/collections/${c.slug}`;
  const description = c.description ?? c.subtitle ?? c.title;
  // Fallback to the first product image so social shares never produce an
  // empty preview card when the collection has no dedicated cover image yet.
  const shareImage = c.cover_image_url ?? c.products[0]?.image_url ?? null;
  const ogImages = shareImage
    ? [{ url: shareImage, width: 1200, height: 630, alt: c.title }]
    : [];
  return {
    title: c.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      title: c.title,
      description,
      url,
      siteName: SITE_CONFIG.name,
      locale: 'es_ES',
      images: ogImages,
    },
    twitter: {
      card: 'summary_large_image',
      title: c.title,
      description,
      images: shareImage ? [shareImage] : [],
    },
  };
}

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await fetchCollection(slug);
  if (!c) notFound();

  const jsonLd = buildItemListJsonLd(c, c.products);

  return (
    <article className="container py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <header className="mb-10 max-w-3xl">
        <Badge variant="eco" className="mb-3 inline-flex w-fit gap-1">
          <Sparkles className="h-3 w-3" /> Colección curada
        </Badge>
        <h1 className="font-display text-4xl md:text-5xl">{c.title}</h1>
        {c.subtitle && <p className="mt-3 text-xl text-muted-foreground">{c.subtitle}</p>}
        {c.description && (
          <p className="mt-5 leading-relaxed text-foreground/80">{c.description}</p>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          Publicada {c.published_at ? new Date(c.published_at).toLocaleDateString('es-ES') : 'recientemente'}
        </p>
      </header>

      <ProductGrid products={c.products} />

      <footer className="mt-16 rounded-2xl border border-border/60 bg-secondary/40 p-6 text-sm text-muted-foreground">
        ¿Te gustaría sugerir una tienda o producto para esta colección? Escríbenos a{' '}
        <a href="mailto:hola@shopifind.app" className="text-primary underline">hola@shopifind.app</a>.
      </footer>
    </article>
  );
}
