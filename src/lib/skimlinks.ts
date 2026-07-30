/**
 * Build a Skimlinks affiliate link from a raw product URL.
 * Docs: https://developers.skimlinks.com/links-api/
 *
 * NOTE: We always resolve the click server-side via /go/[slug] so that:
 *   1. Ad-blockers don't strip Skimlinks refs from the client.
 *   2. We can attribute clicks to our analytics (search_history).
 *   3. The merchant URL never leaks until server-side 302.
 */
export function buildSkimlinksUrl(
  sourceUrl: string,
  productSlug: string,
): string {
  if (!isSkimlinksEnabled()) {
    throw new Error("Skimlinks is not explicitly enabled.");
  }
  const domainId = process.env.SKIMLINKS_DOMAIN_ID!.trim();

  // Skimlinks JS-less links API:
  //   https://go.redirectingat.com/?id={domainId}&url={sourceUrl}&xcust={custom}
  const params = new URLSearchParams({
    id: domainId,
    url: sourceUrl,
    xcust: `shopifind-${productSlug}`,
  });

  return `https://go.redirectingat.com/?${params.toString()}`;
}

/**
 * Skimlinks is an optional fallback, never an implicit consequence of leaving
 * an old publisher ID in an environment. A denied or paused account therefore
 * stops receiving traffic unless an operator deliberately enables it again.
 */
export function isSkimlinksEnabled(): boolean {
  return (
    process.env.SKIMLINKS_ENABLED === "true" &&
    Boolean(process.env.SKIMLINKS_DOMAIN_ID?.trim())
  );
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
 * Revenue routing order:
 *   1. merchant/network-specific product URL;
 *   2. explicitly enabled aggregator fallback;
 *   3. canonical merchant URL.
 *
 * This lets Shopifind combine direct programs, Awin/Impact/other networks and
 * a future aggregator without one integration stealing another's attribution.
 */
export function resolveClickoutUrl(input: {
  sourceUrl: string;
  affiliateUrl: string | null;
  productSlug: string;
}): string {
  const sourceUrl = safeHttpsUrl(input.sourceUrl);
  if (!sourceUrl)
    throw new Error("Product source URL must be a safe HTTPS URL.");

  const directAffiliateUrl = safeHttpsUrl(input.affiliateUrl);
  if (directAffiliateUrl) return directAffiliateUrl;
  if (isSkimlinksEnabled()) {
    return buildSkimlinksUrl(sourceUrl, input.productSlug);
  }
  return sourceUrl;
}
