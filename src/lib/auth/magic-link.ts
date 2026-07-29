const TOKEN_HASH_PATTERN = /^[A-Za-z0-9_-]+$/;

export function isValidEmailTokenHash(
  value: string | null | undefined,
): value is string {
  if (!value) return false;
  return (
    value.length >= 32 && value.length <= 512 && TOKEN_HASH_PATTERN.test(value)
  );
}

export function isSameOriginFormPost(
  origin: string | null,
  requestOrigin: string,
): boolean {
  // Some privacy-focused clients omit Origin on a same-origin form POST.
  if (!origin) return true;
  return origin === requestOrigin;
}
