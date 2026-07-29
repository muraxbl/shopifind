import {
  ShopifyUcpProductSchema,
  cleanShopifyText,
  exactShopifyImageUrl,
  exactShopifySourceUrl,
  parseCuratedShopifyLookup,
  type CuratedCatalogProduct,
} from "./shopifyUcp";

export const THINKING_MU_SOURCE_HOST = "thinkingmu.com";
export const THINKING_MU_IMAGE_PATH_PREFIX = "/s/files/1/0578/8001/8989/";
export const THINKING_MU_UCP_ENDPOINT =
  "https://thinkingmu.myshopify.com/api/ucp/mcp";

export const CURATED_THINKING_MU_PRODUCT_IDS = [
  "gid://shopify/Product/15336377680198", // Santos organic cotton sweater · men
  "gid://shopify/Product/14828249121094", // Tom organic cotton shirt · men
  "gid://shopify/Product/15336389312838", // Aaron organic cotton T-shirt · men
  "gid://shopify/Product/14828250202438", // Moero hemp trousers · men
  "gid://shopify/Product/8724967686470", // Gus organic cotton denim jacket · men
  "gid://shopify/Product/8100832674082", // Alex hemp/organic cotton shorts · men
  "gid://shopify/Product/15369498394950", // Lena hemp T-shirt · women
  "gid://shopify/Product/14828235718982", // Lenie organic cotton blouse · women
  "gid://shopify/Product/15336351793478", // Sunniva organic cotton dress · women
  "gid://shopify/Product/14828227690822", // Karina organic cotton trousers · women
  "gid://shopify/Product/15336346747206", // Maisie organic cotton jacket · women
  "gid://shopify/Product/15336346845510", // Jodie organic cotton sweatshirt · women
] as const;

export type ThinkingMuProduct = CuratedCatalogProduct;

type MaterialEvidence = {
  materials: string[];
  ecoTags: string[];
};

function deriveMaterialEvidence(source: string): MaterialEvidence {
  const normalized = source.toLowerCase();
  const materials = new Set<string>();
  const ecoTags = new Set<string>();

  if (/algod[oó]n org[aá]nico|organic cotton/.test(normalized)) {
    materials.add("organic cotton");
    ecoTags.add("cotton");
    ecoTags.add("low-water");
    ecoTags.add("organic");
  }
  if (/c[aá]ñamo|\bhemp\b/.test(normalized)) {
    materials.add("hemp");
    ecoTags.add("long-lifespan");
    ecoTags.add("low-impact");
    ecoTags.add("low-water");
  }
  if (/poli[eé]ster reciclado|recycled polyester/.test(normalized)) {
    materials.add("recycled polyester");
    ecoTags.add("recycled");
  }
  if (/\btencel\b/.test(normalized)) {
    materials.add("Tencel");
    ecoTags.add("tencel");
  }
  if (/\becovero\b/.test(normalized)) {
    materials.add("EcoVero");
    ecoTags.add("ecovero");
  }
  if (/\bseacell\b/.test(normalized)) materials.add("SeaCell");
  if (/\bgots\b/.test(normalized)) {
    ecoTags.add("certified");
    ecoTags.add("gots");
  }

  return {
    materials: [...materials],
    ecoTags: [...ecoTags].sort(),
  };
}

export function buildThinkingMuProduct(input: {
  payload: unknown;
  storeId: string;
  observedAt: string;
}): ThinkingMuProduct {
  const product = ShopifyUcpProductSchema.parse(input.payload);
  const featuredVariant = product.variants.find(
    (variant) => variant.availability.available,
  );
  if (!featuredVariant) {
    throw new Error(`Thinking MU product is unavailable: ${product.handle}`);
  }
  const image = product.media.find((item) => item.type === "image");
  if (!image) throw new Error(`Thinking MU image missing: ${product.handle}`);
  const description = cleanShopifyText(product.description.html, 700);
  if (!description) {
    throw new Error(`Thinking MU description missing: ${product.handle}`);
  }
  const evidence = deriveMaterialEvidence(
    `${description} ${product.tags.join(" ")}`,
  );
  if (evidence.materials.length === 0) {
    throw new Error(`Thinking MU material evidence missing: ${product.handle}`);
  }

  const attributes: Record<string, string> = {
    merchant_product_id: product.id,
    merchant_variant_id: featuredVariant.id,
    materials: evidence.materials.join(", "),
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

  return {
    store_id: input.storeId,
    slug: `thinkingmu-${product.handle}`,
    title: cleanShopifyText(product.title, 100),
    description,
    price_cents: featuredVariant.price.amount,
    currency: "EUR",
    image_url: exactShopifyImageUrl({
      value: image.url,
      pathPrefix: THINKING_MU_IMAGE_PATH_PREFIX,
      merchant: "Thinking MU",
    }),
    source_url: exactShopifySourceUrl({
      value: product.url,
      hostname: THINKING_MU_SOURCE_HOST,
      handle: product.handle,
      merchant: "Thinking MU",
    }),
    eco_tags: evidence.ecoTags,
    attributes,
    in_stock: true,
    last_seen_at: input.observedAt,
  };
}

export function parseThinkingMuLookup(
  payload: unknown,
  storeId: string,
  observedAt: string,
): ThinkingMuProduct[] {
  return parseCuratedShopifyLookup({
    payload,
    productIds: CURATED_THINKING_MU_PRODUCT_IDS,
    merchant: "Thinking MU",
  }).map((product) =>
    buildThinkingMuProduct({ payload: product, storeId, observedAt }),
  );
}
