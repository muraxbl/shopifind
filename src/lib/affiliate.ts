export const CLICKOUT_PLACEMENTS = [
  "pdp",
  "compare",
  "collection",
  "search",
] as const;

export type ClickoutPlacement =
  | (typeof CLICKOUT_PLACEMENTS)[number]
  | "unknown";

export type ClickoutChannel = "merchant_affiliate" | "referral";

export function normalizeClickoutPlacement(
  value: string | null | undefined,
): ClickoutPlacement {
  return CLICKOUT_PLACEMENTS.includes(
    value as (typeof CLICKOUT_PLACEMENTS)[number],
  )
    ? (value as (typeof CLICKOUT_PLACEMENTS)[number])
    : "unknown";
}

function safeHttpsUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Give merchants stable attribution when a product does not yet use an
 * approved affiliate deep link. Merchant/network URLs are never mutated here
 * because signed links have program-specific rules.
 */
export function buildMerchantReferralUrl(input: {
  sourceUrl: string;
  productSlug: string;
  placement: ClickoutPlacement;
}): string {
  const sourceUrl = safeHttpsUrl(input.sourceUrl);
  if (!sourceUrl)
    throw new Error("Product source URL must be a safe HTTPS URL.");

  const url = new URL(sourceUrl);
  url.searchParams.set("utm_source", "shopifind");
  url.searchParams.set("utm_medium", "referral");
  url.searchParams.set("utm_campaign", "product_discovery");
  url.searchParams.set(
    "utm_content",
    input.placement === "unknown"
      ? input.productSlug
      : `${input.placement}-${input.productSlug}`,
  );
  return url.toString();
}

export type ResolvedClickoutTarget = {
  url: string;
  channel: ClickoutChannel;
  merchantHost: string;
  targetHost: string;
  utmApplied: boolean;
};

/** Approved product-level links win; otherwise use the canonical destination. */
export function resolveClickoutUrl(input: {
  sourceUrl: string;
  affiliateUrl: string | null;
  productSlug: string;
  placement?: ClickoutPlacement;
}): string {
  return resolveClickoutTarget(input).url;
}

export function resolveClickoutTarget(input: {
  sourceUrl: string;
  affiliateUrl: string | null;
  productSlug: string;
  placement?: ClickoutPlacement;
}): ResolvedClickoutTarget {
  const sourceUrl = safeHttpsUrl(input.sourceUrl);
  if (!sourceUrl)
    throw new Error("Product source URL must be a safe HTTPS URL.");

  const merchantHost = new URL(sourceUrl).hostname;
  const affiliateUrl = safeHttpsUrl(input.affiliateUrl);
  if (affiliateUrl) {
    return {
      url: affiliateUrl,
      channel: "merchant_affiliate",
      merchantHost,
      targetHost: new URL(affiliateUrl).hostname,
      utmApplied: false,
    };
  }

  return {
    url: buildMerchantReferralUrl({
      sourceUrl,
      productSlug: input.productSlug,
      placement: input.placement ?? "unknown",
    }),
    channel: "referral",
    merchantHost,
    targetHost: merchantHost,
    utmApplied: true,
  };
}
