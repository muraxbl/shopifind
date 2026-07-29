export const RAPANUI_PRODUCT_HOST = "rapanuiclothing.com";
export const RAPANUI_IMAGE_HOST = "images.podos.io";

export const CURATED_RAPANUI_HANDLES = [
  "organic-cotton-t-shirt",
  "womens-crew-neck-t-shirt",
  "reusable-shopping-bag",
  "renewable-energy-sweatshirt",
  "save-our-seas-sweatshirt",
  "womens-organic-cotton-sweatshirt",
  "mens-crew-neck-sweatshirt",
  "mens-organic-cotton-long-sleeve-t-shirt",
  "climate-change-sweatshirt",
  "mackerel-sweatshirt",
  "waves-sweatshirt",
  "surfers-against-sewage-t-shirt",
] as const;

type RapanuiOption = {
  colour?: string;
  sizes?: Record<string, { price?: number; salePrice?: number }>;
};

export type RapanuiProductPayload = {
  id?: number;
  name?: string;
  description?: string;
  specifications?: string;
  urlName?: string;
  baseSku?: string;
  price?: number;
  salePrice?: number;
  ecoIcons?: string[];
  tags?: Record<string, string> | string[];
  collection?: { title?: string; urlName?: string } | null;
  options?: Record<string, RapanuiOption>;
};

export type RapanuiStockPayload = Record<
  string,
  { sizes?: Record<string, number> }
>;

export type RapanuiMeta = {
  canonicalUrl: string;
  imageUrl: string;
  description: string;
};

export type RapanuiProduct = {
  store_id: string;
  slug: string;
  title: string;
  description: string;
  price_cents: number;
  currency: "GBP";
  image_url: string;
  source_url: string;
  eco_tags: string[];
  attributes: Record<string, string>;
  in_stock: boolean;
  last_seen_at: string;
};

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function cleanText(value: string | undefined, max: number): string {
  return decodeHtml(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function attribute(tag: string, name: string): string | null {
  const match = tag.match(
    new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"),
  );
  return match ? decodeHtml(match[1] ?? match[2] ?? "") : null;
}

function exactHttpsUrl(value: string, hostname: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== hostname) {
    throw new Error(`Unexpected URL host: ${url.hostname}`);
  }
  return url.toString();
}

export function parseRapanuiMeta(html: string): RapanuiMeta {
  let imageUrl = "";
  let description = "";
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const key = (attribute(tag, "property") ?? attribute(tag, "name") ?? "")
      .toLowerCase()
      .trim();
    if (key === "og:image") imageUrl = attribute(tag, "content") ?? "";
    if (key === "description") description = attribute(tag, "content") ?? "";
  }
  const canonicalTag = [...html.matchAll(/<link\b[^>]*>/gi)].find(
    (match) => attribute(match[0], "rel")?.toLowerCase() === "canonical",
  )?.[0];
  const canonicalUrl = canonicalTag
    ? (attribute(canonicalTag, "href") ?? "")
    : "";
  if (!canonicalUrl || !imageUrl) {
    throw new Error(
      "Rapanui page is missing canonical or origin image metadata.",
    );
  }
  return {
    canonicalUrl: exactHttpsUrl(canonicalUrl, RAPANUI_PRODUCT_HOST),
    imageUrl: exactHttpsUrl(imageUrl, RAPANUI_IMAGE_HOST),
    description: cleanText(description, 300),
  };
}

function validHandle(handle: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(handle) && handle.length <= 80;
}

function deriveEcoTags(payload: RapanuiProductPayload): string[] {
  const source = [
    ...(payload.ecoIcons ?? []),
    ...(Array.isArray(payload.tags)
      ? payload.tags
      : Object.values(payload.tags ?? {})),
    payload.description ?? "",
    payload.specifications ?? "",
  ]
    .join(" ")
    .toLowerCase();
  const tags = new Set<string>();
  if (/organic/.test(source)) tags.add("organic");
  if (/recycl|remanufactur|circular/.test(source)) tags.add("recycled");
  if (/circular/.test(source)) tags.add("circular");
  if (/low.?carbon|renewable energy/.test(source)) tags.add("low-impact");
  if (/ethical|social/.test(source)) tags.add("fair-trade");
  if (/plastic.?free/.test(source)) tags.add("plastic-free");
  if (/vegan|does not contain animal/.test(source)) tags.add("vegan");
  return [...tags].sort();
}

function hasStock(stock: RapanuiStockPayload): boolean {
  return Object.values(stock).some((option) =>
    Object.values(option.sizes ?? {}).some((quantity) => quantity > 0),
  );
}

export function buildRapanuiProduct(input: {
  handle: string;
  payload: RapanuiProductPayload;
  stock: RapanuiStockPayload;
  meta: RapanuiMeta;
  storeId: string;
  observedAt: string;
}): RapanuiProduct {
  const { handle, payload, stock, meta, storeId, observedAt } = input;
  if (!validHandle(handle) || payload.urlName !== handle) {
    throw new Error(`Rapanui handle mismatch: ${handle}`);
  }
  const name = cleanText(payload.name, 100);
  const regularPrice = Number(payload.price);
  const salePrice = Number(payload.salePrice);
  const price = salePrice > 0 ? salePrice : regularPrice;
  if (!name || !Number.isFinite(price) || price <= 0) {
    throw new Error(`Invalid Rapanui product: ${handle}`);
  }
  const expectedSource = `https://${RAPANUI_PRODUCT_HOST}/product/${handle}/`;
  if (meta.canonicalUrl !== expectedSource) {
    throw new Error(`Unexpected Rapanui canonical: ${meta.canonicalUrl}`);
  }

  const colors = Object.keys(payload.options ?? {});
  const description = cleanText(payload.description, 700) || meta.description;
  const attributes: Record<string, string> = {};
  if (payload.id) attributes.merchant_product_id = String(payload.id);
  if (payload.baseSku) attributes.sku = payload.baseSku;
  if (payload.collection?.title)
    attributes.collection = payload.collection.title;
  if (colors.length > 0) attributes.colours = colors.join(", ").slice(0, 300);
  const specifications = cleanText(payload.specifications, 500);
  if (specifications) attributes.specifications = specifications;

  return {
    store_id: storeId,
    slug: `rapanui-${handle}`,
    title: name,
    description,
    price_cents: Math.round(price * 100),
    currency: "GBP",
    image_url: meta.imageUrl,
    source_url: expectedSource,
    eco_tags: deriveEcoTags(payload),
    attributes,
    in_stock: hasStock(stock),
    last_seen_at: observedAt,
  };
}
