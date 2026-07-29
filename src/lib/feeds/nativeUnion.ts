import {
  ShopifyUcpProductSchema,
  cleanShopifyText,
  exactShopifyImageUrl,
  exactShopifySourceUrl,
  parseCuratedShopifyLookup,
  type CuratedCatalogProduct,
} from "./shopifyUcp";

export const NATIVE_UNION_SOURCE_HOST = "www.nativeunion.com";
export const NATIVE_UNION_IMAGE_PATH_PREFIX = "/s/files/1/0066/9050/4822/";
export const NATIVE_UNION_UCP_ENDPOINT =
  "https://native-union.myshopify.com/api/ucp/mcp";

export const CURATED_NATIVE_UNION_PRODUCT_IDS = [
  "gid://shopify/Product/7885568802955", // (Re)Classic Case · iPhone 17
  "gid://shopify/Product/7837899128971", // (Re)Classic Case · AirPods 4
  "gid://shopify/Product/7880445886603", // Belt Cable 2-in-1 · 140W
  "gid://shopify/Product/7476937425035", // Pocket Cable · 60W
  "gid://shopify/Product/7154726568075", // Fast Desktop Charger · 140W
  "gid://shopify/Product/7373423607947", // (Re)Classic magnetic power bank · 5000mAh
  "gid://shopify/Product/7029241970827", // Fold Laptop Stand
  "gid://shopify/Product/7284483981451", // Desk Mat
  "gid://shopify/Product/7173021794443", // W.F.A recycled-PET backpack
  "gid://shopify/Product/5024239550603", // Stow Organizer
] as const;

export type NativeUnionProduct = CuratedCatalogProduct;

function deriveMaterials(source: string): string[] {
  const normalized = source.toLowerCase();
  const materials = new Set<string>();
  if (
    /recycled (?:pet|polyester|polyethylene terephthalate)|\brpet\b/.test(
      normalized,
    )
  ) {
    materials.add("recycled PET");
  }
  if (/recycled (?:pc|polycarbonate)/.test(normalized)) {
    materials.add("recycled polycarbonate");
  }
  if (/recycled tpu/.test(normalized)) materials.add("recycled TPU");
  if (/animal-free leather/.test(normalized)) {
    materials.add("animal-free leather alternative");
  }
  if (/\balumin(?:um|ium)\b/.test(normalized)) materials.add("aluminum");
  if (/aramid fiber|kevlar/.test(normalized)) materials.add("aramid fiber");
  return [...materials];
}

function deriveEcoTags(source: string): string[] {
  const normalized = source.toLowerCase();
  const tags = new Set<string>();
  if (/\brecycled\b|\brpet\b/.test(normalized)) tags.add("recycled");
  if (/animal-free leather/.test(normalized)) tags.add("vegan-leather");
  if (
    /\bdurable\b|long-lasting|built to last|reinforced|lifetime limited warranty/.test(
      normalized,
    )
  ) {
    tags.add("long-lifespan");
  }
  if (/low impact|lighter footprint/.test(normalized)) tags.add("low-impact");
  if (/100% recyclable|fully recyclable/.test(normalized)) {
    tags.add("recyclable");
  }
  return [...tags].sort();
}

function deriveTechnicalAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const power = source.match(/\b(\d{1,3})\s?W\b/i)?.[1];
  if (power) attributes.power = `${power}W`;
  const capacity = source.match(/\b(\d{4,5})\s?mAh\b/i)?.[1];
  if (capacity) attributes.capacity = `${capacity} mAh`;
  const warranty = source.match(
    /\b(Lifetime Limited Warranty|\d+-Year Limited Warranty)\b/i,
  )?.[1];
  if (warranty) attributes.warranty = warranty;
  return attributes;
}

export function buildNativeUnionProduct(input: {
  payload: unknown;
  storeId: string;
  observedAt: string;
}): NativeUnionProduct {
  const product = ShopifyUcpProductSchema.parse(input.payload);
  const featuredVariant = product.variants.find(
    (variant) => variant.availability.available,
  );
  if (!featuredVariant) {
    throw new Error(`Native Union product is unavailable: ${product.handle}`);
  }
  const image = product.media.find((item) => item.type === "image");
  if (!image) throw new Error(`Native Union image missing: ${product.handle}`);
  const description = cleanShopifyText(product.description.html, 700);
  if (!description) {
    throw new Error(`Native Union description missing: ${product.handle}`);
  }
  // Keep the public description compact, but evaluate the complete merchant
  // copy so a material or warranty near the end is not silently discarded.
  const evidence = cleanShopifyText(
    `${product.description.html} ${product.tags.join(" ")}`,
    10_000,
  );
  const materials = deriveMaterials(evidence);
  const attributes: Record<string, string> = {
    merchant_product_id: product.id,
    merchant_variant_id: featuredVariant.id,
    ...deriveTechnicalAttributes(evidence),
  };
  if (materials.length > 0) attributes.materials = materials.join(", ");
  if (featuredVariant.sku) attributes.sku = featuredVariant.sku;
  if (
    featuredVariant.title &&
    featuredVariant.title.toLowerCase() !== "default title"
  ) {
    attributes.variant = featuredVariant.title;
  }
  const optionSummary = featuredVariant.options
    .filter((option) => option.label.toLowerCase() !== "default title")
    .map((option) => `${option.name}: ${option.label}`)
    .join(", ");
  if (optionSummary) attributes.options = optionSummary.slice(0, 300);

  return {
    store_id: input.storeId,
    slug: `nativeunion-${product.handle}`,
    title: cleanShopifyText(product.title, 100),
    description,
    price_cents: featuredVariant.price.amount,
    currency: "EUR",
    image_url: exactShopifyImageUrl({
      value: image.url,
      pathPrefix: NATIVE_UNION_IMAGE_PATH_PREFIX,
      merchant: "Native Union",
    }),
    source_url: exactShopifySourceUrl({
      value: product.url,
      hostname: NATIVE_UNION_SOURCE_HOST,
      handle: product.handle,
      merchant: "Native Union",
    }),
    eco_tags: deriveEcoTags(evidence),
    attributes,
    in_stock: true,
    last_seen_at: input.observedAt,
  };
}

export function parseNativeUnionLookup(
  payload: unknown,
  storeId: string,
  observedAt: string,
): NativeUnionProduct[] {
  return parseCuratedShopifyLookup({
    payload,
    productIds: CURATED_NATIVE_UNION_PRODUCT_IDS,
    merchant: "Native Union",
  }).map((product) =>
    buildNativeUnionProduct({ payload: product, storeId, observedAt }),
  );
}
