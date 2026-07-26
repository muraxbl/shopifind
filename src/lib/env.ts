/**
 * Centralised environment-variable predicates.
 *
 * Why these live in their own module rather than inline at use sites:
 *  - Test endpoints (`/api/test/*`) need a hard default-deny gate. The
 *    naive `!process.env.X` pattern is unsafe because JavaScript coerces
 *    the strings "false" / "0" / empty string to boolean values that would
 *    flip the gate open in misconfigured environments.
 *  - Future env-var readers (feature flags, plan tiers) need the same
 *    strict-comparison discipline.
 *
 * The rule: any boolean env var is enabled iff its strict equality to
 * "true". Anything else (unset, empty, "false", "0", "yes", "TRUE",
 * etc.) is disabled. Document this clearly when adding new vars.
 */

/**
 * Returns true if test-only endpoints under `/api/test/*` may mount.
 *
 * Default rules (defense-in-depth, production-first):
 *  - Production (`NODE_ENV=production`)            → always blocked.
 *  - Development (`NODE_ENV=development`)         → enabled unless the
 *    operator explicitly opts out with `ALLOW_TEST_ENDPOINTS=false`.
 *  - Anything else (staging / preview / unset)     → only enabled when
 *    `ALLOW_TEST_ENDPOINTS=true` (strict opt-in).
 *
 * This shape avoids the developer-local trap of "I forgot to set the
 * flag" while still keeping the production safety net absolute.
 */
export function isTestEndpointEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  if (process.env.NODE_ENV === 'development') {
    return process.env.ALLOW_TEST_ENDPOINTS !== 'false';
  }
  return process.env.ALLOW_TEST_ENDPOINTS === 'true';
}
