import { createClient } from "@supabase/supabase-js";
import {
  SHOPIFY_UCP_AGENT_PROFILE,
  type CuratedCatalogProduct,
} from "../../src/lib/feeds/shopifyUcp";

const USER_AGENT =
  "Mozilla/5.0 (compatible; ShopifindCatalogRefresh/1.0; +https://shopifind.app)";
const MAX_RESPONSE_BYTES = 512 * 1024;

type CuratedUcpSeedConfig = {
  label: string;
  dryRunStoreId: string;
  endpoint: string;
  productIds: readonly string[];
  intent: string;
  store: Record<string, unknown>;
  parse: (
    payload: unknown,
    storeId: string,
    observedAt: string,
  ) => CuratedCatalogProduct[];
};

function exactUcpEndpoint(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".myshopify.com") ||
    url.pathname !== "/api/ucp/mcp" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(`Unexpected Shopify UCP endpoint: ${value}`);
  }
  return url.toString();
}

async function fetchLookup(config: CuratedUcpSeedConfig): Promise<unknown> {
  const response = await fetch(exactUcpEndpoint(config.endpoint), {
    method: "POST",
    cache: "no-store",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "user-agent": USER_AGENT,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "tools/call",
      id: 1,
      params: {
        name: "lookup_catalog",
        arguments: {
          meta: {
            "ucp-agent": { profile: SHOPIFY_UCP_AGENT_PROFILE },
          },
          catalog: {
            ids: config.productIds,
            context: {
              address_country: "ES",
              language: "es-ES",
              currency: "EUR",
              intent: config.intent,
            },
            filters: { available: true },
          },
        },
      },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`${config.label} UCP HTTP ${response.status}`);
  }
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_RESPONSE_BYTES) {
    throw new Error(`${config.label} UCP response too large.`);
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_RESPONSE_BYTES) {
    throw new Error(`${config.label} UCP response too large.`);
  }
  return JSON.parse(new TextDecoder().decode(buffer)) as unknown;
}

async function assertOriginImages(
  products: CuratedCatalogProduct[],
): Promise<void> {
  for (const product of products) {
    const response = await fetch(product.image_url, {
      cache: "no-store",
      headers: { "user-agent": USER_AGENT, range: "bytes=0-1023" },
      signal: AbortSignal.timeout(15_000),
    });
    if (
      !response.ok ||
      !(response.headers.get("content-type") ?? "").startsWith("image/")
    ) {
      throw new Error(`Origin image unavailable: ${product.image_url}`);
    }
    await response.body?.cancel();
  }
}

export async function runCuratedShopifyUcpSeed(
  config: CuratedUcpSeedConfig,
): Promise<void> {
  const write = process.argv.includes("--write");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (write && (!supabaseUrl || !adminKey)) {
    throw new Error("--write requires Supabase URL and service-role key.");
  }
  const observedAt = new Date().toISOString();
  console.log(
    `${config.label} curated UCP ingest: ${config.productIds.length} products (${write ? "WRITE" : "DRY RUN"})`,
  );
  const products = config.parse(
    await fetchLookup(config),
    write ? "pending" : config.dryRunStoreId,
    observedAt,
  );
  await assertOriginImages(products);
  for (const product of products) {
    console.log(
      `✓ ${product.slug} · ${product.currency} ${(product.price_cents / 100).toFixed(2)} · stock · ${new URL(product.image_url).hostname}`,
    );
  }
  if (!write) {
    console.log("DRY RUN — no database writes.");
    return;
  }

  const sb = createClient(supabaseUrl!, adminKey!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const storeResult = await sb
    .from("stores")
    .upsert(config.store as never, { onConflict: "slug" })
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
      store: config.store.slug,
      products_upserted: productResult.data?.length ?? 0,
      legacy_products_hidden: staleIds.length,
      observed_at: observedAt,
    }),
  );
}
