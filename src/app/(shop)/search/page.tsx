import { Suspense } from 'react';
import { Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ProductGrid } from '@/components/product/ProductGrid';
import { AiSearchBox } from '@/components/search/AiSearchBox';
import { searchProducts } from '@/actions/search';

export const dynamic = 'force-dynamic';

type SearchParams = { q?: string; niche?: string; sort?: string; min?: string; max?: string; tag?: string };

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const q = (searchParams.q ?? '').trim();
  const filters = {
    q,
    niche: searchParams.niche ?? null,
    max_price_cents: searchParams.max ? Number(searchParams.max) * 100 : null,
    min_price_cents: searchParams.min ? Number(searchParams.min) * 100 : null,
    eco_tags: searchParams.tag ? [searchParams.tag] : [],
    sort: (searchParams.sort as 'relevance' | 'price_asc' | 'price_desc' | 'newest') ?? 'relevance',
  };

  // Run search (or empty list when no query).
  const products = q ? await searchProducts(filters) : [];

  return (
    <div className="container py-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Badge variant="eco" className="mb-3 inline-flex w-fit gap-1">
            <Sparkles className="h-3 w-3" /> AI search
          </Badge>
          <h1 className="font-display text-3xl md:text-4xl">
            {q ? <>Resultados para <span className="text-primary">“{q}”</span></> : '¿Qué estás buscando?'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {q
              ? `${products.length} productos en ${Object.values(filters).filter(Boolean).length} filtros.`
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
              {['Recientes', 'Precio ↑', 'Precio ↓'].map((label, i) => {
                const sorts: Array<'newest' | 'price_asc' | 'price_desc'> = ['newest', 'price_asc', 'price_desc'];
                const params = new URLSearchParams();
                if (q) params.set('q', q);
                params.set('sort', sorts[i]);
                return (
                  <a
                    key={label}
                    href={`/search?${params.toString()}`}
                    className="block rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    {label}
                  </a>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Nicho
            </h3>
            <div className="space-y-1">
              {[
                { id: '', label: 'Todos' },
                { id: 'sustainable-fashion', label: '👗 Moda sostenible' },
                { id: 'indie-gadgets', label: '🎛️ Gadgets indie' },
                { id: 'home-deco', label: '🏠 Deco & hogar' },
                { id: 'iluminacion', label: '💡 Iluminación' },
              ].map((n) => {
                const params = new URLSearchParams();
                if (q) params.set('q', q);
                if (n.id) params.set('niche', n.id);
                return (
                  <a key={n.id || 'all'} href={`/search?${params.toString()}`} className="block rounded-md px-2 py-1.5 text-sm hover:bg-accent">
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
              {['vegan', 'eu-made', 'recycled', 'handmade', 'b-corp', 'female-founded'].map((t) => {
                const params = new URLSearchParams();
                if (q) params.set('q', q);
                params.set('tag', t);
                return (
                  <a key={t} href={`/search?${params.toString()}`} className="rounded-full border border-border bg-card px-2.5 py-1 text-xs hover:border-primary hover:text-primary">
                    {t}
                  </a>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Results column */}
        <section>
          <Suspense>
            <ProductGrid products={products} emptyMessage="Nada coincide — prueba a quitar algún filtro o buscar con otras palabras." />
          </Suspense>

          <div className="mt-8">
            <AiSearchBox initialValue={q} />
          </div>
        </section>
      </div>
    </div>
  );
}
