import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isProtectedPath } from '@/lib/auth/redirect';

const PROTECTED_PATHS = ['/wishlist', '/account', '/settings'];

/**
 * Refresh Supabase Auth sessions and protect account-specific routes.
 * This file lives in src/ because the application itself uses src/app.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
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
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  let user = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[middleware] auth refresh failed; continuing as anonymous', error);
    }
  }

  const pathname = request.nextUrl.pathname;
  const isProtected = isProtectedPath(pathname, PROTECTED_PATHS);

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    const redirectResponse = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|go(?:/|$)|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
