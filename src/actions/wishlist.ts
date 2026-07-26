'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { sendWishlistPriceAlert } from '@/lib/email/resend';

const AddItemSchema = z.object({
  productId: z.string().uuid(),
  storeUrl: z.string().url().optional(),
  priceWhenAdded: z.number().int().nonnegative(),
  notify: z.boolean().default(true),
});

export type WishlistItem = {
  product_id: string;
  store_url?: string;
  price_when_added: number;
  notify: boolean;
  added_at: string;
};

/**
 * Cast result of a typed Supabase query as our row shape.
 * Centralised so we can swap in proper inference later.
 */
type WishlistRow = { items: unknown } | null;
async function readWishlist(sb: ReturnType<typeof createServerSupabaseClient>, userId: string): Promise<WishlistRow> {
  const res = await sb.from('wishlists').select('items').eq('user_id', userId).maybeSingle();
  return res.data as WishlistRow;
}

async function requireUser() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/wishlist');
  return { supabase, user };
}

export async function addToWishlist(input: z.infer<typeof AddItemSchema>) {
  const parsed = AddItemSchema.parse(input);
  const { supabase, user } = await requireUser();

  const row = await readWishlist(supabase, user.id);
  const items = (row?.items ?? []) as WishlistItem[];
  if (items.some((it) => it.product_id === parsed.productId)) {
    return { ok: true, already: true };
  }

  const next: WishlistItem[] = [
    ...items,
    {
      product_id: parsed.productId,
      store_url: parsed.storeUrl,
      price_when_added: parsed.priceWhenAdded,
      notify: parsed.notify,
      added_at: new Date().toISOString(),
    },
  ];

  const { error } = await supabase
    .from('wishlists')
    .upsert({ user_id: user.id, items: next, updated_at: new Date().toISOString() } as never);
  if (error) throw new Error(`addToWishlist: ${error.message}`);
  revalidatePath('/wishlist');
  return { ok: true };
}

export async function removeFromWishlist(productId: string) {
  const { supabase, user } = await requireUser();
  const row = await readWishlist(supabase, user.id);
  const items = (row?.items ?? []) as WishlistItem[];
  const next = items.filter((it) => it.product_id !== productId);

  const { error } = await supabase
    .from('wishlists')
    .upsert({ user_id: user.id, items: next, updated_at: new Date().toISOString() } as never);
  if (error) throw new Error(`removeFromWishlist: ${error.message}`);
  revalidatePath('/wishlist');
  return { ok: true };
}

export { sendWishlistPriceAlert };
