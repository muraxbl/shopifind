import { NextResponse, type NextRequest } from "next/server";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import {
  normalizeClickoutPlacement,
  resolveClickoutTarget,
} from "@/lib/affiliate";
import { buildClickOutHistoryEvent } from "@/lib/analytics/history";
import { recordHistoryEvent } from "@/lib/analytics/record";

type GoProduct = {
  id: string;
  slug: string;
  source_url: string;
  affiliate_url: string | null;
  store_slug: string | null;
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
    .select("id, slug, source_url, affiliate_url, store_slug")
    .eq("slug", id)
    .eq("in_stock", true)
    .maybeSingle();

  const product = res.data as GoProduct | null;
  if (!product) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const placement = normalizeClickoutPlacement(
    request.nextUrl.searchParams.get("placement"),
  );

  let target;
  try {
    target = resolveClickoutTarget({
      sourceUrl: product.source_url,
      affiliateUrl: product.affiliate_url,
      productSlug: product.slug,
      placement,
    });
  } catch {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Await the best-effort event so the serverless invocation cannot terminate
  // before the write has been handed to Supabase.
  await recordHistoryEvent(
    buildClickOutHistoryEvent({
      productId: product.id,
      productSlug: product.slug,
      storeSlug: product.store_slug,
      placement,
      channel: target.channel,
      merchantHost: target.merchantHost,
      targetHost: target.targetHost,
      utmApplied: target.utmApplied,
    }),
    { userAgent: request.headers.get("user-agent") },
  );

  return NextResponse.redirect(target.url, {
    status: 302,
    headers: { "X-Robots-Tag": "noindex" },
  });
}
