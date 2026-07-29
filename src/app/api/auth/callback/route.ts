import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/redirect";

/**
 * OAuth callback — exchange provider `code` for session cookies and redirect.
 * Configure this URL in Supabase Dashboard as a redirect URI for OAuth providers.
 *
 * Handles OAuth providers (Google, GitHub) using PKCE. Email magic links use
 * `/auth/confirm` + `/api/auth/confirm` so they work across devices.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"), "/");

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL("/login?error=oauth_callback_failed", url.origin),
      );
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
