import { createHash, timingSafeEqual } from 'node:crypto';

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

export function safeSecretEquals(
  provided: string | null | undefined,
  expected: string | null | undefined,
): boolean {
  if (!provided || !expected) return false;
  return timingSafeEqual(digest(provided), digest(expected));
}

export function hasValidBearerSecret(
  authorization: string | null,
  expected: string | null | undefined,
): boolean {
  if (!authorization?.startsWith('Bearer ')) return false;
  return safeSecretEquals(authorization.slice('Bearer '.length), expected);
}
