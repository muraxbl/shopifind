import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Supabase session refresh middleware.
 *
 * Runs on every non-static request. Centralises the JWT refresh cycle so
 * that Server Components / Route Handlers / Server Actions always read a
 * fresh, non-expired session from `cookies()` — without each one having to
 * deal with the `getAll` / `setAll` cookie adapter themselves.
 *
 * Why `getUser()` and not `getSession()`:
 *   - `getUser()` validates the JWT against the Supabase Auth server and
 *     transparently refreshes the access token if it is close to expiry.
 *   - `getSession()` only decodes the cookie locally and would never
 *     trigger a refresh, leading to the classic "user logged out after a
 *     long page" bug.
 *
 * IMPORTANT: keep the canonical order — createServerClient, then await
 * getUser(), then nothing in between (no redirects, no auth checks). Any
 * logic between those two calls can race with the refresh and produce the
 * "randomly logged out" symptom described in @supabase/ssr 0.5+ migration
 * notes.
 */
export async function middleware(request: NextRequest) {
  // Initialise the response we will return. We deliberately do NOT pass
  // `request` here yet; we'll re-construct it after the cookie adapter
  // exposes any pending updates so the downstream rendering sees them.
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        // Single-arg signature per @supabase/ssr 0.12.x SetAllCookies type:
        //   (cookies: { name: string; value: string; options: CookieOptions }[]
        //   ) => void
        setAll(cookiesToSet) {
          // 1. Mirror the cookies on the *request* so that downstream
          //    Server Components reading via `next/headers` see the same
          //    refreshed values the browser will receive.
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          // 2. Re-build the response so the request-mutation propagates.
          supabaseResponse = NextResponse.next({
            request,
          });
          // 3. Set the cookies on the *response* so the browser's cookie
          //    jar gets the refreshed tokens on its next read.
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Mandatory: this call validates the JWT, refreshes it if needed, and
  // triggers the setAll() flow above. MUST stay exactly here, with no
  // intervening code.
  try {
    await supabase.auth.getUser();
  } catch (err) {
    // Defensive: never let an auth-server outage crash UX. The visitor
    // simply navigates as anonymous; getUser() returns { user: null } on
    // invalid sessions rather than throwing in normal operation, so this
    // catch only fires on outright network errors. Surface a warning in
    // dev so the operator notices; stay silent in prod to avoid log noise.
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('[middleware] supabase.auth.getUser() threw; treating as unauthenticated', err);
    }
  }

  return supabaseResponse;
}

/**
 * Matcher — run on every request except static assets. The regex below
 * follows the canonical Supabase example: skip `_next/static`, `_next/image`,
 * `favicon.ico`, and common image extensions sitting under `/public`.
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
