import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

type NextFetchRequestInit = RequestInit & {
  next?: {
    revalidate?: number | false;
    tags?: string[];
  };
};

export type PublicSupabaseOptions = {
  /** Shared Next Data Cache TTL. Use false for request-time search/redirects. */
  revalidate?: number | false;
};

export function buildPublicFetchInit(
  init: NextFetchRequestInit | undefined,
  revalidate: number | false,
): NextFetchRequestInit {
  const { cache: _cache, next: existingNext, ...rest } = init ?? {};
  if (revalidate === false) {
    return { ...rest, cache: 'no-store' };
  }
  return {
    ...rest,
    next: {
      ...existingNext,
      revalidate,
    },
  };
}

/**
 * Stateless anon client for catalog data that never needs a user session.
 * Keeping cookies out of these reads lets public pages use ISR/CDN caching.
 */
export function createPublicSupabaseClient(
  options: PublicSupabaseOptions = {},
) {
  const revalidate = options.revalidate ?? 60;
  const cachedFetch: typeof fetch = (input, init) =>
    fetch(
      input,
      buildPublicFetchInit(init as NextFetchRequestInit | undefined, revalidate),
    );

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
      global: { fetch: cachedFetch },
    },
  );
}
