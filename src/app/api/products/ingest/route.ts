import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { safeSecretEquals } from '@/lib/http/secrets';

const ProductUpsertSchema = z.object({
  store_slug: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string().optional(),
  price_cents: z.number().int().nonnegative(),
  currency: z.string().default('EUR'),
  image_url: z.string().url(),
  source_url: z.string().url(),
  category_id: z.string().optional(),
  eco_tags: z.array(z.string()).default([]),
  attributes: z
    .record(z.union([z.string(), z.number(), z.boolean()]))
    .default({}),
  in_stock: z.boolean().default(true),
});

/**
 * Protected cron endpoint to ingest products from Skimlinks / direct feeds.
 *
 * Authorization: header `x-ingest-secret` must match INGEST_SECRET env var.
 *
 * Example vercel.json:
 *   { "crons": [{ "path": "/api/products/ingest", "schedule": "0 3 * * *" }] }
 */
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-ingest-secret');
  if (!safeSecretEquals(secret, process.env.INGEST_SECRET)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const sb = createAdminSupabaseClient();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = ProductUpsertSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );

  // Resolve store_id by slug.
  const storeRes = await sb
    .from('stores')
    .select('id')
    .eq('slug', parsed.data.store_slug)
    .single();
  const store = storeRes.data as { id: string } | null;
  if (!store?.id)
    return NextResponse.json({ error: 'store_not_found' }, { status: 404 });

  const { data, error } = await sb
    .from('products')
    .upsert(
      {
        store_id: store.id,
        slug: parsed.data.slug,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        price_cents: parsed.data.price_cents,
        currency: parsed.data.currency,
        image_url: parsed.data.image_url,
        source_url: parsed.data.source_url,
        category_id: parsed.data.category_id ?? null,
        eco_tags: parsed.data.eco_tags,
        attributes: parsed.data.attributes,
        in_stock: parsed.data.in_stock,
        last_seen_at: new Date().toISOString(),
      } as never,
      { onConflict: 'slug' },
    )
    .select('id')
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? 'upsert_failed' },
      { status: 500 },
    );
  }
  const out = data as { id: string };
  return NextResponse.json({ ok: true, id: out.id });
}
