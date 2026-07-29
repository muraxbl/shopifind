import {
  ShopifyUcpProductSchema,
  cleanShopifyText,
  exactShopifyImageUrl,
  exactShopifySourceUrl,
  parseCuratedShopifyLookup,
  type CuratedCatalogProduct,
} from "./shopifyUcp";

export const WOODENDOT_SOURCE_HOST = "woodendot.com";
export const WOODENDOT_IMAGE_PATH_PREFIX = "/s/files/1/0661/7029/0424/";
export const WOODENDOT_UCP_ENDPOINT =
  "https://woodendot.myshopify.com/api/ucp/mcp";

export const CURATED_WOODENDOT_PRODUCT_IDS = [
  "gid://shopify/Product/7941041717496", // Pelican wall shelf · medium oak
  "gid://shopify/Product/8720157901128", // Lua table lamp · medium oak
  "gid://shopify/Product/7941041127672", // Ka XL floor lamp · black
  "gid://shopify/Product/8909576503624", // Ibon M side table · walnut
  "gid://shopify/Product/7956158120184", // Alba Slim floating nightstand · oak oval
  "gid://shopify/Product/7941044175096", // Etna floor candle holders · blue
  "gid://shopify/Product/7941047025912", // Savia bench · dark wood
  "gid://shopify/Product/7941041389816", // Kesito desk organizer · blue, mustard and wood
  "gid://shopify/Product/9233779032392", // Cielo shelves and hooks · oak
  "gid://shopify/Product/8425365700936", // Sedona vase · medium white
  "gid://shopify/Product/7941057446136", // Cloe side table · oak and wood doors
  "gid://shopify/Product/7941042602232", // Batea L coffee table · oak and white
] as const;

const WOODENDOT_ECO_TAGS = [
  "certified",
  "circular",
  "eu-made",
  "long-lifespan",
] as const;

export type WoodendotProduct = CuratedCatalogProduct;

function deriveMaterials(description: string): string | null {
  const normalized = description.toLowerCase();
  const materials = [
    ["roble", "oak"],
    ["nogal", "walnut"],
    ["madera", "wood"],
    ["acero", "steel"],
    ["metal", "metal"],
    ["textil", "textile"],
  ]
    .filter(([term]) => normalized.includes(term))
    .map(([, label]) => label);
  return materials.length > 0 ? [...new Set(materials)].join(", ") : null;
}

export function buildWoodendotProduct(input: {
  payload: unknown;
  storeId: string;
  observedAt: string;
}): WoodendotProduct {
  const product = ShopifyUcpProductSchema.parse(input.payload);
  const featuredVariant = product.variants.find(
    (variant) => variant.availability.available,
  );
  if (!featuredVariant) {
    throw new Error(`Woodendot product is unavailable: ${product.handle}`);
  }
  const image = product.media.find((item) => item.type === "image");
  if (!image) throw new Error(`Woodendot image missing: ${product.handle}`);
  const description = cleanShopifyText(product.description.html, 700);
  if (!description) {
    throw new Error(`Woodendot description missing: ${product.handle}`);
  }
  const attributes: Record<string, string> = {
    merchant_product_id: product.id,
    merchant_variant_id: featuredVariant.id,
    provenance: "Íscar, España",
  };
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
  const materials = deriveMaterials(description);
  if (materials) attributes.materials = materials;

  return {
    store_id: input.storeId,
    slug: `woodendot-${product.handle}`,
    title: cleanShopifyText(product.title, 100),
    description,
    price_cents: product.price_range.min.amount,
    currency: "EUR",
    image_url: exactShopifyImageUrl({
      value: image.url,
      pathPrefix: WOODENDOT_IMAGE_PATH_PREFIX,
      merchant: "Woodendot",
    }),
    source_url: exactShopifySourceUrl({
      value: product.url,
      hostname: WOODENDOT_SOURCE_HOST,
      handle: product.handle,
      merchant: "Woodendot",
      pathPrefix: "/es/products",
    }),
    eco_tags: [...WOODENDOT_ECO_TAGS],
    attributes,
    in_stock: true,
    last_seen_at: input.observedAt,
  };
}

export function parseWoodendotLookup(
  payload: unknown,
  storeId: string,
  observedAt: string,
): WoodendotProduct[] {
  return parseCuratedShopifyLookup({
    payload,
    productIds: CURATED_WOODENDOT_PRODUCT_IDS,
    merchant: "Woodendot",
  }).map((product) =>
    buildWoodendotProduct({ payload: product, storeId, observedAt }),
  );
}
