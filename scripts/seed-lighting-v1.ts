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

const WRITE = process.argv.includes('--write');
const LIMIT = (() => {
  const arg = process.argv.find((a) => a.startsWith('--limit='));
  return arg ? parseInt(arg.split('=')[1]!, 10) : null;
})();

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CsvRow = Record<string, string>;

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

type ProductSeed = {
  store_id: string;
  slug: string;
  title: string;
  description: string;
  price_cents: number;
  currency: 'EUR';
  image_url: string;
  source_url: string;
  eco_tags: string[];
  attributes: Record<string, string>;
  in_stock: boolean;
  last_seen_at: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function logSection(label: string) {
  console.log(`\n── ${label} ${'─'.repeat(Math.max(0, 60 - label.length))}`);
}

/** Slugify a display name into a URL-safe token. Strips diacritics, max ~60 chars. */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Strip HTML tags + decode a few common entities. Cap to max chars. */
function stripHtml(html: string, max = 600): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** Parse PrestaShop "precio" — accepts "5.49" and "5,49" (defensive). */
function parsePrecio(s: string | undefined): number {
  if (!s) return 0;
  const cleaned = s.replace(',', '.').replace(/[^0-9.]/g, '');
  if (!cleaned) return 0;
  const n = parseFloat(cleaned);
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}

/** Parse numeric "stock" with whitespace junk. */
function parseStock(s: string | undefined): number {
  if (!s) return 0;
  const n = parseInt(s.replace(/[^\d-]/g, ''), 10);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Parse the masterled CSV (`;` separator, UTF-8, possibly BOM).
 * Quote-aware: a `;` inside `"..."` is treated as literal data.
 * Line-aware: a `"` immediately followed by a newline keeps the row open.
 */
function parseCsv(path: string): { headers: string[]; rows: CsvRow[] } {
  // Strip optional BOM (byte-order-mark) so the first header is `id_product`,
  // not `\uFEFFid_product`.
  const raw = readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
  const records: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (raw[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ';') {
        cur.push(field);
        field = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && raw[i + 1] === '\n') i++;
        cur.push(field);
        field = '';
        records.push(cur);
        cur = [];
      } else {
        field += c;
      }
    }
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    records.push(cur);
  }
  // Drop trailing empty record (common when CSV ends with \n)
  if (records.length > 0 && records[records.length - 1]!.every((c) => c.trim() === '')) {
    records.pop();
  }
  const headers = (records[0] ?? []).map((h) => h.trim());
  const rows: CsvRow[] = [];
  for (let r = 1; r < records.length; r++) {
    const cells = records[r] ?? [];
    if (cells.length < headers.length) {
      // Pad short rows with empty cells so Object.fromEntries doesn't drop keys.
      while (cells.length < headers.length) cells.push('');
    }
    const obj: CsvRow = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]!] = (cells[j] ?? '').trim();
    }
    rows.push(obj);
  }
  return { headers, rows };
}

/** Filter rows that have the minimum data needed to be a valid product row. */
function isValidRow(r: CsvRow): boolean {
  if (!r['nombre']) return false;
  if (!r['precio']) return false;
  if (!r['Imagen 1']) return false;
  if (!r['id_product_attribute']) return false;
  return true;
}

/** Derive eco_tags from row + universal base tags. */
function deriveEcoTags(r: CsvRow): string[] {
  const tags = new Set<string>(['led', 'low-energy', 'eu-made']);
  if (/aluminio|pvc/i.test(r['Material'] ?? '')) tags.add('recyclable');
  const horas = parseInt((r['Horas de vida'] ?? '0').replace(/[^\d]/g, ''), 10) || 0;
  if (horas >= 25_000) tags.add('long-lifespan');
  const certs = (r['Certificaciones'] ?? '').toLowerCase();
  if (certs.includes('ce') && certs.includes('rohs')) tags.add('certified');
  return [...tags].sort();
}

/** Build the attributes JSONB object from product-spec columns. */
function deriveAttributes(r: CsvRow): Record<string, string> {
  const out: Record<string, string> = {};
  const fields = [
    ['potencia', r['Potencia']],
    ['lumens', r['Lumens']],
    ['temperatura_color', r['Temperatura de color']],
    ['angulo_apertura', r['Ángulo de apertura']],
    ['material', r['Material']],
    ['certificaciones', r['Certificaciones']],
    ['garantia', r['Garantía']],
    ['grado_proteccion', r['Grado de protección']],
    ['casquillo', r['Tipo Casquillo']],
    ['horas_vida', r['Horas de vida']],
  ] as const;
  for (const [key, val] of fields) {
    if (val && val.trim()) out[key] = val.trim();
  }
  return out;
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
  values: [
    'eu-made',
    'long-lifespan',
    'recyclable',
    'certified',
    'low-energy',
  ],
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
  const { error, count } = await sb
    .from('niches')
    .upsert(NICHES as never, { onConflict: 'id', count: 'exact', ignoreDuplicates: false });
  if (error) throw new Error(`Niches ensure failed: ${error.message}`);
  console.log(`  ✓ ensured ${NICHES.length} niche(s) (idempotent ON CONFLICT)`);
}

// ---------------------------------------------------------------------------
// Row → ProductSeed mapper
// ---------------------------------------------------------------------------

function buildProduct(r: CsvRow, storeId: string): ProductSeed {
  const id_p = parseInt(r['id_product']!, 10);
  const id_pa = parseInt(r['id_product_attribute']!, 10);
  const variant = r['nombre variante']?.trim();
  const title = variant ? `${r['nombre']} — ${variant}` : r['nombre']!;
  return {
    store_id: storeId,
    slug: `masterled-${slugify(r['nombre']!)}-${id_pa}`,
    title: title.length > 100 ? title.slice(0, 97) + '…' : title,
    description: stripHtml(r['descripción'] ?? ''),
    price_cents: parsePrecio(r['precio']),
    currency: 'EUR',
    image_url: r['Imagen 1']!,
    source_url: `https://masterled.es/es/index.php?controller=product&id_product=${id_p}&id_product_attribute=${id_pa}`,
    eco_tags: deriveEcoTags(r),
    attributes: deriveAttributes(r),
    in_stock: parseStock(r['stock']) > 0,
    last_seen_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const mode = WRITE ? 'WRITE' : 'DRY RUN';
  console.log(
    `▶ masterled-ingest v1 — mode=${mode}${LIMIT ? ` limit=${LIMIT}` : ''}`
  );

  // -- 1) LOAD CSV -------------------------------------------------------
  logSection('STEP 1 — load /tmp/masterled.csv');
  if (!existsSync('/tmp/masterled.csv')) {
    console.error('❌ /tmp/masterled.csv not found. Download first:');
    console.error('   curl -sS "$(grep MASTERLED_FEED_URL .env.local | cut -d= -f2-)" -o /tmp/masterled.csv');
    process.exit(1);
  }
  const { headers, rows: allRows } = parseCsv('/tmp/masterled.csv');
  console.log(`  · headers: ${headers.length}`);
  console.log(`  · total rows: ${allRows.length}`);
  if (headers.length < 30) {
    console.warn(`  ⚠️  only ${headers.length} headers — expected ~62. Check the CSV separator.`);
  }

  // -- 2) FILTER + VALID ------------------------------------------------
  logSection('STEP 2 — filter & validate rows');
  const valid = allRows.filter(isValidRow);
  const skipped = allRows.length - valid.length;
  console.log(`  · valid rows (has nombre+precio+Imagen1+id_pa): ${valid.length}`);
  if (skipped > 0) console.log(`  · skipped (missing required fields): ${skipped}`);

  const stockTrue = valid.filter((r) => parseStock(r['stock']) > 0).length;
  const stockFalse = valid.length - stockTrue;
  console.log(`  · stock>0 (will appear in catalog home): ${stockTrue}`);
  console.log(`  · stock=0 (will be set inactive): ${stockFalse}`);

  const capped = LIMIT ? Math.min(LIMIT, valid.length) : valid.length;
  const toUpsert = valid.slice(0, capped);
  console.log(`  · toUpload this run: ${toUpsert.length}`);

  // -- 3) PRINT PLAN -----------------------------------------------------
  logSection('STEP 3 — PLAN');
  console.log(`  1 store:  masterled-es (eco_score=78, ES, featured=true)`);
  console.log(`  ${toUpsert.length} products:  masterled-${slugify('X')}-{id_pa} pattern`);

  // Quick sample of 3 to verify mapping correctness.
  console.log(`\n  Sample 3 mapped products:`);
  for (const r of toUpsert.slice(0, 3)) {
    const id_pa = parseInt(r['id_product_attribute']!, 10);
    const p = buildProduct(r, '<dryrun-store-id>');
    console.log(`    ${p.slug}  €${(p.price_cents / 100).toFixed(2)}  ${p.in_stock ? 'IN' : 'OUT'}  [img: ${p.image_url.slice(0, 60)}...]  [eco: ${p.eco_tags.join(',')}]`);
    console.log(`      title: ${p.title}`);
    console.log(`      source_url: ${p.source_url}`);
    if (id_pa === parseInt(r['id_product_attribute']!, 10)) void 0;
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
  if (storeRes.error) throw new Error(`Store upsert failed: ${storeRes.error.message}`);
  const storeId = (storeRes.data as { id: string }).id;
  console.log(`  ✓ store id=${storeId}`);

  // -- 6) UPSERT PRODUCTS IN BATCHES -----------------------------------
  logSection('STEP 6 — UPSERT products (batches of 150)');
  let insertedCount = 0;
  let refreshedCount = 0;
  let failedCount = 0;
  const BATCH = 150;
  for (let i = 0; i < toUpsert.length; i += BATCH) {
    const chunk = toUpsert.slice(i, i + BATCH).map((r) => buildProduct(r, storeId));
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
        Math.abs(new Date(r.updated_at).getTime() - new Date(r.created_at).getTime()) < 1500
    );
    insertedCount += insertedRows.length;
    refreshedCount += rows.length - insertedRows.length;
    console.log(
      `  ✓ batch ${Math.floor(i / BATCH) + 1}: ${rows.length}/${chunk.length} upserted (${insertedRows.length} new, ${rows.length - insertedRows.length} refreshed)`
    );
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
  };
  console.log(report.ok ? '\n✅ DONE' : '\n⚠️  PARTIAL', '\n', JSON.stringify(report, null, 2));

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
