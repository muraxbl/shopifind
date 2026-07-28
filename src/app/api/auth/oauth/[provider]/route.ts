import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeNextPath } from '@/lib/auth/redirect';

// Keep this synchronized with what the login page advertises.
const VALID_PROVIDERS = new Set(['google', 'github', 'apple', 'twitter', 'facebook', 'azure', 'bitbucket', 'gitlab', 'linkedin']);

/**
 * Initiate an OAuth sign-in flow: returns a 302 to the upstream provider's
 * consent URL. Supabase then redirects back to the configured
 * `redirectTo` URL (which we set to /api/auth/callback) carrying ?code=.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  if (!VALID_PROVIDERS.has(provider)) {
    return NextResponse.redirect(new URL('/login?error=invalid_provider', request.url));
  }

  const supabase = await createServerSupabaseClient();
  const next = safeNextPath(request.nextUrl.searchParams.get('next'), '/');
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;
  const redirectTo = `${baseUrl}/api/auth/callback?next=${encodeURIComponent(next)}`;

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider as 'google',
      options: { redirectTo },
    });
    if (error || !data?.url) {
      const reason = encodeURIComponent(error?.message ?? 'oauth_init_failed');
      return NextResponse.redirect(new URL(`/login?error=${reason}`, request.url));
    }
    return NextResponse.redirect(data.url);
  } catch (e) {
    const reason = encodeURIComponent(e instanceof Error ? e.message : 'oauth_exception');
    return NextResponse.redirect(new URL(`/login?error=${reason}`, request.url));
  }
}
