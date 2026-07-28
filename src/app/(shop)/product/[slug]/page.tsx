import { cache } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Leaf, ExternalLink, Globe, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatPrice, formatEcoScore, cn } from '@/lib/utils';
import { SITE_CONFIG } from '@/lib/config';
import { createPublicSupabaseClient } from '@/lib/supabase/public';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { AddToWishlistButton } from '@/components/product/AddToWishlistButton';
import { PriceAlertCard } from '@/components/product/PriceAlertCard';
import { hasWishlistItem, normalizeWishlistItems } from '@/lib/wishlist/items';
import { readPriceAlertState } from '@/lib/alerts/read';
import { ShareButton } from '@/components/product/ShareButton';
import { buildProductJsonLd, serializeJsonLd } from '@/lib/seo/jsonLd';

type ProductDetail = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  price_cents: number;
  currency: string;
  image_url: string;
  source_url: string;
  affiliate_url: string | null;
  attributes: Record<string, string>;
  eco_tags: string[];
  in_stock: boolean;
  store_name: string;
  store_slug: string;
  country: string | null;
  store_eco_score: number;
  store_values: string[];
  short_description: string | null;
  verified: boolean;
  niche: string;
};

const fetchProduct = cache(async (slug: string): Promise<ProductDetail | null> => {
  const sb = createPublicSupabaseClient();
  const { data } = await sb
    .from('v_products_with_store')
    .select(
      'id, slug, title, description, price_cents, currency, image_url, source_url, affiliate_url, attributes, eco_tags, in_stock, store_name, store_slug, store_eco_score, store_values, country, short_description, verified, niche',
    )
    .eq('slug', slug)
    .eq('in_stock', true)
    .maybeSingle();
  if (!data) return null;
  const d = data as any; // The view Row type is permissive here until proper generation.
  return {
    id: d.id,
    slug: d.slug,
    title: d.title,
    description: d.description ?? null,
    price_cents: d.price_cents,
    currency: d.currency,
    image_url: d.image_url,
    source_url: d.source_url,
    affiliate_url: d.affiliate_url ?? null,
    attributes: (d.attributes ?? {}) as Record<string, string>,
    eco_tags: d.eco_tags ?? [],
    in_stock: d.in_stock,
    store_name: d.store_name,
    store_slug: d.store_slug,
    country: d.country ?? null,
    store_eco_score: d.store_eco_score,
    store_values: d.store_values ?? [],
    short_description: d.short_description ?? null,
    verified: d.verified ?? false,
    niche: d.niche,
  };
});

async function fetchInitialWishlistState(productId: string): Promise<boolean> {
  const sb = await createServerSupabaseClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return false;

  const { data } = await sb
    .from('wishlists')
    .select('items')
    .eq('user_id', user.id)
    .maybeSingle();
  const row = data as { items: unknown } | null;
  return hasWishlistItem(normalizeWishlistItems(row?.items), productId);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = await fetchProduct(slug);
  if (!p) return { title: 'Producto no encontrado' };
  const canonicalUrl = `${SITE_CONFIG.url.replace(/\/+$/, '')}/product/${p.slug}`;
  return {
    title: `${p.title} — ${p.store_name}`,
    description: (p.description ?? `${p.title} en ${p.store_name}`).slice(
      0,
      160,
    ),
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: p.title,
      description: p.description ?? '',
      images: [p.image_url],
      url: canonicalUrl,
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await fetchProduct(slug);
  if (!product) notFound();

  const [initiallyInWishlist, priceAlertState] = await Promise.all([
    fetchInitialWishlistState(product.id),
    readPriceAlertState(product.id),
  ]);
  const eco = formatEcoScore(product.store_eco_score);
  const canonicalUrl = `${SITE_CONFIG.url.replace(/\/+$/, '')}/product/${product.slug}`;
  const jsonLd = buildProductJsonLd({
    slug: product.slug,
    title: product.title,
    description: product.description,
    imageUrl: product.image_url,
    priceCents: product.price_cents,
    currency: product.currency,
    inStock: product.in_stock,
    storeName: product.store_name,
    storeSlug: product.store_slug,
    siteUrl: SITE_CONFIG.url,
  });

  return (
    <div className="container py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-primary">
          Inicio
        </Link>{' '}
        {' / '}
        <Link
          href={`/explore/${product.niche}`}
          className="capitalize hover:text-primary"
        >
          {product.niche.replace('-', ' ')}
        </Link>{' '}
        / <span className="text-foreground">{product.title}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr]">
        {/* Gallery */}
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-secondary/40">
          <Image
            src={product.image_url}
            alt={product.title}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
          />
          <div className="absolute right-3 top-3 flex flex-col gap-2">
            <ShareButton title={product.title} url={canonicalUrl} />
          </div>
        </div>

        {/* Details */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{product.store_name}</Badge>
            <Badge
              variant="eco"
              className={cn('border-transparent', eco.variant)}
            >
              Eco-score {product.store_eco_score}/100 · {eco.label}
            </Badge>
          </div>

          <h1 className="mt-4 font-display text-3xl md:text-4xl">
            {product.title}
          </h1>

          <div className="mt-4 flex items-baseline gap-3">
            <span className="font-display text-3xl text-primary">
              {formatPrice(product.price_cents, product.currency)}
            </span>
            {product.attributes?.['old_price_cents'] && (
              <span className="text-sm text-muted-foreground line-through">
                {formatPrice(
                  Number(product.attributes['old_price_cents']),
                  product.currency,
                )}
              </span>
            )}
          </div>

          {product.eco_tags.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-1.5">
              {product.eco_tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs text-emerald-800"
                >
                  <Leaf className="h-3 w-3" /> {t}
                </span>
              ))}
            </div>
          )}

          {product.description && (
            <p className="mt-6 leading-relaxed text-muted-foreground">
              {product.description}
            </p>
          )}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="flex-1 gap-2">
              <a
                href={`/go/${product.slug}`}
                target="_blank"
                rel="sponsored noopener noreferrer"
              >
                Ver en {product.store_name} <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
            <AddToWishlistButton
              productId={product.id}
              initiallyInWishlist={initiallyInWishlist}
              className="flex-1"
              size="lg"
              variant="outline"
            />
          </div>

          <PriceAlertCard
            productId={product.id}
            productSlug={product.slug}
            currentPriceCents={product.price_cents}
            currency={product.currency}
            initialState={priceAlertState}
          />

          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Al hacer click en &quot;Ver en {product.store_name}&quot; podemos
            recibir una pequeña comisión de afiliado.{' '}
            <strong>No tiene coste extra para ti.</strong> Lee más en nuestra{' '}
            <Link href="/legal" className="underline">
              divulgación FTC / UE
            </Link>
            .
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3 rounded-2xl border border-border/60 bg-secondary/30 p-4 text-sm">
            <div className="flex items-start gap-2">
              <Globe className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <div className="font-medium">
                  {product.country
                    ? `Marca de ${product.country}`
                    : 'Origen no especificado'}
                </div>
                <div className="text-xs text-muted-foreground">
                  Procedencia declarada de la tienda
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <RotateCcw className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <div className="font-medium">Envíos y devoluciones</div>
                <div className="text-xs text-muted-foreground">
                  Consulta las condiciones en {product.store_name}
                </div>
              </div>
            </div>
          </div>

          {/* Store block */}
          <div className="mt-8 rounded-2xl border border-border/60 bg-card p-5">
            <div className="flex items-baseline justify-between gap-3">
              <Link
                href={`/store/${product.store_slug}`}
                className="font-display text-lg hover:underline"
              >
                {product.store_name}
                {product.verified && (
                  <span
                    className="ml-1.5 inline-block h-4 w-4 align-middle text-primary"
                    aria-label="Verified"
                  >
                    ✓
                  </span>
                )}
              </Link>
              <Link
                href={`/store/${product.store_slug}`}
                className="text-xs text-muted-foreground hover:text-primary"
              >
                Ver tienda →
              </Link>
            </div>
            {product.short_description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {product.short_description}
              </p>
            )}
            {product.store_values.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {product.store_values.map((v) => (
                  <Badge key={v} variant="secondary">
                    {v}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="mt-12 max-w-2xl text-xs text-muted-foreground">
        {SITE_CONFIG.legalDisclaimer}
      </p>
    </div>
  );
}
