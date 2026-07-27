/**
 * scripts/hide-placeholder-rows.ts
 * ============================================================================
 * Honest-baseline pivot: flip `*.example.com` placeholder rows off so the live
 * site stops returning 404 during seed-only development.
 *
 * Why we need this:
 *   - supabase/seed.sql + scripts/seed-editorial-collection.ts ship 5 stores
 *     and 7 products whose `url` / `source_url` are `.example.com` placeholders
 *     (placeholder PDPs that 404 in production).
 *   - The public site filters on `stores.active = TRUE` and
 *     `products.in_stock = TRUE` (RLS + the `v_products_with_store` view).
 *     Toggling these columns is the cleanest way to silence the placeholders
 *     WITHOUT deleting the slug/ID — the URL fixer
 *     (scripts/fix-source-urls.ts) will eventually re-activate them by slug
 *     once a real PDP is resolved, OR you can `--revert` to roll back.
 *
 * What gets hidden (cascade):
 *   1. Every store whose `url` contains `.example.com` → `active = FALSE`.
 *   2. Every product whose `source_url` contains `.example.com` →
 *      `in_stock = FALSE` (even if its store is real — it's still a broken
 *      click).
 *   3. Every product whose `store_id` belongs to a placeholder store
 *      (cascade hide — keeps the public catalog consistent: no orphan
 *      active products of a hidden merchant).
 *
 * USAGE (from project root, .env.local must contain service-role key):
 *   pnpm scripts:hide:placeholder                 # dry-run, safe
 *   pnpm scripts:hide:placeholder -- --write      # apply the toggle
 *   pnpm scripts:hide:placeholder -- --revert     # restore active/in_stock=TRUE
 *   pnpm scripts:hide:placeholder -- --include=sf # sf only (placeholder stores)
 *
 * IDEMPOTENT: re-running with --write on already-hidden rows is a no-op.
 *
 * SAFETY:
 *   - Default mode is dry-run. The script NEVER writes unless --write OR
 *     --revert is passed explicitly. Pass both = revert wins (last-arg-eval).
 *   - The script does NOT touch non-placeholder rows even in cascade mode.
 *   - The script logs every `slug`/`id` to be touched before mutation so
 *     you can audit by stdout.
 * ============================================================================
 */

import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Runtime config
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    '❌ Missing required env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local or your shell.'
  );
  process.exit(1);
}

const ARGS = process.argv.slice(2);
const WRITE = ARGS.includes('--write');
const REVERT = ARGS.includes('--revert');
const INCLUDE_FLAG = ARGS.find((a) => a.startsWith('--include='));
const INCLUDE_NICHES = INCLUDE_FLAG
  ? INCLUDE_FLAG.replace('--include=', '').split(',').map((s) => s.trim()).filter(Boolean)
  : null; // null = all niches

if (WRITE && REVERT) {
  console.error('❌ Conflicting flags: --write and --revert cannot be combined.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Supabase client (service-role; bypasses RLS for the toggle)
// ---------------------------------------------------------------------------

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

// ---------------------------------------------------------------------------
// Types (just what we read; toggle writes are untyped to keep schema drift safe)
// ---------------------------------------------------------------------------

type StoreRow = { id: string; slug: string; niche: string; url: string; active: boolean };
type ProductRow = {
  id: string;
  slug: string;
  store_id: string;
  source_url: string;
  in_stock: boolean;
  niche?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function logSection(label: string) {
  console.log(`\n── ${label} ${'─'.repeat(Math.max(0, 60 - label.length))}`);
}

function isPlaceholderUrl(u: string | null | undefined): boolean {
  if (!u) return false;
  return u.includes('.example.com');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const mode = REVERT ? 'REVERT (restore active/in_stock=TRUE)' : WRITE ? 'APPLY' : 'DRY RUN';
  console.log(
    `▶ hide-placeholder-rows — mode=${mode}${INCLUDE_NICHES ? ` niches=${INCLUDE_NICHES.join('|')}` : ''}`
  );

  // -- 1. READ ALL STORES ---------------------------------------------------
  logSection('STEP 1 — fetch all stores');
  const { data: storesAll, error: eAll } = await sb
    .from('stores')
    .select('id, slug, niche, url, active')
    .limit(500);
  if (eAll) throw new Error(`Store fetch failed: ${eAll.message}`);
  const stores = (storesAll ?? []) as StoreRow[];
  console.log(`  · fetched ${stores.length} stores`);

  // -- 2. IDENTIFY PLACEHOLDER STORES --------------------------------------
  const placeholderStores = stores.filter(
    (s) =>
      isPlaceholderUrl(s.url) && (!INCLUDE_NICHES || INCLUDE_NICHES.includes(s.niche))
  );
  console.log(`  · ${placeholderStores.length} placeholder stores target:`);
  for (const s of placeholderStores) {
    console.log(`      - ${s.slug} (niche=${s.niche}, current.active=${s.active}) url=${s.url}`);
  }
  const placeholderStoreIds = new Set(placeholderStores.map((s) => s.id));

  // -- 3. READ ALL PRODUCTS ------------------------------------------------
  logSection('STEP 2 — fetch all products');
  const { data: productsAll, error: ePAll } = await sb
    .from('products')
    .select('id, slug, store_id, source_url, in_stock')
    .limit(2000);
  if (ePAll) throw new Error(`Product fetch failed: ${ePAll.message}`);
  const products = (productsAll ?? []) as ProductRow[];
  console.log(`  · fetched ${products.length} products`);

  // -- 4. IDENTIFY PLACEHOLDER PRODUCTS -----------------------------------
  // Hide if EITHER:
  //   (a) source_url contains *.example.com, OR
  //   (b) the product's store was identified as a placeholder store (cascade).
  const targetProducts = products.filter((p) => {
    if (isPlaceholderUrl(p.source_url)) return true;
    if (placeholderStoreIds.has(p.store_id)) return true;
    return false;
  });
  console.log(`  · ${targetProducts.length} placeholder products target:`);
  for (const p of targetProducts) {
    const reason = isPlaceholderUrl(p.source_url) ? 'url' : 'parent-store';
    console.log(
      `      - ${p.slug} (in_stock=${p.in_stock}, reason=${reason}) src=${p.source_url}`
    );
  }

  // -- 5. PRINT PLAN -------------------------------------------------------
  logSection('PLAN');
  console.log(
    `  ${REVERT ? 'REVERT' : WRITE ? 'APPLY' : '(dry-run only)'} → ` +
      `stores.active=${REVERT ? 'TRUE' : 'FALSE'} (${placeholderStores.length}) | ` +
      `products.in_stock=${REVERT ? 'TRUE' : 'FALSE'} (${targetProducts.length})`
  );

  if (!WRITE && !REVERT) {
    console.log('\n⚠️  DRY RUN — no DB writes performed. Re-run with --write to apply.');
    return;
  }

  // -- 6. APPLY ------------------------------------------------------------
  logSection(REVERT ? 'STEP 3a — REVERT (restore to ACTIVE)' : 'STEP 3a — APPLY (mark INACTIVE)');

  const newActive = REVERT;
  const newInStock = REVERT;

  if (placeholderStores.length > 0) {
    const storeIds = placeholderStores.map((s) => s.id);
    const { error } = await sb.from('stores').update({ active: newActive } as never).in('id', storeIds);
    if (error) throw new Error(`Stores update failed: ${error.message}`);
    console.log(`  ✓ stores: ${storeIds.length}/${storeIds.length} updated → active=${newActive}`);
  } else {
    console.log('  · no placeholder stores to update');
  }

  if (targetProducts.length > 0) {
    const productIds = targetProducts.map((p) => p.id);
    // Supabase caps URL-encoded `.in()` arrays around ~200; batch to be safe.
    const BATCH = 150;
    let touched = 0;
    for (let i = 0; i < productIds.length; i += BATCH) {
      const chunk = productIds.slice(i, i + BATCH);
      const { error } = await sb
        .from('products')
        .update({ in_stock: newInStock } as never)
        .in('id', chunk);
      if (error) throw new Error(`Products update failed: ${error.message}`);
      touched += chunk.length;
      console.log(
        `  ✓ products batch ${i / BATCH + 1}: ${chunk.length}/${chunk.length} → in_stock=${newInStock}`
      );
    }
    console.log(`  ✓ products total: ${touched}/${productIds.length} updated → in_stock=${newInStock}`);
  } else {
    console.log('  · no placeholder products to update');
  }

  console.log('\n✅ DONE. The catalog will no longer surface rows pointing at *.example.com.');
}

main().catch((err) => {
  console.error('\n❌ FAILED:', err?.message ?? err);
  if (err?.stack) console.error(err.stack);
  process.exit(1);
});
