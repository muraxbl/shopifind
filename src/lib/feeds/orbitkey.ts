import {
  ShopifyUcpProductSchema,
  cleanShopifyText,
  exactShopifyImageUrl,
  exactShopifySourceUrl,
  parseCuratedShopifyLookup,
  type CuratedCatalogProduct,
} from "./shopifyUcp";

export const ORBITKEY_SOURCE_HOST = "www.orbitkey.eu";
export const ORBITKEY_IMAGE_PATH_PREFIX = "/s/files/1/2161/4233/";
export const ORBITKEY_UCP_ENDPOINT =
  "https://orbitkey-europe.myshopify.com/api/ucp/mcp";

export const CURATED_ORBITKEY_PRODUCT_IDS = [
  "gid://shopify/Product/6666632233056", // Key Organiser · BCI waxed canvas
  "gid://shopify/Product/4741835751520", // Key Organiser · cactus leather alternative
  "gid://shopify/Product/7157959983200", // Nest v2 desk organiser and charger
  "gid://shopify/Product/6738233327712", // Foldable recycled-polyester tote
  "gid://shopify/Product/7122460344416", // 2-in-1 recycled-material tech pouch
  "gid://shopify/Product/7513515524192", // Essentials pouch trio
  "gid://shopify/Product/7277883916384", // Leather-free compendium
  "gid://shopify/Product/7744625016928", // Hybrid laptop sleeve v2
  "gid://shopify/Product/6628226596960", // Chipolo tracker with replaceable battery
  "gid://shopify/Product/4745413427296", // Desk mat with recycled PET felt
] as const;

export type OrbitkeyProduct = CuratedCatalogProduct;

function deriveMaterials(source: string): string[] {
  const normalized = source.toLowerCase();
  const materials = new Set<string>();
  if (/bci (?:cotton|algod[oó]n)|algod[oó]n bci/.test(normalized)) {
    materials.add("BCI cotton");
  }
  if (/cactus leather|cuero de cactus|desserto/.test(normalized)) {
    materials.add("cactus-based leather alternative");
  }
  if (
    /cyclepet|recycled pet|pet (?:100% )?reciclado|fieltro pet/.test(normalized)
  ) {
    materials.add("recycled PET");
  }
  if (
    /recycled polyester|polyester 100% recycled|poli[eé]ster (?:100% )?reciclado/.test(
      normalized,
    )
  ) {
    materials.add("recycled polyester");
  }
  if (/recycled (?:woven )?fabric|(?:tela|tejido) reciclado/.test(normalized)) {
    materials.add("recycled fabric");
  }
  if (/vegan leather|cuero vegano/.test(normalized)) {
    materials.add("vegan leather alternative");
  }
  return [...materials];
}

function deriveEcoTags(source: string): string[] {
  const normalized = source.toLowerCase();
  const tags = new Set<string>();
  if (/\brecycled\b|\breciclad[oa]s?\b|cyclepet/.test(normalized)) {
    tags.add("recycled");
  }
  if (
    /vegan leather|cuero vegano|cactus leather|cuero de cactus|desserto/.test(
      normalized,
    )
  ) {
    tags.add("vegan-leather");
  }
  if (/grs[- ]certified|certificad[oa] grs/.test(normalized)) {
    tags.add("certified");
  }
  if (
    /\bdurable\b|duradero|resistente al agua|water-resistant/.test(normalized)
  ) {
    tags.add("long-lifespan");
  }
  return [...tags].sort();
}

function deriveTechnicalAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const warranty = source.match(
    /\b(2[- ]year(?: limited)? warranty|garant[ií]a(?: limitada)? de (?:dos|2) a[nñ]os|24-month manufacturing warranty)\b/i,
  )?.[1];
  if (warranty) attributes.warranty = warranty;
  const battery = source.match(/\b(CR\d{4})\b/i)?.[1];
  if (battery) attributes.battery = battery.toUpperCase();
  return attributes;
}

export function buildOrbitkeyProduct(input: {
  payload: unknown;
  storeId: string;
  observedAt: string;
}): OrbitkeyProduct {
  const product = ShopifyUcpProductSchema.parse(input.payload);
  const featuredVariant = product.variants.find(
    (variant) => variant.availability.available,
  );
  if (!featuredVariant) {
    throw new Error(`Orbitkey product is unavailable: ${product.handle}`);
  }
  const image = product.media.find((item) => item.type === "image");
  if (!image) throw new Error(`Orbitkey image missing: ${product.handle}`);
  const description = cleanShopifyText(product.description.html, 700);
  if (!description) {
    throw new Error(`Orbitkey description missing: ${product.handle}`);
  }
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
    slug: `orbitkey-${product.handle}`,
    title: cleanShopifyText(product.title, 100),
    description,
    price_cents: featuredVariant.price.amount,
    currency: "EUR",
    image_url: exactShopifyImageUrl({
      value: image.url,
      pathPrefix: ORBITKEY_IMAGE_PATH_PREFIX,
      merchant: "Orbitkey",
    }),
    source_url: exactShopifySourceUrl({
      value: product.url,
      hostname: ORBITKEY_SOURCE_HOST,
      handle: product.handle,
      merchant: "Orbitkey",
      pathPrefix: "/es/products",
    }),
    eco_tags: deriveEcoTags(evidence),
    attributes,
    in_stock: true,
    last_seen_at: input.observedAt,
  };
}

export function parseOrbitkeyLookup(
  payload: unknown,
  storeId: string,
  observedAt: string,
): OrbitkeyProduct[] {
  return parseCuratedShopifyLookup({
    payload,
    productIds: CURATED_ORBITKEY_PRODUCT_IDS,
    merchant: "Orbitkey",
  }).map((product) =>
    buildOrbitkeyProduct({ payload: product, storeId, observedAt }),
  );
}
