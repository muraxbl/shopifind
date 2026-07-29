import { z } from "zod";

export const SHOPIFY_UCP_AGENT_PROFILE =
  "https://shopify.dev/ucp/agent-profiles/examples/2026-04-08/valid-with-capabilities.json";
export const SHOPIFY_IMAGE_HOST = "cdn.shopify.com";

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

export const ShopifyUcpProductSchema = z
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

export type ShopifyUcpProduct = z.infer<typeof ShopifyUcpProductSchema>;

export type CuratedCatalogProduct = {
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
      products: z.array(ShopifyUcpProductSchema),
    }),
  }),
});

export function cleanShopifyText(value: string, max: number): string {
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

export function exactShopifySourceUrl(input: {
  value: string;
  hostname: string;
  handle: string;
  merchant: string;
}): string {
  const url = new URL(input.value);
  if (
    url.protocol !== "https:" ||
    url.hostname !== input.hostname ||
    url.pathname !== `/products/${input.handle}` ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(`Unexpected ${input.merchant} product URL: ${input.value}`);
  }
  return url.toString();
}

export function exactShopifyImageUrl(input: {
  value: string;
  pathPrefix: string;
  merchant: string;
}): string {
  const url = new URL(input.value);
  if (
    url.protocol !== "https:" ||
    url.hostname !== SHOPIFY_IMAGE_HOST ||
    !url.pathname.startsWith(input.pathPrefix) ||
    url.username ||
    url.password
  ) {
    throw new Error(`Unexpected ${input.merchant} image URL: ${input.value}`);
  }
  return url.toString();
}

export function parseCuratedShopifyLookup(input: {
  payload: unknown;
  productIds: readonly string[];
  merchant: string;
}): ShopifyUcpProduct[] {
  const parsed = LookupResponseSchema.parse(input.payload);
  const byId = new Map(
    parsed.result.structuredContent.products.map((product) => [
      product.id,
      product,
    ]),
  );
  const expected = new Set(input.productIds);
  const unexpected = [...byId.keys()].filter((id) => !expected.has(id));
  if (unexpected.length > 0 || byId.size !== input.productIds.length) {
    throw new Error(
      `${input.merchant} lookup mismatch: expected ${input.productIds.length}, received ${byId.size}`,
    );
  }
  return input.productIds.map((id) => {
    const product = byId.get(id);
    if (!product) throw new Error(`${input.merchant} product missing: ${id}`);
    return product;
  });
}
