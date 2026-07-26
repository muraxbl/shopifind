/**
 * scripts/fix-source-urls.ts
 * ============================================================================
 * Fix the 32 broken source_urls for sustainable-fashion merchants using the
 * "Path E" hybrid:
 *
 *   1. Sitemap-driven extraction (5 merchants). Recurses through
 *      <sitemapindex> entries with concurrent child-sitemap fetching.
 *   2. Title-fuzzy + handle-substring matching against a per-merchant anchor
 *      fixture (Levenshtein-free; substring + char-set intersection).
 *   3. Playwright-driven search for the 3 SFCC merchants (armedangels,
 *      reformation-us, stella-mccartney) is EMITTED as `pending-playwright.json`
 *      with structured search queries. The user can either:
 *        a) `pnpm add -D playwright-core && npx playwright install chromium`
 *           and extend this script with the Playwright search flow, OR
 *        b) Feed `pending-playwright.json` to browse.ai / firecrawl / apify
 *           ($0.10-$0.50 one-shot, no infrastructure).
 *
 * Usage:
 *   pnpm scripts:fix:urls                                # run all 8 merchants
 *   pnpm scripts:fix:urls -- --dry-run                   # no DB writes
 *   pnpm scripts:fix:urls -- --sitemap-only              # skip emit of pending-playwright.json
 *   pnpm scripts:fix:urls -- --include=ecoalf,rapanui     # subset
 *
 * Emits:
 *   - DB: UPDATE products SET source_url = '<matched>' WHERE slug IN (...)
 *   - File: ./pending-playwright.json (search queries per Playwright merchant)
 * ============================================================================
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

// ---------------------------------------------------------------------------
// Runtime config + admin client
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    '❌ Missing NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env (.env.local or shell).'
  );
  process.exit(1);
}
const DRY_RUN = process.argv.includes('--dry-run');
const SITEMAP_ONLY = process.argv.includes('--sitemap-only');

function parseInclude(): string[] | null {
  for (const arg of process.argv.slice(2)) {
    const m = /^--include=(.+)$/.exec(arg);
    if (m) return m[1]!.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return null;
}
const INCLUDED = parseInclude();

const sb = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

// ---------------------------------------------------------------------------
// Per-merchant strategy + URL
// ---------------------------------------------------------------------------

type Strategy = 'sitemap' | 'sitemap_index' | 'sitemap_redirect' | 'playwright_search';
type MerchantCfg = { strategy: Strategy; url: string; notes?: string };

const MERCHANT_CFG: Record<string, MerchantCfg> = {
  'ecoalf': {
    strategy: 'sitemap_index',
    url: 'https://ecoalf.com/sitemap.xml',
    notes: 'sitemap_index (~91 entries); recurse child sitemaps.',
  },
  'rapanui': {
    strategy: 'sitemap',
    url: 'https://rapanuiclothing.com/sitemap.xml',
    notes: 'flat sitemap ~2000 PDPs.',
  },
  'knowledge-cotton': {
    strategy: 'sitemap_index',
    url: 'https://knowledgecottonapparel.com/sitemap.xml',
    notes: 'small sitemap_index (6 children).',
  },
  'asket': {
    strategy: 'sitemap_redirect',
    url: 'https://asket.com/sitemap.xml',
    notes: 'eu/sitemap.xml returned 404; try root.',
  },
  'mud-jeans': {
    strategy: 'sitemap_index',
    url: 'https://mudjeans.eu/sitemap.xml',
    notes: 'sitemap_index (17 children).',
  },
  'armedangels': {
    strategy: 'playwright_search',
    url: 'https://www.armedangels.com',
    notes: 'CF rate-limit; needs headless browser search.',
  },
  'reformation-us': {
    strategy: 'playwright_search',
    url: 'https://www.thereformation.com',
    notes: 'SFCC, no sitemap; Algolia search via Playwright.',
  },
  'stella-mccartney': {
    strategy: 'playwright_search',
    url: 'https://www.stellamccartney.com',
    notes: 'SFCC luxury tier; Playwright en-gb locale search.',
  },
};

type Anchor = { product_slug: string; title: string; handle_hint: string };

const ANCHORS: Record<string, Anchor[]> = {
  'ecoalf': [
    { product_slug: 'ecoalf-marangu-jacket', title: 'Marangu Jacket', handle_hint: 'marangu-jacket' },
    { product_slug: 'ecoalf-uman-puffer',  title: 'Uman Puffer', handle_hint: 'uman-puffer' },
    { product_slug: 'ecoalf-actitud-sneakers', title: 'Actitud Sneakers', handle_hint: 'actitud-sneakers' },
    { product_slug: 'ecoalf-bora-sweatshirt', title: 'Bora Sweatshirt', handle_hint: 'bora-sweatshirt' },
  ],
  'rapanui': [
    { product_slug: 'rapanui-organic-tee', title: 'Organic Cotton Tee', handle_hint: 'organic-cotton-tee' },
    { product_slug: 'rapanui-fisherman-jumper', title: 'Fisherman Jumper', handle_hint: 'fisherman-jumper' },
    { product_slug: 'rapanui-surf-towel', title: 'Surf Towel', handle_hint: 'surf-towel' },
    { product_slug: 'rapanui-hooded-jacket', title: 'Hooded Jacket', handle_hint: 'hooded-jacket' },
  ],
  'knowledge-cotton': [
    { product_slug: 'kca-owl-tee', title: 'Owl Tee', handle_hint: 'owl-tee' },
    { product_slug: 'kca-chuck-chino', title: 'Chuck Chino', handle_hint: 'chuck-chino' },
    { product_slug: 'kca-larix-jacket', title: 'Larix Jacket', handle_hint: 'larix-jacket' },
    { product_slug: 'kca-maple-sweater', title: 'Maple Sweater', handle_hint: 'maple-sweater' },
  ],
  'asket': [
    { product_slug: 'asket-the-t-shirt-jade', title: 'The T-Shirt', handle_hint: 'the-t-shirt' },
    { product_slug: 'asket-raw-denim-jean', title: 'Raw Denim Jean', handle_hint: 'raw-denim-jean' },
    { product_slug: 'asket-oxford-shirt', title: 'Oxford Shirt', handle_hint: 'oxford-shirt' },
    { product_slug: 'asket-merino-sweater', title: 'Merino Sweater', handle_hint: 'merino-crewneck' },
  ],
  'mud-jeans': [
    { product_slug: 'mud-jeans-relax-rose', title: 'Relax Rose Jeans', handle_hint: 'relax-rose' },
    { product_slug: 'mud-jeans-regular-dunn', title: 'Regular Dunn Jeans', handle_hint: 'regular-dunn' },
    { product_slug: 'mud-jeans-flared-hazen', title: 'Flared Hazen Jeans', handle_hint: 'flared-hazen' },
    { product_slug: 'mud-jeans-wide-wanda', title: 'Wide Wanda Jeans', handle_hint: 'wide-wanda' },
  ],
  'armedangels': [
    { product_slug: 'armedangels-mairaa-jeans', title: 'Mairaa Mom Jeans', handle_hint: 'mairaa-mom-jeans' },
    { product_slug: 'armedangels-tarjaa-tee', title: 'Tarjaa Tee', handle_hint: 'tarjaa-tee' },
    { product_slug: 'armedangels-detlef-hoodie', title: 'Detlef Hoodie', handle_hint: 'detlef-hoodie' },
    { product_slug: 'armedangels-inaa-cardigan', title: 'Inaa Cardigan', handle_hint: 'inaa-cardigan' },
  ],
  'reformation-us': [
    { product_slug: 'reformation-juliette-dress', title: 'Juliette Dress', handle_hint: 'juliette' },
    { product_slug: 'reformation-mason-pant', title: 'Mason Pant', handle_hint: 'mason' },
    { product_slug: 'reformation-cynthia-jeans', title: 'Cynthia High Rise Jeans', handle_hint: 'cynthia' },
    { product_slug: 'reformation-bea-skirt', title: 'Bea Skirt', handle_hint: 'bea' },
  ],
  'stella-mccartney': [
    { product_slug: 'smc-falabella-tote-mini', title: 'Falabella Tote Mini', handle_hint: 'falabella-tote-mini' },
    { product_slug: 'smc-elyse-platform', title: 'Elyse Platform Shoes', handle_hint: 'elyse-platform' },
    { product_slug: 'smc-logo-shoulder-bag', title: 'Logo Shoulder Bag', handle_hint: 'logo-shoulder-bag' },
    { product_slug: 'smc-loop-sneakers', title: 'Loop Sneakers', handle_hint: 'loop-sneakers' },
  ],
};

// ---------------------------------------------------------------------------
// Sitemap fetcher (recursive, redirect-following, parallelized children)
// ---------------------------------------------------------------------------

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; ShopifindBot/1.0; sitemap fetcher; +https://shopifind.app)',
        Accept: 'application/xml,text/xml,*/*',
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

async function extractLocs(xml: string): Promise<string[]> {
  const out: string[] = [];
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    out.push(decodeHtmlEntities(m[1]!.trim()));
  }
  return out;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

type ExtractResult =
  | { kind: 'pdp'; urls: string[] }
  | { kind: 'index'; children: string[] }
  | { kind: 'error'; reason: string };

const MAX_DEPTH = 4;

async function extractSitemapUrls(startUrl: string, depth = 0): Promise<ExtractResult> {
  if (depth > MAX_DEPTH) return { kind: 'error', reason: 'max-depth-exceeded' };
  const xml = await fetchText(startUrl);
  if (!xml) return { kind: 'error', reason: 'fetch-failed' };
  if (/<sitemapindex/i.test(xml)) {
    return { kind: 'index', children: await extractLocs(xml) };
  }
  return { kind: 'pdp', urls: await extractLocs(xml) };
}

const MAX_PDP_PER_MERCHANT = 4000; // safety cap to avoid runaway memory
async function fetchAllPdpUrls(startUrl: string): Promise<string[]> {
  const result = await extractSitemapUrls(startUrl);
  if (result.kind === 'error') return [];
  if (result.kind === 'pdp') return result.urls.slice(0, MAX_PDP_PER_MERCHANT);

  // Index: BFS children with 8 concurrent workers.
  const allPdp: string[] = [];
  const queue = [...result.children];
  const CONC = 8;
  const inFlight: Promise<void>[] = [];

  const worker = async () => {
    while (queue.length > 0 && allPdp.length < MAX_PDP_PER_MERCHANT) {
      const child = queue.shift();
      if (!child) break;
      const sub = await extractSitemapUrls(child, MAX_DEPTH);
      if (sub.kind === 'pdp') allPdp.push(...sub.urls);
      else if (sub.kind === 'index') queue.push(...sub.children);
    }
  };
  await Promise.all(Array.from({ length: CONC }, () => worker()));
  return allPdp.slice(0, MAX_PDP_PER_MERCHANT);
}

// ---------------------------------------------------------------------------
// Match: title-fuzzy + handle-substring
// ---------------------------------------------------------------------------

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function similarity(a: string, b: string): number {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.95;
  let inter = 0;
  for (const c of new Set(na)) if (nb.includes(c)) inter++;
  return inter / Math.max(new Set(na).size, new Set(nb).size);
}

function lowerPathHasNoise(url: string): boolean {
  return /\/collections?\/|\/blog\/|\/about\/|\/pages\/|\/advisor|\/account|\/cart|\/login|\/help|\/search/i.test(url);
}

function lastPathTail(lower: string): string {
  const tail = lower
    .split('?')[0]!.split('#')[0]!.replace(/\.html?$/, '').replace(/\/$/, '')
    .split('/').filter(Boolean);
  return (tail[tail.length - 1] ?? '').toLowerCase();
}

function handleHintScore(lower: string, hint: string): number {
  const tail = lastPathTail(lower);
  if (!tail || !hint) return 0;
  return similarity(tail, hint);
}

function titleVsUrlScore(lower: string, title: string): number {
  const tail = lastPathTail(lower);
  if (!tail) return 0;
  return similarity(tail, title);
}

function bestUrlForAnchor(anchor: Anchor, pdpUrls: string[]): string | null {
  let best: { url: string; score: number } | null = null;
  for (const u of pdpUrls) {
    if (lowerPathHasNoise(u)) continue;
    const lower = u.toLowerCase();
    const s = Math.max(handleHintScore(lower, anchor.handle_hint), titleVsUrlScore(lower, anchor.title));
    if (s > 0.85 && (!best || s > best.score)) {
      best = { url: u, score: s };
    }
  }
  return best?.url ?? null;
}

async function fixMerchantSitemap(merchantSlug: string, cfg: MerchantCfg): Promise<Record<string, string>> {
  const anchors = ANCHORS[merchantSlug] ?? [];
  const pdpUrls = await fetchAllPdpUrls(cfg.url);
  const fixes: Record<string, string> = {};
  for (const a of anchors) {
    const url = bestUrlForAnchor(a, pdpUrls);
    if (url) fixes[a.product_slug] = url;
  }
  return fixes;
}

// ---------------------------------------------------------------------------
// Playwright stub: emit pending-playwright.json
// ---------------------------------------------------------------------------

type PendingRow = {
  home: string;
  merchant_slug: string;
  title: string;
  product_slug: string;
};

function emitPlaywrightPending(merchantSlug: string, cfg: MerchantCfg): Record<string, PendingRow> {
  const anchors = ANCHORS[merchantSlug] ?? [];
  const out: Record<string, PendingRow> = {};
  for (const a of anchors) {
    out[a.product_slug] = {
      home: cfg.url,
      merchant_slug: merchantSlug,
      title: a.title,
      product_slug: a.product_slug,
    };
  }
  return out;
}

// ---------------------------------------------------------------------------
// DB commits
// ---------------------------------------------------------------------------

async function commitFixes(fixes: Record<string, string>): Promise<{ updated: number; failed: string[] }> {
  const updated: { slug: string }[] = [];
  const failed: string[] = [];
  for (const [slug, url] of Object.entries(fixes)) {
    if (!url) continue;
    if (DRY_RUN) continue;
    const res = await sb
      .from('products')
      .update({
        source_url: url,
        last_seen_at: new Date().toISOString(),
      } as never)
      .eq('slug', slug)
      .select('slug');
    if (res.error) {
      failed.push(slug);
    } else if (res.data && res.data.length > 0) {
      updated.push(res.data[0] as { slug: string });
    }
  }
  return { updated: updated.length, failed };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const merchantsToProcess = INCLUDED
    ? Object.entries(MERCHANT_CFG).filter(([slug]) => INCLUDED.includes(slug))
    : Object.entries(MERCHANT_CFG);

  console.log(
    `▶ Fix source_urls (Path E) for ${merchantsToProcess.length} merchants${DRY_RUN ? ' [DRY RUN]' : ''}${INCLUDED ? ` (filtered: ${INCLUDED.join(', ')})` : ''}`
  );

  const allSitemapFixes: Record<string, Record<string, string>> = {};
  const allPlaywrightPending: Record<string, Record<string, PendingRow>> = {};

  for (const [merchantSlug, cfg] of merchantsToProcess) {
    console.log(`\n── ${merchantSlug} (${cfg.strategy}) ${cfg.notes ?? ''}`);
    if (cfg.strategy === 'sitemap' || cfg.strategy === 'sitemap_index' || cfg.strategy === 'sitemap_redirect') {
      const fixes = await fixMerchantSitemap(merchantSlug, cfg);
      allSitemapFixes[merchantSlug] = fixes;
      const anchors = ANCHORS[merchantSlug] ?? [];
      for (const a of anchors) {
        const url = fixes[a.product_slug];
        console.log(`  ${url ? '✓' : '✗'} ${a.product_slug.padEnd(35)} -> ${url ?? 'NO MATCH'}`);
      }
      console.log(`  fixes: ${Object.keys(fixes).length}/${anchors.length}`);
    } else if (cfg.strategy === 'playwright_search') {
      const pending = emitPlaywrightPending(merchantSlug, cfg);
      allPlaywrightPending[merchantSlug] = pending;
      console.log(`  stub: ${Object.keys(pending).length} URLs pending (Playwright or browse.ai)`);
    }
  }

  // Persist fixes to DB
  const totalFixes: Record<string, string> = {};
  for (const fixes of Object.values(allSitemapFixes)) Object.assign(totalFixes, fixes);

  let dbReport: { updated: number; failed: string[] } = { updated: 0, failed: [] };
  if (Object.keys(totalFixes).length > 0) {
    console.log(`\n── DB upsert ──`);
    dbReport = await commitFixes(totalFixes);
    console.log(`  ${DRY_RUN ? '(dry-run would update)' : 'updated'} ${dbReport.updated} products`);
    if (dbReport.failed.length) console.log(`  failed: ${dbReport.failed.join(', ')}`);
  }

  // Emit pending-playwright.json
  if (!SITEMAP_ONLY && Object.keys(allPlaywrightPending).length > 0) {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const outPath = path.resolve('./pending-playwright.json');
    await fs.writeFile(outPath, JSON.stringify(allPlaywrightPending, null, 2));
    const total = Object.values(allPlaywrightPending).reduce((n, m) => n + Object.keys(m).length, 0);
    console.log(`\n── pending-playwright.json ──`);
    console.log(`  ${Object.keys(allPlaywrightPending).length} merchants · ${total} URLs pending`);
    console.log(`  path: ${outPath}`);
  }

  // Final tally
  const totalAnchors = merchantsToProcess.reduce(
    (n, [slug]) => n + (ANCHORS[slug]?.length ?? 0),
    0
  );
  const totalFixed = Object.values(allSitemapFixes).reduce((n, m) => n + Object.keys(m).length, 0);
  const totalPending = Object.values(allPlaywrightPending).reduce((n, m) => n + Object.keys(m).length, 0);

  console.log(`\n=== Summary ===`);
  console.log(`Sitemap-fixed: ${totalFixed} / ${totalAnchors} (${totalAnchors ? (100 * totalFixed / totalAnchors).toFixed(0) : 0}%)`);
  console.log(`Playwright-pending: ${totalPending}`);
  console.log(`DB writes ${DRY_RUN ? '(dry-run)' : ''}: ${dbReport.updated} updated, ${dbReport.failed.length} failed`);

  console.log(`\n=== Next steps ===`);
  if (totalPending > 0) {
    console.log(`  • For the ${totalPending} Playwright-pending URLs:`);
    console.log(`      Option A) install playwright-core + chromium + extend this script:`);
    console.log(`          pnpm add -D playwright-core && npx playwright install chromium`);
    console.log(`      Option B) feed pending-playwright.json to browse.ai / firecrawl / apify.`);
  }
  console.log(`  • Re-run the seed-products-v2 dry-run to validate the fixed URLs:`);
  console.log(`      pnpm scripts:seed:products -- --dry-run \\`);
  console.log(`        --include-stores=ecoalf,rapanui,knowledge-cotton,asket,mud-jeans`);
}

main().catch((err) => {
  console.error('\n❌ FAILED:', err?.message ?? err);
  if (err?.stack) console.error(err.stack);
  process.exit(1);
});
