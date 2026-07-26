import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * OAuth callback — exchange provider `code` for session cookies and redirect.
 * Configure this URL in Supabase Dashboard as a redirect URI for OAuth providers.
 *
 * Handles both OAuth (Google, GitHub) and Magic Link (?code=).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/';

  if (code) {
    const supabase = createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin)
      );
    }
  }

  return NextResponse.redirect(new URL(next.startsWith('/') ? next : '/', url.origin));
}
