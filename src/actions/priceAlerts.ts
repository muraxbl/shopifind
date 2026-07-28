'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { normalizePriceAlertInput } from '@/lib/alerts/input';

export type PriceAlertActionResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | 'unauthenticated'
        | 'invalid_input'
        | 'invalid_target'
        | 'invalid_percentage'
        | 'target_not_below_current'
        | 'product_unavailable'
        | 'alerts_unavailable'
        | 'save_failed';
    };

export async function savePriceAlert(
  input: unknown,
): Promise<PriceAlertActionResult> {
  const parsed = normalizePriceAlertInput(input);
  if (!parsed.success) return { ok: false, error: parsed.error };

  const sb = createServerSupabaseClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const productResult = await sb
    .from('v_products_with_store')
    .select('id, slug, price_cents')
    .eq('id', parsed.data.productId)
    .eq('in_stock', true)
    .maybeSingle();
  const product = productResult.data as {
    id: string;
    slug: string;
    price_cents: number;
  } | null;
  if (productResult.error || !product) {
    return { ok: false, error: 'product_unavailable' };
  }
  if (
    parsed.data.targetPriceCents !== null &&
    parsed.data.targetPriceCents >= product.price_cents
  ) {
    return { ok: false, error: 'target_not_below_current' };
  }

  const historyResult = await sb
    .from('price_history')
    .select('id')
    .eq('product_id', product.id)
    .order('observed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (historyResult.error) {
    return { ok: false, error: 'alerts_unavailable' };
  }
  const history = historyResult.data as { id: number } | null;

  const result = await sb.from('price_alerts').upsert(
    {
      user_id: user.id,
      product_id: product.id,
      mode: parsed.data.mode,
      baseline_price_cents: product.price_cents,
      target_price_cents: parsed.data.targetPriceCents,
      percentage_drop: parsed.data.percentageDrop,
      active: true,
      last_evaluated_history_id: history?.id ?? null,
      last_notified_price_cents: null,
      last_notified_at: null,
    } as never,
    { onConflict: 'user_id,product_id' },
  );
  if (result.error) {
    console.error('[price-alerts] save failed:', result.error.message);
    return { ok: false, error: 'save_failed' };
  }

  revalidatePath(`/product/${product.slug}`);
  revalidatePath('/account');
  return { ok: true };
}

export async function disablePriceAlert(
  productId: string,
): Promise<PriceAlertActionResult> {
  const parsed = normalizePriceAlertInput({ productId, mode: 'any_drop' });
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  const sb = createServerSupabaseClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const result = await sb
    .from('price_alerts')
    .update({ active: false } as never)
    .eq('user_id', user.id)
    .eq('product_id', parsed.data.productId);
  if (result.error) {
    console.error('[price-alerts] disable failed:', result.error.message);
    return { ok: false, error: 'save_failed' };
  }

  revalidatePath('/account');
  return { ok: true };
}
