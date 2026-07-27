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

const MAX_DEPTH = 8;

async function extractSitemapUrls(startUrl: string, depth = 0): Promise<ExtractResult> {
  if (depth > MAX_DEPTH) return { kind: 'error', reason: 'max-depth-exceeded' };
  const xml = await fetchText(startUrl);
  if (!xml) return { kind: 'error', reason: 'fetch-failed' };
  if (/<sitemapindex/i.test(xml)) {
    return { kind: 'index', children: await extractLocs(xml) };
  }
  return { kind: 'pdp', urls: await extractLocs(xml) };
}

const MAX_PDP_PER_MERCHANT = 30000; // safety cap; ecoalf has ~22k PDPs over 91 paginated sitemap pages
async function fetchAllPdpUrls(startUrl: string): Promise<string[]> {
  const isMudJeans = startUrl.includes('mudjeans');
  const isKca = startUrl.includes('knowledgecottonapparel');

  // Mud-Jeans: probe the canonical /sitemap.xml + 3 alternates in parallel.
  // CMS quirk observed in pre-flight: mudjeans.eu/sitemap.xml is a metadata
  // sitemap that lists other sitemapindex children, but the product pages
  // are sometimes split across /sitemap_pages.xml, /sitemap_products.xml,
  // /products/sitemap.xml depending on the page-type taxonomy. Pre-flight
  // showed 404/429 on the canned paths but YMMV per build; we probe all 4
  // and de-dupe pdp urls downstream. ecoalf/kca/asket/rapanui: single
  // canonical URL (already known-good from pre-flight).
  const starts = isMudJeans
    ? [
        startUrl,
        new URL('/sitemap_pages.xml', startUrl).href,
        new URL('/sitemap_products.xml', startUrl).href,
        new URL('/products/sitemap.xml', startUrl).href,
      ]
    : [startUrl];

  const allPdp: string[] = [];
  const queue: string[] = [];

  // Stage 1: probe every start URL. PDP-direct ones append to allPdp;
  // index ones append children to queue.
  for (const url of starts) {
    const result = await extractSitemapUrls(url);
    if (result.kind === 'pdp') allPdp.push(...result.urls);
    else if (result.kind === 'index') queue.push(...result.children);
  }

  // Stage 2: KCA-specific fallback. knowledgecottonapparel.com/sitemap.xml
  // has only 6 entries that point at `sitemap_products_1.xml?from=...`
  // children; pre-flight showed `?from=` query strings sometimes return
  // 400 on bare fetch. Probe canonical /sitemap_products_<N>.xml paths
  // directly when both stage-1 outputs are empty.
  if (isKca && allPdp.length === 0 && queue.length === 0) {
    queue.push(
      ...[1, 2, 3, 4].map((n) => new URL(`/sitemap_products_${n}.xml`, startUrl).href)
    );
  }

  // Stage 3: BFS through index children with 8 concurrent workers.
  // IMPORTANT: do NOT strip `?from=YYYY-MM-DD&to=YYYY-MM-DD` from Shopify
  // paginated child URLs (`sitemap_products_<N>.xml?from=...`). These
  // query strings ARE the pagination cursor — stripping them causes the
  // server to return only `page 1` of the same sitemap, repeated 91 times
  // for ecoalf (causing the 0/4 match observed in pre-edit). The bare base
  // URL `/sitemap_products_1.xml` returns a 400 or the same truncated page.
  const CONC = 8;
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

  // Final: strip query trackers (`?from=`, `?id=`, etc.) off the PDP URLs.
  // Some merchants pad their sitemap entries to fight leakages; the matcher
  // already drops query params via lastPathTail, but pre-clearing keeps the
  // matcher away from accidental half-matches.
  return allPdp
    .slice(0, MAX_PDP_PER_MERCHANT)
    .map((u) => u.split('?')[0]!);
}

// ---------------------------------------------------------------------------
// Match: title-fuzzy + handle-substring
// ---------------------------------------------------------------------------

/**
 * Spanish → English apparel synset. ecoalf + kca serve PDPs under Spanish
 * locale slugs (`chaqueta-marangu`, `sudadera-orion`) while our anchors are
 * English (`Marangu Jacket`, `Orion Sweatshirt`). Translating BEFORE the
 * alphanumeric-strip pass collapses the comparison: `chaqueta-marangu`
 *  → `jacketmarangu` vs anchor handle hint `marangu-jacket` → `marangujacket`.
 *
 * Keys are accent-folded (via NFD strip below). Limits: 12 common items; long
 * tail (camiseta interior, jersey fino, etc.) intentionally NOT covered — the
 * matcher already has substring-containment fallback for close handles.
 */
const DICT_ES_EN: Record<string, string> = {
  chaqueta: 'jacket',
  pantalon: 'pant',
  sudadera: 'sweatshirt',
  zapatillas: 'sneakers',
  camiseta: 'tee',
  jersey: 'sweater',
  abrigo: 'coat',
  falda: 'skirt',
  vestido: 'dress',
  blusa: 'blouse',
  bolso: 'bag',
  zapato: 'shoe',
};

function norm(s: string): string {
  let v = s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // fold accents
  for (const [es, en] of Object.entries(DICT_ES_EN)) {
    v = v.replace(new RegExp(`\\b${es}\\b`, 'g'), en);
  }
  return v.replace(/[^a-z0-9]+/g, '');
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

/**
 * Character bigrams + Jaccard overlap. Used by Playwright search flow to
 * score result-page links vs an anchor's handle_hint / title without
 * trusting CSS selectors (which break across SFCC storefronts). Dice-style
 * bigram coefficients are robust to permutations (`organic-tee` vs
 * `organic-cotton-tee`) and to single-token drops (`jacket` missing from a
 * long banner link). Threshold 0.25 catches the third-of-overlap case
 * observed in the failed dry-run (`organic-cotton-tee` ↔ `organic-cotton-tee-rope`).
 */
function bigrams(s: string): Set<string> {
  const t = s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const out = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
}

function bigramJaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
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

/**
 * Common apparel color tokens that merchants append as URL tail variants
 * (e.g., /products/organic-tee-jade, /products/jeans-navy-stonewash). Stripping
 * them before similarity scoring lets the bare product handle match its anchor
 * even when the merchant catalogues each color as a separate URL.
 *
 * Loop iteratively up to 3 deep so stacked variants (-rose-blue, -navy-sand)
 * all collapse to the bare handle.
 */
const COLORS = [
  'jade', 'rose', 'navy', 'sand', 'black', 'blue', 'white',
  'green', 'red', 'grey', 'gray', 'olive', 'cream', 'beige', 'tan',
  'stonewash', 'indigo', 'rust', 'berry',
];

function stripColorTokens(tail: string): string {
  let s = tail;
  for (let i = 0; i < 3; i++) {
    let hit = false;
    for (const c of COLORS) {
      if (s.endsWith('-' + c)) {
        s = s.slice(0, -(c.length + 1));
        hit = true;
      }
    }
    if (!hit) break;
  }
  return s;
}

function handleHintScore(lower: string, hint: string): number {
  const tail = lastPathTail(lower);
  if (!tail || !hint) return 0;
  // Best score: original tail vs color-stripped tail. Lets both bare handles
  // ("organic-tee") and color-variant handles ("organic-tee-jade" or
  // "organic-tee-rose-blue") match the same anchor.
  return Math.max(similarity(tail, hint), similarity(stripColorTokens(tail), hint));
}

function titleVsUrlScore(lower: string, title: string): number {
  const tail = lastPathTail(lower);
  if (!tail) return 0;
  return Math.max(similarity(tail, title), similarity(stripColorTokens(tail), title));
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
// Pre-flight plain-HTTP search (fast path, no chromium)
// ---------------------------------------------------------------------------

/**
 * Pre-flight search via plain HTTP `fetch()` against the merchant's
 * /search?q=<title> endpoint. Avoids the chromium launch overhead for
 * merchants that server-render their search results page. Reformation's
 * Algolia-backed SFCC store exposes a public HTML /search?q= endpoint
 * that returns PDP-style href anchors; Stella & Armedangels may or may
 * not depending on WAF traversal at fetch time.
 *
 * Each candidate href is scored by bigram Jaccard overlap with the
 * anchor's handle_hint AND title. Threshold 0.30 is intentionally
 * slightly higher than the Playwright path's 0.25 — pre-flight is a
 * high-confidence shortcut, we only commit if the link is genuinely
 * the right PDP. Falls back to playwrightSearch (or pending-playwright
 * emit) for anchors we couldn't resolve.
 *
 * Returns { [product_slug]: resolvedUrl } when at least one anchor
 * resolves; returns null if no anchor resolved at all (caller will
 * proceed to playwrightSearch).
 */
async function preflightSearch(
  merchantSlug: string,
  baseUrl: string,
  anchors: Anchor[]
): Promise<Record<string, string> | null> {
  const fixes: Record<string, string> = {};
  let resolvedAny = false;
  for (const a of anchors) {
    try {
      const url = `${baseUrl.replace(/\/$/, '')}/search?q=${encodeURIComponent(a.title)}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; ShopifindBot/1.0; +https://shopifind.app)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(15_000),
        redirect: 'follow',
      });
      if (!res.ok) continue;
      const html = await res.text();
      const hintBi = bigrams(a.handle_hint);
      const titleBi = bigrams(a.title);
      const candidates: { href: string; score: number }[] = [];
      // Match every href anchor in the search-results HTML; score each by
      // bigram overlap with handle_hint + title.
      const re = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi;
      for (const m of html.matchAll(re)) {
        const href = m[1]!;
        const lower = href.toLowerCase();
        if (lowerPathHasNoise(href)) continue;
        if (!lower.startsWith('http') && !lower.startsWith('/')) continue;
        if (!/\/p\/|\/products?\/|\/shop\/|\/item\/|\/[a-z0-9-]{6,}-p-/i.test(lower)) continue;
        const tail = lastPathTail(lower);
        if (!tail) continue;
        const score = Math.max(
          bigramJaccard(hintBi, bigrams(tail)),
          bigramJaccard(titleBi, bigrams(tail))
        );
        if (score >= 0.30) candidates.push({ href, score });
      }
      candidates.sort((x, y) => y.score - x.score);
      if (candidates.length > 0) {
        try {
          const abs = new URL(candidates[0]!.href, baseUrl).href.split('?')[0]!;
          fixes[a.product_slug] = abs;
          resolvedAny = true;
          console.log(
            `    📡 preflight: ${a.product_slug} -> ${abs} (score ${candidates[0]!.score.toFixed(2)})`
          );
        } catch {
          // ignore malformed URL, fall through to next anchor
        }
      }
    } catch {
      // per-anchor fetch failure is non-fatal; Playwright will retry.
    }
  }
  return resolvedAny ? fixes : null;
}

// ---------------------------------------------------------------------------
// Playwright SFCC search (real flow for CF WAF + SFCC storefronts)
// ---------------------------------------------------------------------------

import { createRequire } from 'node:module';
const require2 = createRequire(import.meta.url);

const HEADLESS = !process.argv.includes('--no-headless');
/**
 * Per-merchant playwright search:
 *   - armedangels: CF WAF 429 retry-loop with realistic desktop UA.
 *   - reformation-us: SFCC storefront (Algolia-backed search via /search?q=...).
 *   - stella-mccartney: SFCC luxury tier; locale-aware /en-gb/ prefix.
 *
 * Returns { [product_slug]: resolvedUrl } for the anchors we successfully
 * resolved; missing anchors are simply absent from the map (caller falls back
 * to pending-playwright.json emit).
 *
 * Graceful degradation:
 *   - playwright-core not installed → returns null + log warning.
 *   - chromium binary missing / system libs missing → throws at launch; main()
 *     catches + falls back to pending-playwright.json emit.
 *   - Per-anchor network timeout / 429 / no results → skip anchor, continue.
 */
async function playwrightSearch(
  merchantSlug: string,
  cfg: MerchantCfg,
  // Optional list of anchors the caller still needs resolved. Pass the
  // subset that preflightSearch couldn't resolve to save ~30s/anchor of
  // chromium time. Defaults to all anchors for the merchant if omitted.
  anchorsToResolve?: Anchor[]
): Promise<Record<string, string> | null> {
  let pw: typeof import('playwright-core') | null = null;
  try {
    pw = require2('playwright-core') as typeof import('playwright-core');
  } catch {
    console.warn(
      '  ⚠️  playwright-core not installed. Run `pnpm add -D playwright-core && pnpm exec playwright install chromium`. Falling back to pending-playwright.json emit.'
    );
    return null;
  }

  const isArmed = merchantSlug === 'armedangels';
  const isStella = merchantSlug === 'stella-mccartney';
  // Stella storefronts redirect to a /en-gb/ locale tree depending on IP.
  // Netherlands-based fetch lands on /us/ by default; force /en-gb/ for stable slugs.
  const baseUrl = isStella ? `${cfg.url.replace(/\/$/, '')}/en-gb` : cfg.url;

  let browser: import('playwright-core').Browser | null = null;
  try {
    browser = await pw.chromium.launch({
      headless: HEADLESS,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  } catch (err) {
    console.warn(
      `  ⚠️  chromium failed to launch: ${(err as Error).message.split('\n')[0]}`
    );
    console.warn(
      '     Likely missing system libs (libnss3/libxkbcommon0/libgbm1/etc). Falling back to pending-playwright.json emit.'
    );
    return null;
  }

  const fixes: Record<string, string> = {};
  const anchors = anchorsToResolve ?? ANCHORS[merchantSlug] ?? [];

  try {
    for (const a of anchors) {
      let resolvedUrl: string | null = null;
      // Armedangels CF WAF: 3 retries with 5s backoff on 429.
      // Others: 1 attempt; if it fails, the anchor falls through to pending.
      const maxRetries = isArmed ? 3 : 1;
      for (let attempt = 1; attempt <= maxRetries && !resolvedUrl; attempt++) {
        const context = await browser.newContext({
          viewport: { width: 1366, height: 768 },
          locale: isStella ? 'en-GB' : 'en-US',
          userAgent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          // Allow listing patterns that constitute legitimate storefront search
          // traffic per Cloudflare's published radar (UnifiedBot category).
          extraHTTPHeaders: { 'Accept-Language': isStella ? 'en-GB,en;q=0.9' : 'en-US,en;q=0.9' },
        });
        const page = await context.newPage();
        try {
          const navResp = await page.goto(baseUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
          });
          const status = navResp?.status();
          if (status === 429 || status === 403) {
            console.warn(`    ⚠️  ${a.product_slug}: HTTP ${status} (CF WAF). Retry ${attempt}/${maxRetries} in 5s.`);
            // No explicit context.close() here — the `finally` block below
            // is the SOLE closer. The previous version closed twice (early-exit
            // + finally), causing `Target.disposeBrowserContext: Failed to find
            // context with id` at the end of the dry-run.
            if (attempt < maxRetries) await new Promise((r) => setTimeout(r, 5000));
            continue;
          }

          // Cookie banner click — best effort, .catch silently if absent.
          await page
            .locator('button:has-text("Accept"), button:has-text("Aceptar"), button:has-text("Accepter")')
            .first()
            .click({ timeout: 4000 })
            .catch(() => {});

          // Search input discovery: priority chain covers SFCC + bespoke stores.
          const searchInput = page
            .locator([
              'input[name="q"]',
              'input[type="search"]',
              'input[placeholder*="earch"]',
              'input[aria-label*="earch"]',
              'input[role="searchbox"]',
            ].join(','))
            .first();
          await searchInput.waitFor({ state: 'visible', timeout: 10000 }).catch(() => null);
          const inputCount = await page.locator('input[name="q"], input[type="search"]').count();
          if (inputCount === 0) {
            console.warn(`    ⚠️  ${a.product_slug}: no search input found.`);
            // No explicit context.close() here — finally is the sole closer.
            break;
          }
          await searchInput.fill(a.title);
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => null),
            searchInput.press('Enter'),
          ]);
          await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);

          // Score every result-page <a> by bigram Jaccard overlap with the
          // anchor's handle_hint and title. This replaces the brittle
          // firstToken=split('-')[len≥4] heuristic which missed handles like
          // `falabella-tote-mini` (every token ≤ 4 chars) and couldn't handle
          // transpositions like `organic-cotton-tee` vs variant form
          // `organic-cotton-tee-rope-jade`. Also: 0 selectors means 0 race
          // conditions on `waitForNavigation` after `click()` (Chromium push-
          // state vs. real nav race was the cause of the previous timeout).
          const allLinks: { href: string }[] = await page
            .locator('a[href]')
            .evaluateAll((els) =>
              els
                .map((el) => ({
                  href: (el as HTMLAnchorElement).getAttribute('href') ?? '',
                }))
                .filter((x) => !!x.href)
            );
          const hintBi = bigrams(a.handle_hint);
          const titleBi = bigrams(a.title);
          let bestLink: { href: string; score: number } | null = null;
          for (const { href } of allLinks) {
            const lower = href.toLowerCase();
            if (lowerPathHasNoise(href)) continue;
            if (!lower.startsWith('http') && !lower.startsWith('/')) continue;
            // PDP-ish path marker. SFCC / Shopify / Armedangels all serve
            // products under one of these patterns.
            if (!/\/p\/|\/products?\/|\/shop\/|\/item\/|\/[a-z0-9-]{6,}-p-/i.test(lower)) continue;
            const tail = lastPathTail(lower);
            if (!tail) continue;
            const score = Math.max(
              bigramJaccard(hintBi, bigrams(tail)),
              bigramJaccard(titleBi, bigrams(tail))
            );
            if (score >= 0.25 && (!bestLink || score > bestLink.score)) {
              bestLink = { href, score };
            }
          }
          if (!bestLink) {
            console.warn(
              `    ⚠️  ${a.product_slug}: no result link matched bigram overlap (hint=${a.handle_hint}, title=${a.title}).`
            );
            // No explicit context.close() — finally is the sole closer.
            break;
          }
          // Navigate directly to the best-matching PDP rather than relying on
          // click + waitForNavigation (which races with chrome push-state).
          const targetUrl = new URL(bestLink.href, page.url()).href;
          await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => null);
          await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => null);
          console.log(`    🔎 ${a.product_slug}: navigated to ${targetUrl} (score ${bestLink.score.toFixed(2)})`);

          // Prefer the canonical link declared on the PDP; fallback to current URL.
          const canonical = await page
            .locator('link[rel="canonical"]')
            .first()
            .getAttribute('href', { timeout: 4000 })
            .catch(() => null);
          resolvedUrl = canonical || page.url();
          resolvedUrl = resolvedUrl.split('?')[0]!; // strip trackers
        } catch (err) {
          console.warn(
            `    ⚠️  ${a.product_slug}: ${(err as Error).message.split('\n')[0]}`
          );
        } finally {
          // Idempotent close: the page/context may already be torn down by
          // CF WAF disconnects or by the locator query that already failed
          // inside the try block. `Target.disposeBrowserContext: Failed to
          // find context` is harmless when we just retry the next anchor —
          // so swallow it instead of crashing the whole script.
          await context.close().catch(() => null);
        }
      }

      if (resolvedUrl) fixes[a.product_slug] = resolvedUrl;
    }
  } finally {
    if (browser) await browser.close().catch(() => null);
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
      if (!SITEMAP_ONLY) {
        const anchors = ANCHORS[merchantSlug] ?? [];
        // 1) Pre-flight plain-HTTP /search?q= — fast path for merchants that
        //    server-render their search results (Reformation Algolia, often
        //    Stella for some locales). No chromium, no CF WAF dance.
        const preflightBase =
          merchantSlug === 'stella-mccartney'
            ? `${cfg.url.replace(/\/$/, '')}/en-gb`
            : cfg.url;
        const preflight = await preflightSearch(merchantSlug, preflightBase, anchors);
        // 2) Playwright chromium — slow path for CF WAF (armedangels) and
        //    JS-only SPAs that don't server-render the /search?q= response.
        //    a) Skip anchors already resolved by preflight (saves ~30s/anchor
        //       of chromium time). b) Wrap the call in try/catch so a dead
        //       browser inside playwrightSearch doesn't abort the outer
        //       merchant loop — reformation & stella MUST be attempted even
        //       if armedangels' chromium session collapses after CF WAF
        //       tears down the page during locator.fill timeouts.
        const unresolvedAnchors = anchors.filter(
          (x) => !preflight?.[x.product_slug]
        );
        let playwrightFixes: Record<string, string> | null = null;
        if (unresolvedAnchors.length > 0) {
          try {
            playwrightFixes = await playwrightSearch(
              merchantSlug,
              cfg,
              unresolvedAnchors
            );
          } catch (err) {
            console.warn(
              `  ⚠️  ${merchantSlug}: playwright crashed: ${(err as Error).message.split('\n')[0]}. Continuing with preflight-only fixes.`
            );
          }
        }
        // 3) Merge. Pre-flight wins on ties (faster + already verified).
        const combined: Record<string, string> = {
          ...(playwrightFixes ?? {}),
          ...(preflight ?? {}),
        };
        if (Object.keys(combined).length > 0 || preflight !== null || playwrightFixes !== null) {
          allSitemapFixes[merchantSlug] = combined;
          for (const a of anchors) {
            const url = combined[a.product_slug];
            const source =
              preflight?.[a.product_slug]
                ? '📡'
                : playwrightFixes?.[a.product_slug]
                  ? '✓ '
                  : '✗';
            console.log(`  ${source} ${a.product_slug.padEnd(35)} -> ${url ?? 'NO MATCH'}`);
          }
          const totalResolved = Object.keys(combined).length;
          console.log(
            `  fixes: ${totalResolved}/${anchors.length} (preflight ${Object.keys(preflight ?? {}).length}, playwright ${Object.keys(playwrightFixes ?? {}).length})`
          );
          // Emit only the unresolved anchors to pending-playwright.json so
          // the operator can sweep the stragglers via browse.ai / firecrawl
          // / apify one-shots.
          const stillPending = anchors.filter((a) => !combined[a.product_slug]);
          if (stillPending.length > 0) {
            const pending: Record<string, PendingRow> = {};
            for (const a of stillPending) {
              pending[a.product_slug] = {
                home: cfg.url,
                merchant_slug: merchantSlug,
                title: a.title,
                product_slug: a.product_slug,
              };
            }
            allPlaywrightPending[merchantSlug] = pending;
            console.log(
              `  stub: ${stillPending.length} URLs still pending (browse.ai fallback)`
            );
          }
          continue;
        }
      }
      // Fallback: emit to pending-playwright.json when both preflight and
      // Playwright couldn't run (deps missing, chromium launch failed,
      // SITEMAP_ONLY passed, no playwright-core). Operator resolves via
      // browse.ai / firecrawl / apify one-shots.
      const pending = emitPlaywrightPending(merchantSlug, cfg);
      allPlaywrightPending[merchantSlug] = pending;
      console.log(
        `  stub: ${Object.keys(pending).length} URLs pending (Playwright or browse.ai)`
      );
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
