'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  appendWishlistItem,
  hasWishlistItem,
  normalizeWishlistItems,
  withoutWishlistItem,
} from '@/lib/wishlist/items';

const AddItemSchema = z.object({
  productId: z.string().uuid(),
  notify: z.boolean().default(true),
});
const ProductIdSchema = z.string().uuid();

/**
 * Cast result of a typed Supabase query as our row shape.
 * Centralised so we can swap in proper inference later.
 */
type WishlistRow = { items: unknown } | null;
async function readWishlist(
  sb: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
): Promise<WishlistRow> {
  const res = await sb.from('wishlists').select('items').eq('user_id', userId).maybeSingle();
  return res.data as WishlistRow;
}

async function requireUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/wishlist');
  return { supabase, user };
}

export async function addToWishlist(input: z.infer<typeof AddItemSchema>) {
  const parsed = AddItemSchema.parse(input);
  const { supabase, user } = await requireUser();

  // Price and merchant URL are authoritative catalogue data. Never trust
  // client-supplied values for future price-drop calculations or redirects.
  const productRes = await supabase
    .from('v_products_with_store')
    .select('id, slug, source_url, price_cents')
    .eq('id', parsed.productId)
    .eq('in_stock', true)
    .maybeSingle();
  const product = productRes.data as {
    id: string;
    slug: string;
    source_url: string;
    price_cents: number;
  } | null;
  if (productRes.error || !product) {
    throw new Error('El producto ya no está disponible.');
  }

  const row = await readWishlist(supabase, user.id);
  const items = normalizeWishlistItems(row?.items);
  if (hasWishlistItem(items, parsed.productId)) {
    return { ok: true, already: true };
  }

  const next = appendWishlistItem(items, {
    product_id: product.id,
    store_url: product.source_url,
    price_when_added: product.price_cents,
    notify: parsed.notify,
    added_at: new Date().toISOString(),
  });

  const { error } = await supabase
    .from('wishlists')
    .upsert({ user_id: user.id, items: next, updated_at: new Date().toISOString() } as never);
  if (error) throw new Error(`addToWishlist: ${error.message}`);
  revalidatePath('/wishlist');
  revalidatePath(`/product/${product.slug}`);
  return { ok: true };
}

export async function removeFromWishlist(productId: string) {
  const parsedProductId = ProductIdSchema.parse(productId);
  const { supabase, user } = await requireUser();
  const row = await readWishlist(supabase, user.id);
  const items = normalizeWishlistItems(row?.items);
  const next = withoutWishlistItem(items, parsedProductId);

  const { error } = await supabase
    .from('wishlists')
    .upsert({ user_id: user.id, items: next, updated_at: new Date().toISOString() } as never);
  if (error) throw new Error(`removeFromWishlist: ${error.message}`);
  revalidatePath('/wishlist');
  return { ok: true };
}
