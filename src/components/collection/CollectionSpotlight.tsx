import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { createPublicSupabaseClient } from '@/lib/supabase/public';
import { SITE_CONFIG } from '@/lib/config';

/**
 * Server Component. Renders a horizontal grid of editorial_collections
 * filtered by `niche`, with the first product's image as the cover
 * (the collection page does the same fallback, this just renders a
 * preview strip on the niche hub).
 *
 * Why a Server Component:
 *   - Reads Supabase server-side via the stateless public client.
 *   - No interactivity needed; pure RSC render.
 *   - Shares the Next.js Data Cache with a 60-second revalidation window.
 *
 * Visual:
 *   - Desktop: 4-column grid (md/lg).
 *   - Mobile:  single-column stack.
 *   - Each card has image (or fallback placeholder), badge, title,
 *     subtitle 1-line, and an arrow.
 */
type CollectionRow = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  cover_image_url: string | null;
  product_ids: string[] | null;
};

type CollectionWithCover = CollectionRow & {
  cover: string | null;
  product_count: number;
};

async function fetchCollectionsForNiche(niche: string, limit = 4): Promise<CollectionWithCover[]> {
  const sb = createPublicSupabaseClient();
  // Pull editorial_collections rows (published=true, ordered by newest).
  const collRes = await sb
    .from('editorial_collections')
    .select('id, slug, title, subtitle, cover_image_url, product_ids, published_at')
    .eq('niche', niche)
    .eq('published', true)
    .order('published_at', { ascending: false })
    .limit(limit);
  const rows = (collRes.data ?? []) as CollectionRow[];
  if (rows.length === 0) return [];

  // Hydrate first product image for each collection (1 query via IN).
  const allIds = rows.flatMap((r) => (r.product_ids ?? []).slice(0, 1));
  let imageById = new Map<string, string>();
  if (allIds.length > 0) {
    const prodRes = await sb.from('products').select('id, image_url').in('id', allIds);
    for (const r of (prodRes.data ?? []) as Array<{ id: string; image_url: string | null }>) {
      if (r.image_url) imageById.set(r.id, r.image_url);
    }
  }

  return rows.map((r) => {
    const firstProductId = r.product_ids?.[0] ?? null;
    const cover = r.cover_image_url ?? (firstProductId ? imageById.get(firstProductId) ?? null : null);
    return {
      ...r,
      cover,
      product_count: (r.product_ids ?? []).length,
    };
  });
}

const PLACEHOLDER_COVER = 'https://placehold.co/600x400/111827/ffffff?text=Curadur%C3%ADa';

export async function CollectionSpotlight({ niche }: { niche: string }) {
  const collections = await fetchCollectionsForNiche(niche, 4);
  if (collections.length === 0) return null;

  return (
    <section
      aria-label={`Colecciones curadas de ${niche}`}
      className="mb-12 rounded-2xl border border-border/60 bg-secondary/20 p-6 md:p-8"
    >
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <Badge variant="eco" className="mb-2 inline-flex w-fit gap-1">
            <Sparkles className="h-3 w-3" /> Colecciones de temporada
          </Badge>
          <h2 className="font-display text-2xl md:text-3xl">Verano 2026 — cápsulas curadas</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Listas cortas con productos reales de masterled.es, ordenadas por utilidad y temporada.
          </p>
        </div>
      </div>

      <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {collections.map((c) => (
          <li key={c.id}>
            <Link
              href={`/collections/${c.slug}`}
              className="group flex h-full flex-col overflow-hidden rounded-xl border border-border/60 bg-card transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="relative aspect-[3/2] w-full overflow-hidden bg-secondary/40">
                <Image
                  src={c.cover ?? PLACEHOLDER_COVER}
                  alt={c.title}
                  width={600}
                  height={400}
                  className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                />
                <span className="absolute right-3 top-3 inline-flex items-center rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-medium text-foreground">
                  {c.product_count} productos
                </span>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h3 className="font-display text-lg leading-tight">{c.title}</h3>
                {c.subtitle && (
                  <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{c.subtitle}</p>
                )}
                <div className="mt-auto flex items-center gap-1 pt-3 text-sm font-medium text-primary">
                  Ver colección
                  <ArrowRight className="h-3.5 w-3.5 translate-x-0 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-xs text-muted-foreground">
        ¿Tienes una tienda o producto que creas que debería entrar en una cápsula? Escríbenos a{' '}
        <a href={`mailto:hola@${SITE_CONFIG.url.replace(/^https?:\/\//, '')}`} className="text-primary underline">
          hola@{SITE_CONFIG.url.replace(/^https?:\/\//, '')}
        </a>
        .
      </p>
    </section>
  );
}
