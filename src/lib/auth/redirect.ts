// Parsing sentinel only. Redirect destinations always use the request's real
// origin; this URL is never emitted or used as deployment configuration.
const PATH_VALIDATION_ORIGIN = 'https://invalid.example';

/** Accept only same-origin application paths for post-auth redirects. */
export function safeNextPath(value: string | null | undefined, fallback = '/'): string {
  const candidate = value?.trim();
  if (!candidate) return fallback;

  let decoded = candidate;
  try {
    for (let i = 0; i < 2; i++) {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
  } catch {
    return fallback;
  }

  if (
    !decoded.startsWith('/') ||
    decoded.startsWith('//') ||
    decoded.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(decoded)
  ) {
    return fallback;
  }

  try {
    const parsed = new URL(candidate, PATH_VALIDATION_ORIGIN);
    if (parsed.origin !== PATH_VALIDATION_ORIGIN) return fallback;
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return fallback;
  }
}

export function isProtectedPath(pathname: string, protectedPaths: readonly string[]): boolean {
  return protectedPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
