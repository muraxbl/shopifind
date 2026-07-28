import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isTestEndpointEnabled } from '@/lib/env';

/**
 * TEST-ONLY endpoint. Returns the current authenticated user as resolved
 * by the server-side Supabase client. Also enumerates the inbound auth
 * cookies (just their names, never the values) so the smoke test can
 * confirm that `middleware` is forwarding session cookies to the
 * downstream Server Component.
 *
 * On an invalid or expired cookie, `getUser()` will return
 * `{ user: null }` (or trigger a refresh — depending on whether the
 * refresh_token is still valid). Either path is "no crash" which is the
 * whole point of the middleware contract.
 */
export const dynamic = 'force-dynamic';

/**
 * Production safety gate (see src/lib/env.ts). whoami would otherwise be
 * a fingerprinting vector (reports whether a session cookie is present).
 */
export async function GET() {
  if (!isTestEndpointEnabled()) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  const sb = await createServerSupabaseClient();
  const { data: userData, error: userErr } = await sb.auth.getUser();
  // getSession() returns { data: { session }, error }; destructure the
  // wrapper so we read Session fields off the inner record.
  const { data: sessData } = await sb.auth.getSession();

  return NextResponse.json({
    ok: !userErr,
    error: userErr?.message ?? null,
    user: userData.user
      ? { id: userData.user.id, email: userData.user.email }
      : null,
    session_present: !!sessData.session,
    session_expires_at: sessData.session?.expires_at ?? null,
  });
}
