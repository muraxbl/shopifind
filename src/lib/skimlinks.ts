/**
 * Build a Skimlinks affiliate link from a raw product URL.
 * Docs: https://developers.skimlinks.com/links-api/
 *
 * NOTE: We always resolve the click server-side via /go/[slug] so that:
 *   1. Ad-blockers don't strip Skimlinks refs from the client.
 *   2. We can attribute clicks to our analytics (search_history).
 *   3. The merchant URL never leaks until server-side 302.
 */
export function buildSkimlinksUrl(sourceUrl: string, productSlug: string): string {
  const domainId = process.env.SKIMLINKS_DOMAIN_ID;
  if (!domainId) {
    throw new Error('SKIMLINKS_DOMAIN_ID is not configured.');
  }

  // Skimlinks JS-less links API:
  //   https://go.redirectingat.com/?id={domainId}&url={sourceUrl}&xcust={custom}
  const params = new URLSearchParams({
    id: domainId,
    url: sourceUrl,
    xcust: `shopifind-${productSlug}`,
  });

  return `https://go.redirectingat.com/?${params.toString()}`;
}
