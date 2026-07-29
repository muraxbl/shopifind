/**
 * Curated Rapanui pilot. Fetches only the selected public product pages and the
 * per-product data those pages preload. It never calls the robots-disallowed
 * /omnis/v3/product-feed/ endpoint and never writes without --write.
 *
 *   pnpm scripts:seed:rapanui
 *   pnpm scripts:seed:rapanui -- --write
 */
import { createClient } from "@supabase/supabase-js";
import {
  buildRapanuiProduct,
  CURATED_RAPANUI_HANDLES,
  parseRapanuiMeta,
  type RapanuiProduct,
  type RapanuiProductPayload,
  type RapanuiStockPayload,
} from "../src/lib/feeds/rapanui";

const WRITE = process.argv.includes("--write");
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ADMIN_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (WRITE && (!SUPABASE_URL || !ADMIN_KEY)) {
  throw new Error("--write requires Supabase URL and service-role key.");
}

const STORE = {
  slug: "rapanui",
  name: "Rapanui",
  url: "https://rapanuiclothing.com",
  niche: "sustainable-fashion",
  short_description:
    "Ropa circular de algodón orgánico, fabricada con energía renovable y diseñada para volver a convertirse en ropa.",
  long_description:
    "Rapanui diseña básicos y prendas gráficas con algodón orgánico, producción alimentada por energía renovable, embalaje sin plástico y un programa de devolución para remanufacturar prendas usadas.",
  eco_score: 90,
  values: ["organic", "circular", "low-impact", "plastic-free", "fair-trade"],
  country: "GB",
  affiliate_program: "skimlinks",
  affiliate_id: null,
  feed_source: "curated-product-api",
  active: true,
  verified: false,
  featured: true,
};

const USER_AGENT =
  "Mozilla/5.0 (compatible; ShopifindCatalogRefresh/1.0; +https://shopifind.app)";
const MAX_JSON_BYTES = 512 * 1024;
const MAX_HTML_BYTES = 128 * 1024;

async function boundedText(
  response: Response,
  maxBytes: number,
): Promise<string> {
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.url}`);
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > maxBytes)
    throw new Error(`Response too large: ${response.url}`);
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > maxBytes)
    throw new Error(`Response too large: ${response.url}`);
  return new TextDecoder().decode(buffer);
}

async function fetchText(url: string, maxBytes: number): Promise<string> {
  const response = await fetch(url, {
    cache: "no-store",
    redirect: "follow",
    headers: { "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(20_000),
  });
  return boundedText(response, maxBytes);
}

async function fetchProduct(
  handle: string,
  storeId: string,
  observedAt: string,
): Promise<RapanuiProduct> {
  const base = `https://rapanuiclothing.com`;
  const [html, payloadText, stockText] = await Promise.all([
    fetchText(`${base}/product/${handle}/`, MAX_HTML_BYTES),
    fetchText(
      `${base}/omnis/v3/division/14/products/${handle}/`,
      MAX_JSON_BYTES,
    ),
    fetchText(
      `${base}/omnis/v3/division/14/products/${handle}/stock/`,
      MAX_JSON_BYTES,
    ),
  ]);
  const product = buildRapanuiProduct({
    handle,
    payload: JSON.parse(payloadText) as RapanuiProductPayload,
    stock: JSON.parse(stockText) as RapanuiStockPayload,
    meta: parseRapanuiMeta(html),
    storeId,
    observedAt,
  });
  const imageResponse = await fetch(product.image_url, {
    cache: "no-store",
    headers: { "user-agent": USER_AGENT, range: "bytes=0-1023" },
    signal: AbortSignal.timeout(15_000),
  });
  if (
    !imageResponse.ok ||
    !(imageResponse.headers.get("content-type") ?? "").startsWith("image/")
  ) {
    throw new Error(`Origin image unavailable: ${product.image_url}`);
  }
  await imageResponse.body?.cancel();
  return product;
}

async function main() {
  const observedAt = new Date().toISOString();
  const storeId = WRITE ? "pending" : "dry-run-rapanui";
  console.log(
    `Rapanui curated ingest: ${CURATED_RAPANUI_HANDLES.length} products (${WRITE ? "WRITE" : "DRY RUN"})`,
  );

  const products: RapanuiProduct[] = [];
  for (const handle of CURATED_RAPANUI_HANDLES) {
    const product = await fetchProduct(handle, storeId, observedAt);
    products.push(product);
    console.log(
      `✓ ${product.slug} · ${product.currency} ${(product.price_cents / 100).toFixed(2)} · ${product.in_stock ? "stock" : "out"} · ${new URL(product.image_url).hostname}`,
    );
  }
  if (!WRITE) {
    console.log("DRY RUN — no database writes.");
    return;
  }

  const sb = createClient(SUPABASE_URL!, ADMIN_KEY!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const storeResult = await sb
    .from("stores")
    .upsert(STORE as never, { onConflict: "slug" })
    .select("id")
    .single();
  if (storeResult.error) throw storeResult.error;
  const realStoreId = (storeResult.data as { id: string }).id;
  const rows = products.map((product) => ({
    ...product,
    store_id: realStoreId,
  }));
  const productResult = await sb
    .from("products")
    .upsert(rows as never, { onConflict: "slug" })
    .select("id, slug");
  if (productResult.error) throw productResult.error;

  const currentResult = await sb
    .from("products")
    .select("id, slug, in_stock")
    .eq("store_id", realStoreId);
  if (currentResult.error) throw currentResult.error;
  const curated = new Set(rows.map((row) => row.slug));
  const staleIds = (currentResult.data ?? [])
    .filter(
      (row: { id: string; slug: string; in_stock: boolean }) =>
        row.in_stock && !curated.has(row.slug),
    )
    .map((row: { id: string }) => row.id);
  if (staleIds.length > 0) {
    const staleResult = await sb
      .from("products")
      .update({ in_stock: false } as never)
      .in("id", staleIds);
    if (staleResult.error) throw staleResult.error;
  }

  console.log(
    JSON.stringify({
      ok: true,
      store: STORE.slug,
      products_upserted: productResult.data?.length ?? 0,
      legacy_products_hidden: staleIds.length,
      observed_at: observedAt,
    }),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
