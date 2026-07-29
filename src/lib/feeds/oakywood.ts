import { z } from "zod";

export const OAKYWOOD_SOURCE_HOST = "oakywood.shop";
export const OAKYWOOD_IMAGE_HOST = "cdn.shopify.com";
export const OAKYWOOD_IMAGE_PATH_PREFIX = "/s/files/1/2447/0423/";
export const OAKYWOOD_UCP_ENDPOINT =
  "https://oakywood.myshopify.com/api/ucp/mcp";
export const SHOPIFY_UCP_AGENT_PROFILE =
  "https://shopify.dev/ucp/agent-profiles/examples/2026-04-08/valid-with-capabilities.json";

export const CURATED_OAKYWOOD_PRODUCT_IDS = [
  "gid://shopify/Product/7552042008637", // Magnetic Cable Organizer
  "gid://shopify/Product/212185350172", // Laptop Dock
  "gid://shopify/Product/4874017669181", // Dual Laptop Dock
  "gid://shopify/Product/7349640888381", // Under-desk Cable Management Tray
  "gid://shopify/Product/6563494068285", // Felt Cable Ties
  "gid://shopify/Product/6616101257277", // Charging Pad (OakyBlocks)
  "gid://shopify/Product/779117133928", // Geometric Charging Pad
  "gid://shopify/Product/212185088028", // Laptop Stand
  "gid://shopify/Product/212182564892", // Headphones Stand
  "gid://shopify/Product/7847491338301", // Laptop Riser
] as const;

const MoneySchema = z.object({
  amount: z.number().int().positive(),
  currency: z.literal("EUR"),
});

const MediaSchema = z
  .object({
    type: z.literal("image"),
    url: z.string().url(),
    alt_text: z.string().optional(),
  })
  .passthrough();

const VariantSchema = z
  .object({
    id: z.string().regex(/^gid:\/\/shopify\/ProductVariant\/\d+$/),
    sku: z.string().optional(),
    title: z.string().optional(),
    price: MoneySchema,
    availability: z.object({ available: z.boolean() }),
    options: z
      .array(z.object({ name: z.string(), label: z.string() }))
      .default([]),
  })
  .passthrough();

const ProductSchema = z
  .object({
    id: z.string().regex(/^gid:\/\/shopify\/Product\/\d+$/),
    handle: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(80),
    title: z.string().min(1),
    description: z.object({ html: z.string().default("") }),
    price_range: z.object({ min: MoneySchema, max: MoneySchema }),
    media: z.array(MediaSchema).min(1),
    tags: z.array(z.string()).default([]),
    variants: z.array(VariantSchema).min(1),
    url: z.string().url(),
  })
  .passthrough();

export type OakywoodUcpProduct = z.infer<typeof ProductSchema>;

export type OakywoodProduct = {
  store_id: string;
  slug: string;
  title: string;
  description: string;
  price_cents: number;
  currency: "EUR";
  image_url: string;
  source_url: string;
  eco_tags: string[];
  attributes: Record<string, string>;
  in_stock: boolean;
  last_seen_at: string;
};

const LookupResponseSchema = z.object({
  result: z.object({
    structuredContent: z.object({
      products: z.array(ProductSchema),
    }),
  }),
});

function cleanText(value: string, max: number): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function exactSourceUrl(value: string, handle: string): string {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.hostname !== OAKYWOOD_SOURCE_HOST ||
    url.pathname !== `/products/${handle}` ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(`Unexpected Oakywood product URL: ${value}`);
  }
  return url.toString();
}

function exactImageUrl(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.hostname !== OAKYWOOD_IMAGE_HOST ||
    !url.pathname.startsWith(OAKYWOOD_IMAGE_PATH_PREFIX) ||
    url.username ||
    url.password
  ) {
    throw new Error(`Unexpected Oakywood image URL: ${value}`);
  }
  return url.toString();
}

function deriveEcoTags(product: OakywoodUcpProduct): string[] {
  const source = cleanText(
    `${product.description.html} ${product.tags.join(" ")}`,
    10_000,
  ).toLowerCase();
  const tags = new Set<string>();
  if (
    /durable|sturdy|solid construction|solid wood|100kg|220lbs/.test(source)
  ) {
    tags.add("long-lifespan");
  }
  if (/certified|oeko-tex/.test(source)) tags.add("certified");
  if (/\bcork\b/.test(source)) tags.add("low-impact");
  return [...tags].sort();
}

function deriveMaterials(description: string): string | null {
  const materials = [
    "solid wood",
    "oak",
    "walnut",
    "cork",
    "merino wool felt",
    "steel",
    "aluminum",
  ].filter((material) => description.toLowerCase().includes(material));
  return materials.length > 0 ? [...new Set(materials)].join(", ") : null;
}

export function buildOakywoodProduct(input: {
  payload: unknown;
  storeId: string;
  observedAt: string;
}): OakywoodProduct {
  const product = ProductSchema.parse(input.payload);
  const availableVariants = product.variants.filter(
    (variant) => variant.availability.available,
  );
  if (availableVariants.length === 0) {
    throw new Error(`Oakywood product is unavailable: ${product.handle}`);
  }
  const featuredVariant = availableVariants[0]!;
  const image = product.media.find((item) => item.type === "image");
  if (!image) throw new Error(`Oakywood image missing: ${product.handle}`);
  const description = cleanText(product.description.html, 700);
  if (!description) {
    throw new Error(`Oakywood description missing: ${product.handle}`);
  }
  const attributes: Record<string, string> = {
    merchant_product_id: product.id,
    merchant_variant_id: featuredVariant.id,
  };
  if (featuredVariant.sku) attributes.sku = featuredVariant.sku;
  if (featuredVariant.title) attributes.variant = featuredVariant.title;
  const materials = deriveMaterials(description);
  if (materials) attributes.materials = materials;

  return {
    store_id: input.storeId,
    slug: `oakywood-${product.handle}`,
    title: cleanText(product.title, 100),
    description,
    price_cents: product.price_range.min.amount,
    currency: "EUR",
    image_url: exactImageUrl(image.url),
    source_url: exactSourceUrl(product.url, product.handle),
    eco_tags: deriveEcoTags(product),
    attributes,
    in_stock: true,
    last_seen_at: input.observedAt,
  };
}

export function parseOakywoodLookup(
  payload: unknown,
  storeId: string,
  observedAt: string,
): OakywoodProduct[] {
  const parsed = LookupResponseSchema.parse(payload);
  const byId = new Map(
    parsed.result.structuredContent.products.map((product) => [
      product.id,
      product,
    ]),
  );
  const unexpected = [...byId.keys()].filter(
    (id) => !CURATED_OAKYWOOD_PRODUCT_IDS.includes(id as never),
  );
  if (
    unexpected.length > 0 ||
    byId.size !== CURATED_OAKYWOOD_PRODUCT_IDS.length
  ) {
    throw new Error(
      `Oakywood lookup mismatch: expected ${CURATED_OAKYWOOD_PRODUCT_IDS.length}, received ${byId.size}`,
    );
  }
  return CURATED_OAKYWOOD_PRODUCT_IDS.map((id) => {
    const product = byId.get(id);
    if (!product) throw new Error(`Oakywood product missing: ${id}`);
    return buildOakywoodProduct({ payload: product, storeId, observedAt });
  });
}
