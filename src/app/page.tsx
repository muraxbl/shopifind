import Link from 'next/link';
import { ArrowRight, Sparkles, Leaf, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AiSearchBox } from '@/components/search/AiSearchBox';
import { ProductGrid } from '@/components/product/ProductGrid';
import { NICHE_LABEL, SITE_CONFIG, NicheId } from '@/lib/config';
import { createServerSupabaseClient } from '@/lib/supabase/server';

type FeaturedProduct = {
  id: string;
  slug: string;
  title: string;
  image_url: string;
  price_cents: number;
  currency: string;
  store_name: string;
  store_slug: string;
  niche: string;
  eco_tags: string[];
  store_eco_score: number;
};

async function fetchFeatured(limit = 8): Promise<FeaturedProduct[]> {
  const sb = createServerSupabaseClient();
  const { data } = await sb
    .from('v_products_with_store')
    .select('id, slug, title, price_cents, currency, image_url, store_name, store_slug, niche, eco_tags, store_eco_score')
    .eq('in_stock', true)
    .limit(limit);
  return (data ?? []) as FeaturedProduct[];
}

export default async function Home() {
  const products = await fetchFeatured(8);

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-b from-secondary/30 via-background to-background">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]"
        >
          <div className="absolute -top-32 left-1/2 h-96 w-[700px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        </div>

        <div className="container relative py-20 md:py-28">
          <Badge variant="eco" className="mx-auto mb-6 inline-flex w-fit">
            <Leaf className="mr-1.5 h-3 w-3" /> BETA · curaduría indie
          </Badge>
          <h1 className="mx-auto max-w-3xl text-center font-display text-4xl leading-tight md:text-6xl">
            Encuentra tiendas independientes{' '}
            <span className="text-primary">reales</span>.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-center text-lg text-muted-foreground">
            {SITE_CONFIG.description}
          </p>

          <div className="mx-auto mt-10 max-w-2xl">
            <AiSearchBox />
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
            <span>Explora por nicho:</span>
            {SITE_CONFIG.primaryNiches.map((n) => (
              <Link
                key={n}
                href={`/explore/${n}`}
                className="group rounded-full border border-border bg-background/80 px-3 py-1.5 transition-colors hover:border-primary hover:text-primary"
              >
                {NICHE_LABEL[n as NicheId].emoji} {NICHE_LABEL[n as NicheId].label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* VALUE PROP */}
      <section className="container py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              icon: <Sparkles className="h-5 w-5" />,
              title: 'Búsqueda conversacional',
              copy: 'Habla natural: “mochila sostenible ≤80€”. Nuestra IA traduce tu intención a filtros estructurados y encuentra tiendas que cumplen.',
            },
            {
              icon: <Leaf className="h-5 w-5" />,
              title: 'Marcas con valores',
              copy: 'Curamos marcas D2C independientes. Sin dropshipping genérico, sin markup masivo. Solo fabricantes y tiendas que conoces y quieres apoyar.',
            },
            {
              icon: <Heart className="h-5 w-5" />,
              title: 'Tu wishlist universal',
              copy: 'Guarda productos de cualquier tienda en una sola lista. Te avisamos cuando baja el precio o vuelven a estar en stock.',
            },
          ].map((card) => (
            <div
              key={card.title}
              className="rounded-2xl border border-border/60 bg-card p-6 transition-shadow hover:shadow-md"
            >
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                {card.icon}
              </div>
              <h3 className="mt-4 font-display text-xl">{card.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{card.copy}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURED PRODUCTS */}
      <section className="container pb-12">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl md:text-3xl">Descubrimientos recientes</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Lo último que hemos indexado en los 3 nichos del MVP.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/explore/sustainable-fashion">
              Ver todo <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        <ProductGrid products={products} />
      </section>

      {/* ETHICS STRIP */}
      <section className="container py-12">
        <div className="rounded-3xl border border-border/60 bg-secondary/30 p-8 md:p-12">
          <Badge variant="outline" className="mb-4">
            Por qué existimos
          </Badge>
          <h2 className="font-display text-2xl md:text-3xl">
            “Amazon lo tiene todo” ≠ “quiero comprar ahí”.
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Shopifind no reemplaza tu búsqueda. Te ayuda cuando quieres{' '}
            <em>descubrir</em>: tiendas pequeñas con identidad, materiales responsables, ética
            verificable y un maker detrás. Si sabes lo que buscas, usa Google. Si sabes qué te importa
            pero no la tienda, usa Shopifind.
          </p>
        </div>
      </section>

      {/* LEGAL CTA */}
      <section className="container pb-16 text-center">
        <p className="text-xs text-muted-foreground">
          {SITE_CONFIG.legalDisclaimer}
          {' '}
          <Link href="/legal" className="underline hover:text-primary">Leer más</Link>.
        </p>
      </section>
    </>
  );
}
