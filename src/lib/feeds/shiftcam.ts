import {
  ShopifyUcpProductSchema,
  cleanShopifyText,
  exactShopifyImageUrl,
  exactShopifySourceUrl,
  parseCuratedShopifyLookup,
  type CuratedCatalogProduct,
} from "./shopifyUcp";

export const SHIFTCAM_SOURCE_HOST = "www.shiftcam.com";
export const SHIFTCAM_IMAGE_PATH_PREFIX = "/s/files/1/0600/4300/1915/";
export const SHIFTCAM_UCP_ENDPOINT =
  "https://neu3w1-x2.myshopify.com/api/ucp/mcp";

export const CURATED_SHIFTCAM_PRODUCT_IDS = [
  "gid://shopify/Product/7399899234363", // Travel Kit Pro
  "gid://shopify/Product/7387415969851", // Pocket Light
  "gid://shopify/Product/7384333123643", // SnapStand Max
  "gid://shopify/Product/7410824839227", // SnapGrip Pro
  "gid://shopify/Product/7374375518267", // Universal S.Mount
  "gid://shopify/Product/7606545383483", // p.10x Micro
  "gid://shopify/Product/7364296081467", // 1.33x Anamorphic
  "gid://shopify/Product/7493626101819", // WRKFLW LensCube
  "gid://shopify/Product/7384334270523", // SnapStand Mini
  "gid://shopify/Product/7588415209531", // V-Series 60mm Tele
] as const;

export type ShiftcamProduct = CuratedCatalogProduct;

export function buildShiftcamProduct(input: {
  payload: unknown;
  storeId: string;
  observedAt: string;
}): ShiftcamProduct {
  const product = ShopifyUcpProductSchema.parse(input.payload);
  const featuredVariant = product.variants.find(
    (variant) => variant.availability.available,
  );
  if (!featuredVariant) {
    throw new Error(`ShiftCam product is unavailable: ${product.handle}`);
  }
  const image = product.media.find((item) => item.type === "image");
  if (!image) throw new Error(`ShiftCam image missing: ${product.handle}`);
  const description = cleanShopifyText(product.description.html, 700);
  if (!description) {
    throw new Error(`ShiftCam description missing: ${product.handle}`);
  }
  const attributes: Record<string, string> = {
    merchant_product_id: product.id,
    merchant_variant_id: featuredVariant.id,
  };
  if (featuredVariant.sku) attributes.sku = featuredVariant.sku;
  if (featuredVariant.title) attributes.variant = featuredVariant.title;
  const optionSummary = featuredVariant.options
    .map((option) => `${option.name}: ${option.label}`)
    .join(", ");
  if (optionSummary) attributes.options = optionSummary.slice(0, 300);

  return {
    store_id: input.storeId,
    slug: `shiftcam-${product.handle}`,
    title: cleanShopifyText(product.title, 100).replace(/\*+$/, "").trim(),
    description,
    price_cents: product.price_range.min.amount,
    currency: "EUR",
    image_url: exactShopifyImageUrl({
      value: image.url,
      pathPrefix: SHIFTCAM_IMAGE_PATH_PREFIX,
      merchant: "ShiftCam",
    }),
    source_url: exactShopifySourceUrl({
      value: product.url,
      hostname: SHIFTCAM_SOURCE_HOST,
      handle: product.handle,
      merchant: "ShiftCam",
    }),
    eco_tags: [],
    attributes,
    in_stock: true,
    last_seen_at: input.observedAt,
  };
}

export function parseShiftcamLookup(
  payload: unknown,
  storeId: string,
  observedAt: string,
): ShiftcamProduct[] {
  return parseCuratedShopifyLookup({
    payload,
    productIds: CURATED_SHIFTCAM_PRODUCT_IDS,
    merchant: "ShiftCam",
  }).map((product) =>
    buildShiftcamProduct({ payload: product, storeId, observedAt }),
  );
}
