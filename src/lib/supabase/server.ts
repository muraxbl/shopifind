import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/database.types';

/**
 * Server-side Supabase client used inside Server Components, Route Handlers
 * and Server Actions (one instance per request — never share across requests).
 *
 * Cookie adapter uses the modern `getAll` / `setAll` API required by
 * `@supabase/ssr` >= 0.5 (we are on 0.12.3). The package's `SetAllCookies`
 * type is single-arg `(cookies) => void`; the response-header propagation
 * is handled centrally by `src/middleware.ts`, which runs before this
 * adapter is constructed and refreshes the JWT if needed.
 *
 * In Server Components the `cookies()` store is read-only, so writes
 * throw — that is expected and silently swallowed here because the
 * upstream middleware has already updated the response cookies with any
 * refreshed tokens. In Server Actions and Route Handlers `cookies()`
 * is writable and writes propagate to the response automatically.
 */
export function createServerSupabaseClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(items) {
          try {
            for (const { name, value, options } of items) {
              cookieStore.set({ name, value, ...options });
            }
          } catch {
            // Called from a Server Component where `cookies()` is read-only.
            // Middleware (src/middleware.ts) refreshes the session before
            // the component renders, so it is safe to ignore the write —
            // the next request will carry the refreshed cookies.
          }
        },
      },
    },
  );
}
