import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { PriceAlertMode } from '@/lib/alerts/input';

export type PriceAlertState = {
  available: boolean;
  authenticated: boolean;
  alert: {
    mode: PriceAlertMode;
    targetPriceCents: number | null;
    percentageDrop: number | null;
    active: boolean;
  } | null;
};

export async function readPriceAlertState(
  productId: string,
): Promise<PriceAlertState> {
  const sb = await createServerSupabaseClient();
  const availability = await sb
    .from('price_history')
    // PostgREST can return 204 for HEAD even when a relation is absent from
    // the schema cache. A bounded GET is required for a trustworthy preflight.
    .select('id')
    .limit(1);
  if (availability.error) {
    return { available: false, authenticated: false, alert: null };
  }

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { available: true, authenticated: false, alert: null };

  const result = await sb
    .from('price_alerts')
    .select('mode, target_price_cents, percentage_drop, active')
    .eq('user_id', user.id)
    .eq('product_id', productId)
    .maybeSingle();
  if (result.error) {
    return { available: false, authenticated: true, alert: null };
  }
  const row = result.data as {
    mode: PriceAlertMode;
    target_price_cents: number | null;
    percentage_drop: number | null;
    active: boolean;
  } | null;
  return {
    available: true,
    authenticated: true,
    alert: row
      ? {
          mode: row.mode,
          targetPriceCents: row.target_price_cents,
          percentageDrop: row.percentage_drop,
          active: row.active,
        }
      : null,
  };
}
