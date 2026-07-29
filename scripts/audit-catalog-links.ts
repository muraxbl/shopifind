/**
 * Read-only by default. Audits active non-Masterled products and can hide only
 * rows that have a hard-broken destination or a non-product image.
 *
 *   pnpm scripts:audit:catalog
 *   pnpm scripts:audit:catalog -- --write
 */
import { createClient } from "@supabase/supabase-js";
import {
  classifyCatalogHealth,
  isPlaceholderImageUrl,
  type AssetProbe,
} from "../src/lib/catalog/health";

const WRITE = process.argv.includes("--write");
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ADMIN_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const READ_KEY = ADMIN_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !READ_KEY) {
  throw new Error("Missing Supabase URL/key. Load .env.local first.");
}
if (WRITE && !ADMIN_KEY) {
  throw new Error("--write requires SUPABASE_SERVICE_ROLE_KEY.");
}

const sb = createClient(SUPABASE_URL, READ_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

type StoreRow = { id: string; slug: string };
type ProductRow = {
  id: string;
  slug: string;
  store_id: string;
  source_url: string;
  image_url: string;
};

async function readHtmlPrefix(response: Response): Promise<string> {
  if (!(response.headers.get("content-type") ?? "").includes("text/html")) {
    return "";
  }
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (length < 64 * 1024) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    length += value.byteLength;
  }
  await reader.cancel().catch(() => undefined);
  const bytes = new Uint8Array(Math.min(length, 64 * 1024));
  let offset = 0;
  for (const chunk of chunks) {
    const available = Math.min(chunk.byteLength, bytes.byteLength - offset);
    bytes.set(chunk.subarray(0, available), offset);
    offset += available;
    if (offset >= bytes.byteLength) break;
  }
  return new TextDecoder().decode(bytes);
}

async function probe(url: string, image = false): Promise<AssetProbe> {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; ShopifindCatalogAudit/1.0; +https://shopifind.app)",
      },
      signal: AbortSignal.timeout(15_000),
    });
    const html = image ? "" : await readHtmlPrefix(response);
    return {
      status: response.status,
      contentType: response.headers.get("content-type"),
      title:
        html
          .match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]
          ?.replace(/\s+/g, " ")
          .trim() ?? null,
    };
  } catch {
    return { status: null };
  }
}

async function main() {
  const storesResult = await sb
    .from("stores")
    .select("id, slug")
    .eq("active", true)
    .neq("slug", "masterled-es")
    .limit(100);
  if (storesResult.error) throw storesResult.error;
  const stores = (storesResult.data ?? []) as StoreRow[];
  if (stores.length === 0) {
    console.log("No active non-Masterled stores to audit.");
    return;
  }

  const productsResult = await sb
    .from("products")
    .select("id, slug, store_id, source_url, image_url")
    .in(
      "store_id",
      stores.map((store) => store.id),
    )
    .eq("in_stock", true)
    .limit(500);
  if (productsResult.error) throw productsResult.error;
  const products = (productsResult.data ?? []) as ProductRow[];
  const storeById = new Map(stores.map((store) => [store.id, store.slug]));
  const invalid: ProductRow[] = [];

  console.log(
    `Catalog audit: ${products.length} active products (${WRITE ? "WRITE" : "DRY RUN"})`,
  );
  for (const product of products) {
    const [source, image] = await Promise.all([
      probe(product.source_url),
      isPlaceholderImageUrl(product.image_url)
        ? Promise.resolve(null)
        : probe(product.image_url, true),
    ]);
    const health = classifyCatalogHealth({
      imageUrl: product.image_url,
      source,
      image,
    });
    console.log(
      JSON.stringify({
        store: storeById.get(product.store_id),
        slug: product.slug,
        publishable: health.publishable,
        source_status: source.status,
        image_status: image?.status ?? null,
        reasons: health.reasons,
        warnings: health.warnings,
      }),
    );
    if (!health.publishable) invalid.push(product);
  }

  console.log(`Invalid: ${invalid.length}/${products.length}`);
  if (!WRITE) {
    console.log(
      "DRY RUN — re-run with --write to set invalid products out of stock.",
    );
    return;
  }

  if (invalid.length > 0) {
    const update = await sb
      .from("products")
      .update({ in_stock: false } as never)
      .in(
        "id",
        invalid.map((product) => product.id),
      );
    if (update.error) throw update.error;
  }

  const affectedStoreIds = [
    ...new Set(invalid.map((product) => product.store_id)),
  ];
  const storesHidden: string[] = [];
  for (const storeId of affectedStoreIds) {
    const remaining = await sb
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .eq("in_stock", true);
    if (remaining.error) throw remaining.error;
    if ((remaining.count ?? 0) === 0) {
      const hidden = await sb
        .from("stores")
        .update({ active: false } as never)
        .eq("id", storeId);
      if (hidden.error) throw hidden.error;
      storesHidden.push(storeById.get(storeId) ?? storeId);
    }
  }

  console.log(
    JSON.stringify({
      ok: true,
      products_hidden: invalid.length,
      stores_hidden: storesHidden,
    }),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
