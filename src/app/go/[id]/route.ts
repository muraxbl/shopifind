import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { buildSkimlinksUrl } from '@/lib/skimlinks';

type GoProduct = { id: string; slug: string; source_url: string; affiliate_url: string | null };

/**
 * /go/[slug] click-out endpoint:
 *   1. Resolves the product by slug.
 *   2. Builds the Skimlinks affiliate URL (server-side 302).
 *   3. Logs the click for analytics.
 *   4. Bypasses basic ad-blockers that strip Skimlinks from the DOM.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const sb = createServerSupabaseClient();
  const res = await sb
    .from('products')
    .select('id, slug, source_url, affiliate_url')
    .eq('slug', params.id)
    .maybeSingle();

  const product = res.data as GoProduct | null;
  if (!product) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  let targetUrl: string;
  try {
    if (process.env.SKIMLINKS_DOMAIN_ID) {
      targetUrl = buildSkimlinksUrl(product.source_url, product.slug);
    } else if (product.affiliate_url) {
      targetUrl = product.affiliate_url;
    } else {
      targetUrl = product.source_url;
    }
  } catch {
    targetUrl = product.source_url;
  }

  // Best-effort click tracking (fire-and-forget).
  void sb
    .from('search_history')
    .insert({ query: `[click-out] /product/${product.slug}`, results_count: 1 } as never)
    .then(({ error }) => {
      if (error) console.warn('[click-out] history insert skipped:', error.message);
    });

  return NextResponse.redirect(targetUrl, {
    status: 302,
    headers: { 'X-Robots-Tag': 'noindex' },
  });
}
