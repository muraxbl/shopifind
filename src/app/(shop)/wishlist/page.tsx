import Link from 'next/link';
import { Heart, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProductCard } from '@/components/product/ProductCard';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type WishlistItem = { product_id: string; price_when_added: number };
type WishlistRow = { items: unknown } | null;
type WishlistProductHit = Parameters<typeof ProductCard>[0]['product'];

export default async function WishlistPage() {
  const sb = await createServerSupabaseClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    return (
      <div className="container flex min-h-[60vh] flex-col items-center justify-center py-12 text-center">
        <Heart className="h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 font-display text-3xl">Tu wishlist te espera</h1>
        <p className="mt-2 max-w-sm text-muted-foreground">
          Inicia sesión para guardar productos y seguir cómo cambia su precio.
        </p>
        <Button asChild className="mt-6">
          <Link href="/login?next=/wishlist">Entrar</Link>
        </Button>
      </div>
    );
  }

  const wishlistRes = await sb
    .from('wishlists')
    .select('items')
    .eq('user_id', user.id)
    .maybeSingle();
  const wishlist = wishlistRes.data as WishlistRow;
  const items = (wishlist?.items ?? []) as WishlistItem[];
  const productIds = items.map((i) => i.product_id);

  if (productIds.length === 0) {
    return (
      <div className="container flex min-h-[60vh] flex-col items-center justify-center py-12 text-center">
        <Heart className="h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 font-display text-3xl">Aún no has guardado nada</h1>
        <p className="mt-2 max-w-sm text-muted-foreground">
          Explora el catálogo y guarda cualquier producto con el icono de
          corazón.
        </p>
        <Button asChild className="mt-6 gap-2">
          <Link href="/">
            <Sparkles className="h-4 w-4" /> Explorar descubrimiento
          </Link>
        </Button>
      </div>
    );
  }

  const productsRes = await sb
    .from('v_products_with_store')
    .select(
      'id, slug, title, image_url, price_cents, currency, store_name, store_slug, niche, eco_tags, store_eco_score',
    )
    .in('id', productIds);
  const hits = (productsRes.data ?? []) as unknown as WishlistProductHit[];

  const drops = hits.map((p) => {
    const item = items.find((i) => i.product_id === p.id);
    if (item && p.price_cents < item.price_when_added) {
      return {
        product: p,
        dropped: { old: item.price_when_added, new: p.price_cents },
      };
    }
    return { product: p, dropped: null as null | { old: number; new: number } };
  });

  return (
    <div className="container py-12">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Badge variant="eco" className="mb-3 inline-flex w-fit gap-1">
            <Heart className="h-3 w-3 fill-current" /> Tu wishlist
          </Badge>
          <h1 className="font-display text-3xl md:text-4xl">
            Productos guardados
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {hits.length} productos · comparamos su precio actual con el que
            tenían al guardarlos.
          </p>
        </div>
      </header>

      {drops.some((d) => d.dropped) && (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <strong>
            🎉 {drops.filter((d) => d.dropped).length} producto(s) han bajado de
            precio.
          </strong>{' '}
          Ve ahora antes de que vuelva a subir.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {drops.map(({ product, dropped }) => (
          <div key={product.id} className="relative">
            <ProductCard product={product} wishlisted />
            {dropped && (
              <div className="absolute right-3 top-12 z-10 rounded-md bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white shadow-md">
                -{Math.round(((dropped.old - dropped.new) / dropped.old) * 100)}
                %
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
