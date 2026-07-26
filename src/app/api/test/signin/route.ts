import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isTestEndpointEnabled } from '@/lib/env';

/**
 * TEST-ONLY endpoint. Creates a fresh fixture user via the service_role
 * admin client (so it bypasses email confirmation) and immediately signs
 * them in using the server-side Supabase client. The middleware in
 * `src/middleware.ts` runs on this route, so the `setAll` callback in the
 * cookie adapter sets the refreshed auth tokens on the response — which
 * the smoke test can save to a cookie jar and replay against other routes.
 *
 * Security: in production this route would not exist. It is harmless
 * because:
 *  - random email + per-call password makes the fixture idempotent within
 *    a single smoke run,
 *  - the admin client itself is gated on SUPABASE_SERVICE_ROLE_KEY which
 *    is never exposed to the browser,
 *  - no real users can authenticate against `/api/test/*` without knowing
 *    the fixture credentials (which are discarded after the run).
 */
export const dynamic = 'force-dynamic';

/**
 * Production safety gate (see src/lib/env.ts): the endpoint returns 404
 * unless NODE_ENV !== 'production' AND ALLOW_TEST_ENDPOINTS=true.
 * 404 (not 403) avoids advertising the route to scanners.
 */
export async function POST() {
  if (!isTestEndpointEnabled()) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  const stamp = Date.now();
  // TLD must be real-looking (RFC-reserved `.test`/`.invalid`/`.example`
  // are rejected by current Supabase Auth email validation, which used to
  // accept them prior to 2024 — see note above).
  const email = `fixture-${stamp}@dropifind.dev`;
  const password = `TestPass-${stamp}-${Math.random().toString(36).slice(2, 10)}`;

  const admin = createAdminSupabaseClient();
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    // Dev-only dx: operators running smoke/debug logs see the real reason
    // without having to grep the HTTP body. Production stays silent.
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('[test/signin] admin.createUser failed:', {
        email,
        code: created.error?.code,
        status: created.error?.status,
        message: created.error?.message,
      });
    }
    return NextResponse.json(
      { ok: false, error: 'fixture_create_failed', detail: created.error?.message ?? 'no user', code: created.error?.code ?? null },
      { status: 500 },
    );
  }

  const sb = createServerSupabaseClient();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    return NextResponse.json(
      { ok: false, error: 'signin_failed', detail: error?.message ?? 'no session' },
      { status: 401 },
    );
  }

  return NextResponse.json({
    ok: true,
    user: { id: data.user.id, email: data.user.email },
    expires_at: data.session.expires_at,
    expires_in: data.session.expires_in,
  });
}
