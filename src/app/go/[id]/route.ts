import { NextResponse, type NextRequest } from "next/server";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { resolveClickoutUrl } from "@/lib/skimlinks";
import { buildClickOutHistoryEvent } from "@/lib/analytics/history";
import { recordHistoryEvent } from "@/lib/analytics/record";

type GoProduct = {
  id: string;
  slug: string;
  source_url: string;
  affiliate_url: string | null;
};

/**
 * /go/[slug] click-out endpoint:
 *   1. Resolves the product by slug.
 *   2. Resolves a vendor-specific affiliate URL, optional aggregator, or source.
 *   3. Logs the click for analytics.
 *   4. Keeps attribution and outbound policy server-side.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sb = createPublicSupabaseClient({ revalidate: false });
  const res = await sb
    .from("v_products_with_store")
    .select("id, slug, source_url, affiliate_url")
    .eq("slug", id)
    .eq("in_stock", true)
    .maybeSingle();

  const product = res.data as GoProduct | null;
  if (!product) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  let targetUrl: string;
  try {
    targetUrl = resolveClickoutUrl({
      sourceUrl: product.source_url,
      affiliateUrl: product.affiliate_url,
      productSlug: product.slug,
    });
  } catch {
    targetUrl = product.source_url;
  }

  // Await the best-effort event so the serverless invocation cannot terminate
  // before the write has been handed to Supabase.
  await recordHistoryEvent(buildClickOutHistoryEvent(product.slug), {
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.redirect(targetUrl, {
    status: 302,
    headers: { "X-Robots-Tag": "noindex" },
  });
}
