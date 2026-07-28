import { NextResponse, type NextRequest } from 'next/server';
import {
  buildMasterledProduct,
  isAllowedMasterledFeedUrl,
  parseMasterledFeed,
} from '@/lib/feeds/masterled';
import { hasValidBearerSecret } from '@/lib/http/secrets';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_FEED_BYTES = 8 * 1024 * 1024;
const ABSOLUTE_MIN_ROWS = 1_000;
const BATCH_SIZE = 150;

export async function GET(request: NextRequest) {
  if (
    !hasValidBearerSecret(
      request.headers.get('authorization'),
      process.env.CRON_SECRET,
    )
  ) {
    return NextResponse.json(
      { ok: false, error: 'unauthorized' },
      { status: 401 },
    );
  }

  const feedUrl = process.env.MASTERLED_FEED_URL ?? '';
  if (!isAllowedMasterledFeedUrl(feedUrl)) {
    return NextResponse.json(
      { ok: false, error: 'feed_not_configured' },
      { status: 503 },
    );
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { ok: false, error: 'database_not_configured' },
      { status: 503 },
    );
  }

  const sb = createAdminSupabaseClient();
  const historyCheck = await sb
    .from('price_history')
    // Do not use HEAD here: PostgREST may return 204 even when the relation is
    // missing from its schema cache. A one-row GET fails reliably with PGRST205.
    .select('id')
    .limit(1);
  if (historyCheck.error) {
    return NextResponse.json(
      { ok: false, error: 'price_history_not_ready' },
      { status: 503 },
    );
  }

  let response: Response;
  try {
    response = await fetch(feedUrl, {
      cache: 'no-store',
      headers: { 'user-agent': 'ShopifindPriceRefresh/1.0' },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'feed_unavailable' },
      { status: 502 },
    );
  }
  if (!response.ok) {
    return NextResponse.json(
      { ok: false, error: 'feed_unavailable' },
      { status: 502 },
    );
  }

  const declaredSize = Number(response.headers.get('content-length') ?? 0);
  if (declaredSize > MAX_FEED_BYTES) {
    return NextResponse.json(
      { ok: false, error: 'feed_too_large' },
      { status: 413 },
    );
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_FEED_BYTES) {
    return NextResponse.json(
      { ok: false, error: 'feed_too_large' },
      { status: 413 },
    );
  }

  const parsed = parseMasterledFeed(new TextDecoder().decode(buffer));
  const requiredHeaders = [
    'id_product',
    'id_product_attribute',
    'nombre',
    'precio',
    'stock',
    'Imagen 1',
  ];
  if (requiredHeaders.some((header) => !parsed.headers.includes(header))) {
    return NextResponse.json(
      { ok: false, error: 'feed_schema_invalid' },
      { status: 422 },
    );
  }

  const storeResult = await sb
    .from('stores')
    .select('id')
    .eq('slug', 'masterled-es')
    .eq('active', true)
    .single();
  const store = storeResult.data as { id: string } | null;
  if (storeResult.error || !store) {
    return NextResponse.json(
      { ok: false, error: 'store_not_ready' },
      { status: 503 },
    );
  }

  const currentResult = await sb
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', store.id);
  if (currentResult.error) {
    return NextResponse.json(
      { ok: false, error: 'catalog_read_failed' },
      { status: 502 },
    );
  }
  const minimumRows = Math.max(
    ABSOLUTE_MIN_ROWS,
    Math.floor((currentResult.count ?? 0) * 0.8),
  );
  if (parsed.validRows.length < minimumRows) {
    return NextResponse.json(
      {
        ok: false,
        error: 'feed_incomplete',
        rows: parsed.validRows.length,
        minimum: minimumRows,
      },
      { status: 422 },
    );
  }

  const observedAt = new Date().toISOString();
  const products = parsed.validRows.map((row) =>
    buildMasterledProduct(row, store.id, observedAt),
  );
  for (let index = 0; index < products.length; index += BATCH_SIZE) {
    const batch = products.slice(index, index + BATCH_SIZE);
    const result = await sb
      .from('products')
      .upsert(batch as never, { onConflict: 'slug' });
    if (result.error) {
      return NextResponse.json(
        {
          ok: false,
          error: 'batch_upsert_failed',
          completed_batches: Math.floor(index / BATCH_SIZE),
        },
        { status: 502 },
      );
    }
  }

  const staleCountResult = await sb
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', store.id)
    .eq('in_stock', true)
    .lt('last_seen_at', observedAt);
  if (staleCountResult.error) {
    return NextResponse.json(
      { ok: false, error: 'stale_read_failed' },
      { status: 502 },
    );
  }

  const staleUpdate = await sb
    .from('products')
    .update({ in_stock: false } as never)
    .eq('store_id', store.id)
    .eq('in_stock', true)
    .lt('last_seen_at', observedAt);
  if (staleUpdate.error) {
    return NextResponse.json(
      { ok: false, error: 'stale_update_failed' },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    observed_at: observedAt,
    feed_rows: parsed.rows.length,
    products_seen: products.length,
    products_in_stock: products.filter((product) => product.in_stock).length,
    products_marked_out_of_stock: staleCountResult.count ?? 0,
  });
}
