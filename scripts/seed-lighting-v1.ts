/**
 * scripts/seed-lighting-v1.ts
 * ============================================================================
 * Idempotent CLI that seeds the 4th vertical ('iluminacion') from the
 * masterled.es PrestaShop feed (mlexportproducts module).
 *
 * Source: `/tmp/masterled.csv` (cached from $MASTERLED_FEED_URL on previous
 * ingest setup). The script does NOT redownload — keeps us off the
 * merchant's WAF and avoids accidentally re-pasting the token in command
 * history.
 *
 * PREREQUISITE
 *   1. Apply supabase/00000000000000_init.sql +
 *      supabase/00000000000001_click_attribution.sql +
 *      supabase/00000000000002_add_iluminacion_niche.sql (4th niche).
 *   2. The CSV must already exist at /tmp/masterled.csv (download once via:
 *        curl -sS "$MASTERLED_FEED_URL" -o /tmp/masterled.csv
 *      with $MASTERLED_FEED_URL in shell from .env.local).
 *   3. .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 *
 * SCHEMA MAPPING (PrestaShop → shopifind)
 *   id_product + id_product_attribute → masterled-${slugify(nombre)}-${id_pa} slugs
 *     (one row per variant — preserves PrestaShop SKU granularity).
 *   nombre                          → title (truncated to first 100 chars)
 *   nombre variante                 → appended to title as ' — <variant>'
 *   descripción (HTML)              → description (HTML stripped, capped 600 ch)
 *   precio                          → price_cents (multiplied ×100, EUR assumed)
 *   stock                           → in_stock = (stock > 0)
 *   Imagen 1                        → image_url (only column 1; first asset only)
 *   id_product + id_product_attribute → source_url =
 *     https://masterled.es/es/index.php?controller=product&id_product=...&id_product_attribute=...
 *     (we do NOT have link_rewrite in the CSV; this ugly form works)
 *
 * ECO-TAGS DERIVATION
 *   Universal    : 'led', 'low-energy', 'eu-made'
 *   Recyclable   : Material contains 'Aluminio' OR 'PVC'
 *   Long-life    : Horas de vida ≥ 25,000
 *   Certified    : Certificaciones contains BOTH 'CE' AND 'RoHS'
 *
 * RUN
 *   pnpm scripts:seed:lighting                 # dry-run (default; safe)
 *   pnpm scripts:seed:lighting -- --write      # apply (D2-approved only)
 *   pnpm scripts:seed:lighting -- --write --limit=20
 *                                                 # sandbox: 20 rows for staging
 *
 * D2 INVARIANT: this script NEVER writes to the DB unless --write is
 * passed explicitly. The user approves the dry-run PLAN before --write.
 * ============================================================================
 */

import { existsSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import {
  buildMasterledProduct,
  curateMasterledFeed,
  MASTERLED_MAX_CURATED_PRODUCTS,
  parseMasterledFeed,
} from '../src/lib/feeds/masterled';

// ---------------------------------------------------------------------------
// Runtime config
// ---------------------------------------------------------------------------

const WRITE = process.argv.includes('--write');
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ADMIN_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_KEY = ADMIN_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    '❌ Missing Supabase URL/key. Load .env.local or export the required variables.',
  );
  process.exit(1);
}
if (WRITE && !ADMIN_KEY) {
  console.error('❌ --write requires SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const LIMIT = (() => {
  const arg = process.argv.find((a) => a.startsWith('--limit='));
  return arg ? parseInt(arg.split('=')[1]!, 10) : null;
})();

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StoreSeed = {
  slug: 'masterled-es';
  name: 'Masterled';
  url: 'https://masterled.es';
  niche: 'iluminacion';
  short_description: string;
  long_description: string;
  eco_score: 78;
  values: string[];
  country: 'ES';
  affiliate_program: 'skimlinks';
  active: true;
  verified: true;
  featured: true;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function logSection(label: string) {
  console.log(`\n── ${label} ${'─'.repeat(Math.max(0, 60 - label.length))}`);
}

// ---------------------------------------------------------------------------
// Store fixture (single canonical row for masterled-es)
// ---------------------------------------------------------------------------

const STORE_FIXTURE: StoreSeed = {
  slug: 'masterled-es',
  name: 'Masterled',
  url: 'https://masterled.es',
  niche: 'iluminacion',
  short_description:
    'Fabricante y distribuidor español de iluminación LED técnica: bombillas, tiras, downlights, paneles y drivers.',
  long_description:
    'MasterLed.es: fabricante español con foco en iluminación LED de vida útil larga (≥30.000h), materiales reciclables (aluminio + PVC), certificaciones CE/RoHS y stock disponible en península ibérica. Curada por Shopifind como socio inaugural del vertical Iluminación.',
  eco_score: 78,
  values: ['eu-made', 'long-lifespan', 'recyclable', 'certified', 'low-energy'],
  country: 'ES',
  affiliate_program: 'skimlinks',
  active: true,
  verified: true,
  featured: true,
};

// ---------------------------------------------------------------------------
// Ensure prerequisite niche exists (idempotent — self-heals when migration
// 00000000000002_add_iluminacion_niche.sql has not been applied yet).
// Required because stores.niche has a FK to niches.id, so we cannot upsert
// the store before the niche row exists.
// ---------------------------------------------------------------------------

async function ensureNiches() {
  const NICHES: ReadonlyArray<{
    id: 'iluminacion';
    label: string;
    description: string;
    emoji: '💡';
    display_order: 4;
  }> = [
    {
      id: 'iluminacion',
      label: 'Iluminación',
      description:
        'Marcas independientes de iluminación LED técnica: bombillas, tiras, downlights, paneles, drivers. Geolocalizada España + UE con foco en vida útil larga, reciclabilidad y certificaciones CE/RoHS.',
      emoji: '💡',
      display_order: 4,
    },
  ];
  const { error, count } = await sb.from('niches').upsert(NICHES as never, {
    onConflict: 'id',
    count: 'exact',
    ignoreDuplicates: false,
  });
  if (error) throw new Error(`Niches ensure failed: ${error.message}`);
  console.log(`  ✓ ensured ${NICHES.length} niche(s) (idempotent ON CONFLICT)`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const mode = WRITE ? 'WRITE' : 'DRY RUN';
  console.log(
    `▶ masterled-ingest v1 — mode=${mode}${LIMIT ? ` limit=${LIMIT}` : ''}`,
  );

  // -- 1) LOAD CSV -------------------------------------------------------
  logSection('STEP 1 — load /tmp/masterled.csv');
  if (!existsSync('/tmp/masterled.csv')) {
    console.error('❌ /tmp/masterled.csv not found. Download first:');
    console.error(
      '   curl -sS "$(grep MASTERLED_FEED_URL .env.local | cut -d= -f2-)" -o /tmp/masterled.csv',
    );
    process.exit(1);
  }
  const parsed = parseMasterledFeed(readFileSync('/tmp/masterled.csv', 'utf8'));
  const { headers, rows: allRows, validRows: valid } = parsed;
  console.log(`  · headers: ${headers.length}`);
  console.log(`  · total rows: ${allRows.length}`);
  if (headers.length < 30) {
    console.warn(
      `  ⚠️  only ${headers.length} headers — expected ~62. Check the CSV separator.`,
    );
  }

  // -- 2) FILTER + VALID ------------------------------------------------
  logSection('STEP 2 — filter & validate rows');
  const skipped = allRows.length - valid.length;
  console.log(
    `  · valid rows (has nombre+precio+Imagen1+id_pa): ${valid.length}`,
  );
  if (skipped > 0)
    console.log(`  · skipped (missing required fields): ${skipped}`);

  const curation = curateMasterledFeed(valid);
  if (!LIMIT && curation.rows.length !== MASTERLED_MAX_CURATED_PRODUCTS) {
    throw new Error(
      `Curated selection incomplete: ${curation.rows.length}/${MASTERLED_MAX_CURATED_PRODUCTS}.`,
    );
  }
  console.log(`  · protected rows: ${curation.protectedRows.length}`);
  console.log(
    `  · curated rows: ${curation.rows.length}/${MASTERLED_MAX_CURATED_PRODUCTS}`,
  );
  if (curation.missingPreferredIds.length > 0) {
    console.log(
      `  · missing preferred IDs: ${curation.missingPreferredIds.join(', ')}`,
    );
  }
  if (curation.unavailablePreferredIds.length > 0) {
    console.log(
      `  · unavailable preferred IDs: ${curation.unavailablePreferredIds.join(', ')}`,
    );
  }

  const observedAt = new Date().toISOString();
  const stockTrue = curation.rows.filter(
    (row) =>
      buildMasterledProduct(row, '<dryrun-store-id>', observedAt).in_stock,
  ).length;
  const stockFalse = curation.rows.length - stockTrue;
  console.log(`  · stock>0 (will appear in catalog home): ${stockTrue}`);
  console.log(`  · stock=0 (will be set inactive): ${stockFalse}`);

  const capped = LIMIT
    ? Math.min(LIMIT, curation.rows.length)
    : curation.rows.length;
  const toUpsert = curation.rows.slice(0, capped);
  console.log(`  · toUpload this run: ${toUpsert.length}`);

  // -- 3) PRINT PLAN -----------------------------------------------------
  logSection('STEP 3 — PLAN');
  console.log(`  1 store:  masterled-es (eco_score=78, ES, featured=true)`);
  console.log(
    `  ${toUpsert.length} products: masterled-{normalized-name}-{id_pa} pattern`,
  );

  console.log(`\n  Exact curated products:`);
  for (const [index, r] of toUpsert.entries()) {
    const p = buildMasterledProduct(r, '<dryrun-store-id>', observedAt);
    console.log(
      `    ${String(index + 1).padStart(2, '0')}. ${p.slug}  €${(p.price_cents / 100).toFixed(2)}  ${p.in_stock ? 'IN' : 'OUT'}`,
    );
  }

  // -- 4) EXIT DRY-RUN --------------------------------------------------
  if (!WRITE) {
    console.log('\n⚠️  DRY RUN — no DB writes. Re-run with --write to apply.');
    return;
  }

  // -- 5) ENSURE NICHES (idempotent self-heal against unapplied migration)
  logSection('STEP 5 — ensure nicho iluminacion (idempotent)');
  await ensureNiches();

  // -- 6) UPSERT STORE --------------------------------------------------
  logSection('STEP 6 — UPSERT store masterled-es');
  const storeRes = await sb
    .from('stores')
    .upsert(STORE_FIXTURE as never, { onConflict: 'slug' })
    .select('id, slug, created_at, updated_at')
    .single();
  if (storeRes.error)
    throw new Error(`Store upsert failed: ${storeRes.error.message}`);
  const storeId = (storeRes.data as { id: string }).id;
  console.log(`  ✓ store id=${storeId}`);

  // -- 6) UPSERT PRODUCTS IN BATCHES -----------------------------------
  logSection('STEP 6 — UPSERT products (batches of 150)');
  let insertedCount = 0;
  let refreshedCount = 0;
  let failedCount = 0;
  let hiddenCount = 0;
  const BATCH = 150;
  for (let i = 0; i < toUpsert.length; i += BATCH) {
    const chunk = toUpsert
      .slice(i, i + BATCH)
      .map((row) => buildMasterledProduct(row, storeId, observedAt));
    const { data, error } = await sb
      .from('products')
      .upsert(chunk as never, { onConflict: 'slug' })
      .select('slug, created_at, updated_at');
    if (error) {
      console.error(`  ✗ batch ${i / BATCH + 1}: ${error.message}`);
      failedCount += chunk.length;
      continue;
    }
    const rows = data ?? [];
    const insertedRows = rows.filter(
      (r: { created_at: string; updated_at: string }) =>
        Math.abs(
          new Date(r.updated_at).getTime() - new Date(r.created_at).getTime(),
        ) < 1500,
    );
    insertedCount += insertedRows.length;
    refreshedCount += rows.length - insertedRows.length;
    console.log(
      `  ✓ batch ${Math.floor(i / BATCH) + 1}: ${rows.length}/${chunk.length} upserted (${insertedRows.length} new, ${rows.length - insertedRows.length} refreshed)`,
    );
  }

  // A limited staging write must never hide the rest of the live catalog.
  // A complete production write deactivates old/unselected rows reversibly.
  if (failedCount === 0 && !LIMIT) {
    const staleCountResult = await sb
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .eq('in_stock', true)
      .lt('last_seen_at', observedAt);
    if (staleCountResult.error) {
      throw new Error(`Stale read failed: ${staleCountResult.error.message}`);
    }
    const staleUpdate = await sb
      .from('products')
      .update({ in_stock: false } as never)
      .eq('store_id', storeId)
      .eq('in_stock', true)
      .lt('last_seen_at', observedAt);
    if (staleUpdate.error) {
      throw new Error(`Stale update failed: ${staleUpdate.error.message}`);
    }
    hiddenCount = staleCountResult.count ?? 0;
  }

  // -- 7) REPORT -------------------------------------------------------
  logSection('STEP 7 — final report');
  const report = {
    ok: failedCount === 0,
    mode: WRITE ? 'WRITE' : 'DRY_RUN',
    storeUpserted: storeId,
    productsUpserted: insertedCount,
    productsRefreshed: refreshedCount,
    productsFailed: failedCount,
    productsHiddenReversibly: hiddenCount,
  };
  console.log(
    report.ok ? '\n✅ DONE' : '\n⚠️  PARTIAL',
    '\n',
    JSON.stringify(report, null, 2),
  );

  console.log(`
Operator next steps:
  • Live verify:  curl https://shopifind.app/explore/iluminacion → expect 200 + ~${stockTrue} products.
  • Skimlinks:    /go/<slug> click-out now wraps the masterled.es PDP via SKIMLINKS_DOMAIN_ID.
  • Categories:   categories table is EMPTY (intentional — TODO post-MVP).
  • Categories auto-parse: Categories column was multi-value comma-separated; we left
    it null in MVP. (Re-introduce later by splitting on ',' + creating the categories table rows.)
`);
}

main().catch((err) => {
  console.error('\n❌ FAILED:', err?.message ?? err);
  if (err?.stack) console.error(err.stack);
  process.exit(1);
});
