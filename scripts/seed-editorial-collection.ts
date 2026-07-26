/**
 * scripts/seed-editorial-collection.ts
 * ============================================================================
 * Idempotent CLI that idempotently seeds the launch editorial collection
 *   slug: 'ethical-staples'
 *   6 sustainable-fashion products (curated from everlane-eu + b-corp-outfitters)
 *
 * It also UPSERTs the 4 newly-added SF products (so the collection has 6 items
 * in any environment — fresh dev DB, staging or production). Running it twice
 * is safe: every write uses `onConflict: 'slug'`.
 *
 * PREREQUISITE
 *   1. `pnpm add -D tsx`        # adds the runner (one-line devDep install)
 *   2. `next-pnpm-supabase-seed` # apply supabase/seed.sql FIRST (creates the
 *      6 stores + 6 SF products in store). The script also upserts the 4 new
 *      SF products so the order is forgiving — but it WILL fail loudly if
 *      everlane-eu or b-corp-outfitters are missing.
 *
 * RUN (from project root)
 *   pnpm scripts:seed:collection
 *   pnpm scripts:seed:collection -- --dry-run   # prints plan, writes nothing
 *
 * REQUIRED ENV (in .env.local or shell)
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * The script deliberately imports @supabase/supabase-js directly instead of
 * next-runtime helpers so it can run under bare Node + tsx without needing the
 * Next.js process. The service role key bypasses RLS; RLS still protects the
 * public-facing pages from anonymous edits.
 * ============================================================================
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

// ---------------------------------------------------------------------------
// Runtime config
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    '❌ Missing required env vars. Set both NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local or your shell.'
  );
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');

const sb = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

// ---------------------------------------------------------------------------
// Step 1 fixture — 4 new SF products to ensure exist before curation
// ---------------------------------------------------------------------------

interface ProductSeed {
  store_slug: string;
  slug: string;
  title: string;
  description: string;
  price_cents: number;
  image_url: string;
  source_url: string;
  eco_tags: string[];
  attributes: Record<string, string>;
}

const NEW_SF_PRODUCTS: ProductSeed[] = [
  {
    store_slug: 'everlane-eu',
    slug: 'everlane-organic-crew-tee',
    title: 'Organic Crew Tee — GOTS cotton',
    description:
      'Camiseta clásica en algodón 100% orgánico certificado GOTS, corte relajado y costuras laterales.',
    price_cents: 3500,
    image_url: 'https://placehold.co/600x600?text=Organic+Crew+Tee',
    source_url: 'https://www.everlane.com/products/organic-crew-tee',
    eco_tags: ['organic', 'cotton', 'transparent-pricing'],
    attributes: { material: 'GOTS organic cotton', fit: 'relaxed' },
  },
  {
    store_slug: 'everlane-eu',
    slug: 'everlane-renylon-puffer',
    title: 'ReNylon Puffer — recycled nylon',
    description:
      'Chaqueta térmica con relleno de nylon 100% reciclado, costuras termoselladas. Cálida hasta -5°C.',
    price_cents: 15000,
    image_url: 'https://placehold.co/600x600?text=ReNylon+Puffer',
    source_url: 'https://www.everlane.com/products/renylon-puffer',
    eco_tags: ['recycled', 'transparent-pricing'],
    attributes: { material: 'recycled nylon', warmth: 'heavy' },
  },
  {
    store_slug: 'b-corp-outfitters',
    slug: 'bcorp-lisbon-cardigan',
    title: 'Lisbon Cardigan — recycled wool',
    description:
      'Cardigan en lana reciclada, tejido en Lisboa por cooperativa femenina. Lavar a mano en agua fría.',
    price_cents: 9500,
    image_url: 'https://placehold.co/600x600?text=Lisbon+Cardigan',
    source_url: 'https://b-corp-outfitters.example.com/products/lisbon-cardigan',
    eco_tags: ['recycled', 'eu-made', 'female-founded'],
    attributes: { material: 'recycled wool', origin: 'Lisboa, PT' },
  },
  {
    store_slug: 'b-corp-outfitters',
    slug: 'bcorp-alentejo-dress',
    title: 'Alentejo Midi Dress — European linen',
    description:
      'Vestido midi en lino europeo de cultivo orgánico, tejido en Alentejo. Recomendado para climas secos; lavar en frío.',
    price_cents: 14500,
    image_url: 'https://placehold.co/600x600?text=Alentejo+Dress',
    source_url: 'https://b-corp-outfitters.example.com/products/alentejo-dress',
    eco_tags: ['organic', 'eu-made', 'fair-wage', 'female-founded'],
    attributes: { material: 'European linen', origin: 'Alentejo, PT' },
  },
];

// ---------------------------------------------------------------------------
// Step 2 fixture — curated set of 6 SF slugs (the collection payload)
// ---------------------------------------------------------------------------

const CURATION_SLUGS = [
  'everlane-renewed-tote', // 89€ — recycled cotton tote
  'everlane-organic-crew-tee', // 35€ — fundamentals tee
  'everlane-renylon-puffer', // 150€ — recycled nylon outerwear
  'bcorp-porto-tee', // 45€ — organic unisex tee
  'bcorp-lisbon-cardigan', // 95€ — recycled wool sweater
  'bcorp-alentejo-dress', // 145€ — linen midi dress
] as const;

// ---------------------------------------------------------------------------
// Step 3 fixture — the collection row itself
// ---------------------------------------------------------------------------

const COLLECTION = {
  slug: 'ethical-staples',
  title: 'Ethical Staples — fondo de armario ético',
  subtitle: '6 básicos en algodón orgánico y materiales reciclados, fabricados bajo estándares justos.',
  description:
    'Cápsula curada para iniciar tu armario ético: dos camisetas básicas en algodón orgánico, un tote reciclado, un jersey cálido en lana reciclada, una chaqueta térmica en nylon reciclado y un vestido midi en lino europeo de cultivo orgánico. Todas las marcas tienen programas de afiliación activos, transparencia verificable y fabricación europea o de proximidad.',
  cover_image_url: 'https://placehold.co/1200x630?text=Ethical+Staples',
  niche: 'sustainable-fashion',
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Report = {
  ok: boolean;
  dryRun: boolean;
  productsUpserted: string[];
  productsAlreadyExisted: string[];
  collectionSlug: string;
  collectionId: string | null;
  collectionProductIds: string[];
  collectionAlreadyPublished: boolean;
};

function logSection(label: string) {
  console.log(`\n── ${label} ${'─'.repeat(Math.max(0, 60 - label.length))}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(
    `▶ Seeding editorial collection '${COLLECTION.slug}' (niche=${COLLECTION.niche})${
      DRY_RUN ? ' [DRY RUN — no DB writes]' : ''
    }`
  );

  // -- 1. UPSERT 4 NEW SF PRODUCTS ------------------------------------------
  logSection('STEP 1 — ensure 4 new SF products exist');
  const storeSlugSet = [...new Set(NEW_SF_PRODUCTS.map((p) => p.store_slug))];
  const storeRes = await sb.from('stores').select('id, slug').in('slug', storeSlugSet);
  if (storeRes.error) throw new Error(`Store lookup failed: ${storeRes.error.message}`);

  const storeBySlug = new Map<string, string>();
  for (const row of storeRes.data ?? []) {
    const r = row as { id: string; slug: string };
    storeBySlug.set(r.slug, r.id);
  }

  const upserted: string[] = [];
  const alreadyExisted: string[] = [];

  for (const p of NEW_SF_PRODUCTS) {
    const storeId = storeBySlug.get(p.store_slug);
    if (!storeId) {
      throw new Error(
        `Store '${p.store_slug}' not found. Apply supabase/seed.sql first (pnpm supabase db reset, or run seed.sql in the Dashboard SQL Editor).`
      );
    }

    if (DRY_RUN) {
      console.log(`  · would upsert product ${p.slug}`);
      continue;
    }

    const up = await sb
      .from('products')
      .upsert(
        {
          store_id: storeId,
          slug: p.slug,
          title: p.title,
          description: p.description,
          price_cents: p.price_cents,
          currency: 'EUR',
          image_url: p.image_url,
          source_url: p.source_url,
          eco_tags: p.eco_tags,
          attributes: p.attributes,
          in_stock: true,
          last_seen_at: new Date().toISOString(),
        } as never,
        { onConflict: 'slug' }
      )
      .select('slug, created_at, updated_at')
      .single();

    if (up.error) throw new Error(`Product upsert '${p.slug}' failed: ${up.error.message}`);

    const r = up.data as { slug: string; created_at: string; updated_at: string };
    // created_at ≈ updated_at → fresh insert. Otherwise the row pre-existed.
    if (new Date(r.created_at).getTime() === new Date(r.updated_at).getTime()) {
      upserted.push(r.slug);
      console.log(`  ✓ inserted   ${r.slug}`);
    } else {
      alreadyExisted.push(r.slug);
      console.log(`  · refreshed  ${r.slug}`);
    }
  }

  // -- 2. RESOLVE 6 PRODUCT IDS IN CURATION ORDER --------------------------
  logSection('STEP 2 — resolve 6 curated SF product IDs');
  const productsRes = await sb.from('products').select('id, slug').in('slug', [...CURATION_SLUGS]);
  if (productsRes.error) throw new Error(`Product lookup failed: ${productsRes.error.message}`);

  const idBySlug = new Map<string, string>();
  for (const row of productsRes.data ?? []) {
    const r = row as { id: string; slug: string };
    idBySlug.set(r.slug, r.id);
  }

  const orderedProductIds: string[] = [];
  const missing: string[] = [];
  for (const slug of CURATION_SLUGS) {
    const id = idBySlug.get(slug);
    if (!id) missing.push(slug);
    else orderedProductIds.push(id);
  }
  if (missing.length > 0) {
    throw new Error(
      `Could not resolve ${missing.length} curated product(s) by slug: ${missing.join(
        ', '
      )}. Confirm they exist in the catalog.`
    );
  }
  console.log(`  ✓ resolved ${orderedProductIds.length}/6 product IDs in curated order`);

  // -- 3. UPSERT EDITORIAL COLLECTION --------------------------------------
  logSection('STEP 3 — upsert editorial collection');

  // Pre-flight read: was the collection already published?
  let alreadyPublished = false;
  const preRes = await sb
    .from('editorial_collections')
    .select('published, published_at')
    .eq('slug', COLLECTION.slug)
    .maybeSingle();
  if (!preRes.error && preRes.data) {
    const pre = preRes.data as { published: boolean | null; published_at: string | null };
    alreadyPublished = !!pre.published && !!pre.published_at;
  }
  console.log(`  · collection ${alreadyPublished ? 'already published' : 'is new'}`);

  if (DRY_RUN) {
    console.log('  · would upsert editorial_collections row with product_ids:', orderedProductIds);
    const report: Report = {
      ok: true,
      dryRun: true,
      productsUpserted: upserted,
      productsAlreadyExisted: alreadyExisted,
      collectionSlug: COLLECTION.slug,
      collectionId: null,
      collectionProductIds: orderedProductIds,
      collectionAlreadyPublished: alreadyPublished,
    };
    console.log('\n✅ DRY RUN OK\n', JSON.stringify(report, null, 2));
    return;
  }

  const collRes = await sb
    .from('editorial_collections')
    .upsert(
      {
        slug: COLLECTION.slug,
        title: COLLECTION.title,
        subtitle: COLLECTION.subtitle,
        description: COLLECTION.description,
        cover_image_url: COLLECTION.cover_image_url,
        niche: COLLECTION.niche,
        product_ids: orderedProductIds,
        published: true,
        // Preserve the original publish date so re-running the script doesn't
        // push the row to the top of "recents" by accident.
        published_at: alreadyPublished
          ? (preRes.data as { published_at: string | null } | null)?.published_at ?? new Date().toISOString()
          : new Date().toISOString(),
      } as never,
      { onConflict: 'slug' }
    )
    .select('id, published_at')
    .single();

  if (collRes.error) throw new Error(`Collection upsert failed: ${collRes.error.message}`);

  const r = collRes.data as { id: string; published_at: string | null };
  console.log(`  ✓ collection id=${r.id} published_at=${r.published_at ?? '(null)'}`);

  const report: Report = {
    ok: true,
    dryRun: false,
    productsUpserted: upserted,
    productsAlreadyExisted: alreadyExisted,
    collectionSlug: COLLECTION.slug,
    collectionId: r.id,
    collectionProductIds: orderedProductIds,
    collectionAlreadyPublished: alreadyPublished,
  };
  console.log('\n✅ DONE\n', JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error('\n❌ FAILED:', err?.message ?? err);
  if (err?.stack) console.error(err.stack);
  process.exit(1);
});
