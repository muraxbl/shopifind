/**
 * Curated Oakywood pilot using Shopify's official UCP Storefront Catalog.
 * The script performs one read-only lookup for ten explicit product IDs and
 * never writes without --write.
 *
 *   pnpm scripts:seed:oakywood
 *   pnpm scripts:seed:oakywood -- --write
 */
import { createClient } from "@supabase/supabase-js";
import {
  CURATED_OAKYWOOD_PRODUCT_IDS,
  OAKYWOOD_UCP_ENDPOINT,
  parseOakywoodLookup,
  SHOPIFY_UCP_AGENT_PROFILE,
  type OakywoodProduct,
} from "../src/lib/feeds/oakywood";

const WRITE = process.argv.includes("--write");
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ADMIN_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (WRITE && (!SUPABASE_URL || !ADMIN_KEY)) {
  throw new Error("--write requires Supabase URL and service-role key.");
}

const STORE = {
  slug: "oakywood",
  name: "Oakywood",
  url: "https://oakywood.shop",
  niche: "indie-gadgets",
  short_description:
    "Accesorios de escritorio tecnológicos diseñados y fabricados en un taller familiar de Polonia.",
  long_description:
    "Oakywood combina madera y materiales de origen responsable con accesorios tecnológicos duraderos para organizar el espacio de trabajo. Documenta madera FSC, producción local, recuperación de productos y cinco años de garantía.",
  eco_score: 84,
  values: [
    "independent",
    "made-in-poland",
    "responsible-materials",
    "fsc-wood",
    "five-year-warranty",
  ],
  country: "PL",
  affiliate_program: "skimlinks",
  affiliate_id: null,
  feed_source: "shopify-ucp-curated",
  active: true,
  verified: false,
  featured: true,
};

const USER_AGENT =
  "Mozilla/5.0 (compatible; ShopifindCatalogRefresh/1.0; +https://shopifind.app)";
const MAX_RESPONSE_BYTES = 512 * 1024;

async function fetchLookup(): Promise<unknown> {
  const response = await fetch(OAKYWOOD_UCP_ENDPOINT, {
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
            ids: CURATED_OAKYWOOD_PRODUCT_IDS,
            context: {
              address_country: "ES",
              language: "es-ES",
              currency: "EUR",
              intent:
                "curated sustainable workspace accessories from an independent European maker",
            },
            filters: { available: true },
          },
        },
      },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Oakywood UCP HTTP ${response.status}`);
  }
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_RESPONSE_BYTES)
    throw new Error("Oakywood UCP response too large.");
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_RESPONSE_BYTES) {
    throw new Error("Oakywood UCP response too large.");
  }
  return JSON.parse(new TextDecoder().decode(buffer)) as unknown;
}

async function assertOriginImages(products: OakywoodProduct[]): Promise<void> {
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

async function main() {
  const observedAt = new Date().toISOString();
  console.log(
    `Oakywood curated UCP ingest: ${CURATED_OAKYWOOD_PRODUCT_IDS.length} products (${WRITE ? "WRITE" : "DRY RUN"})`,
  );
  const products = parseOakywoodLookup(
    await fetchLookup(),
    WRITE ? "pending" : "dry-run-oakywood",
    observedAt,
  );
  await assertOriginImages(products);
  for (const product of products) {
    console.log(
      `✓ ${product.slug} · ${product.currency} ${(product.price_cents / 100).toFixed(2)} · stock · ${new URL(product.image_url).hostname}`,
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
