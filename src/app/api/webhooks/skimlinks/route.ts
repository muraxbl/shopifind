import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { z } from 'zod';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

/**
 * POST /api/webhooks/skimlinks — Skimlinks click attribution listener.
 *
 * Modelled on https://developers.skimlinks.com/links-api/.
 *
 * Pipeline:
 *   1. content-length early-exit (≤ 8 KiB; Skimlinks payloads are ~1 KiB)
 *   2. Bounded stream body read with running byte counter — defends against
 *      attackers omitting / chunking past content-length. Hard cap: 8 KiB.
 *   3. IP allowlist (CIDRs in SKIMLINKS_IP_WHITELIST; IPv4 + IPv6 + IPv6-mapped IPv4)
 *   4. HMAC SHA-256 verify over raw body (fail-open only in non-prod if SKIMLINKS_SECRET absent)
 *   5. Zod-safe-parse of the application/x-www-form-urlencoded payload
 *   6. Replay window: timestamp must be in [-60s, +7d] (clock-skew tolerance)
 *   7. Idempotent INSERT — UNIQUE INDEX (xcust, intent, payload_timestamp) deduplicates
 *      Skimlinks retries. NOTE: dedup correctness depends on Skimlinks
 *      keeping `payload_timestamp` constant across retries for the same
 *      canonical event. If they ever bump it on retry, dedup fails silently.
 *      The raw IP field is hashed out of raw_payload before insert.
 */

export const maxDuration = 5;
const MAX_BODY_BYTES = 8 * 1024;

const SkimlinksPayloadSchema = z.object({
  xcust: z.string().min(1),
  // Skimlinks sometimes sends an empty `url=` field. Accept URL OR empty string.
  url: z.union([z.string().url(), z.literal('')]).optional(),
  intent: z.enum(['visit', 'buys']),
  paid: z.enum(['0', '1']).default('0'),
  commission: z.string().optional(),
  countryCode: z.string().length(2).optional(),
  // Intentionally NO `ip` field — we only carry the salted hash. Skimlinks posts
  // the sender IP, but we hash-and-discard it before insert. (Zod 3.23.x default
  // strip-mode would already drop undeclared keys; the explicit delete below is
  // defence-in-depth in case the schema is later loosened.)
  timestamp: z.string().min(1),
  merchantId: z.string().optional(),
});

function getClientIp(request: NextRequest): string {
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return '0.0.0.0';
}

function stripMappedIpv4(ip: string): string {
  // ::ffff:1.2.3.4 → 1.2.3.4 (IPv6-mapped IPv4)
  const m = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  return m ? m[1] : ip;
}

function ipInCidrV4(ip: string, range: string, bits: number): boolean {
  const ipParts = stripMappedIpv4(ip).split('.').map(Number);
  if (ipParts.length !== 4 || ipParts.some((p) => isNaN(p) || p < 0 || p > 255)) return false;
  const rangeParts = range.split('.').map(Number);
  if (rangeParts.length !== 4 || rangeParts.some((p) => isNaN(p) || p < 0 || p > 255)) return false;
  const toInt = (a: number[]) => ((a[0] << 24) | (a[1] << 16) | (a[2] << 8) | a[3]) >>> 0;
  if (bits === 0) return toInt(ipParts) === toInt(rangeParts);
  if (bits < 0 || bits > 32) return false;
  const mask = bits === 32 ? 0xffffffff : (~((1 << (32 - bits)) - 1)) >>> 0;
  return (toInt(ipParts) & mask) === (toInt(rangeParts) & mask);
}

function expandIpv6(s: string): number[] | null {
  // Normalize and split into 8 hextets (handles :: expansion).
  // Reject multiple `::` (an IPv6 address may have at most one) — otherwise
  // a malformed input like `1::1::2` would silently parse as `1:0:0:0:0:0:1:2`.
  if (s.split('::').length > 2) return null;
  const doubleColonIdx = s.indexOf('::');
  if (doubleColonIdx >= 0) {
    const before = s.slice(0, doubleColonIdx).split(':').filter((p) => p.length > 0);
    const after = s.slice(doubleColonIdx + 2).split(':').filter((p) => p.length > 0);
    const missing = 8 - before.length - after.length;
    if (missing < 0) return null;
    return [
      ...before.map((h) => parseInt(h, 16) || 0),
      ...new Array(missing).fill(0),
      ...after.map((h) => parseInt(h, 16) || 0),
    ];
  }
  const parts = s.split(':');
  if (parts.length !== 8) return null;
  return parts.map((h) => {
    const n = parseInt(h, 16);
    return isNaN(n) ? -1 : n;
  });
}

function ipInCidrV6(ip: string, range: string, bits: number): boolean {
  const ipParts = expandIpv6(ip);
  const rangeParts = expandIpv6(range);
  if (!ipParts || !rangeParts) return false;
  if (bits < 0 || bits > 128) return false;
  let ipNum = BigInt(0);
  for (const h of ipParts) {
    if (h < 0 || h > 0xffff) return false;
    ipNum = (ipNum << BigInt(16)) + BigInt(h);
  }
  let rangeNum = BigInt(0);
  for (const h of rangeParts) {
    if (h < 0 || h > 0xffff) return false;
    rangeNum = (rangeNum << BigInt(16)) + BigInt(h);
  }
  if (bits === 0) return ipNum === rangeNum;
  const mask = ((BigInt(1) << BigInt(128)) - BigInt(1)) ^ ((BigInt(1) << BigInt(128 - bits)) - BigInt(1));
  return (ipNum & mask) === (rangeNum & mask);
}

function ipInCidr(ip: string, cidr: string): boolean {
  // Strip IPv6-mapped IPv4 (`::ffff:1.2.3.4`) FIRST, before branching on
  // `:` content. Without this, mapped-IPv4 inputs were routed to ipInCidrV6
  // (which can't match them), silently failing all IPv4 CIDR lookups.
  const normalised = stripMappedIpv4(ip);
  const [range, bitsStr] = cidr.split('/');
  const bits = bitsStr ? parseInt(bitsStr, 10) : normalised.includes(':') ? 128 : 32;
  if (!range || isNaN(bits)) return false;
  return normalised.includes(':')
    ? ipInCidrV6(normalised, range, bits)
    : ipInCidrV4(normalised, range, bits);
}

/**
 * IP allowlist — Skimlinks publishes rotating CIDRs at
 * https://docs.skimresources.com/ (covers both IPv4 and IPv6 ranges).
 * Configure via SKIMLINKS_IP_WHITELIST env var (comma-separated CIDRs).
 * In production with no env = reject all (fail-closed).
 */
function ipAllowed(ip: string): boolean {
  const isProd = process.env.NODE_ENV === 'production';
  const cidrs = (process.env.SKIMLINKS_IP_WHITELIST ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (cidrs.length === 0) return !isProd;
  for (const cidr of cidrs) {
    if (ipInCidr(ip, cidr)) return true;
  }
  return false;
}

function constantTimeHexEquals(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'hex');
  const bBuf = Buffer.from(b, 'hex');
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

/**
 * Salted hash of the client IP for fraud-correlation without storing raw PII.
 * Skimlinks posts the sender IP in the form body; we hash with a server-side salt.
 */
async function hashSaltedIp(ip: string): Promise<string | null> {
  if (!ip) return null;
  const salt = process.env.SKIMLINKS_IP_SALT ?? 'shopifind-default-salt';
  return crypto.createHash('sha256').update(`${salt}:${ip}`, 'utf8').digest('hex');
}

export async function POST(request: NextRequest) {
  // 0. Body-size guard (cooperative attackers only).
  const contentLength = parseInt(request.headers.get('content-length') ?? '0', 10);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'payload_too_large' }, { status: 413 });
  }

  // 0b. Bounded stream read — defends against attackers omitting/chunking the
  // content-length header to bypass the guard. We tally incoming bytes
  // and abort() the body if the running total exceeds MAX_BODY_BYTES.
  if (!request.body) {
    return NextResponse.json({ error: 'no_body' }, { status: 400 });
  }
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let received = 0;
  const chunks: Uint8Array[] = [];
  let aborted = false;
  while (!aborted) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      received += value.byteLength;
      if (received > MAX_BODY_BYTES) {
        aborted = true;
        try { await reader.cancel(); } catch {} // already-closed streams reject
        return NextResponse.json({ error: 'payload_too_large' }, { status: 413 });
      }
      chunks.push(value);
    }
  }
  const rawBody = decoder.decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));

  // 1. IP allowlist (IPv4 + IPv6 + IPv6-mapped IPv4)
  const ip = getClientIp(request);
  if (!ipAllowed(ip)) {
    return NextResponse.json({ error: 'forbidden_ip' }, { status: 403 });
  }

  // 2. HMAC SHA-256 verification. Fail-open in non-prod if SKIMLINKS_SECRET unset.
  const secret = process.env.SKIMLINKS_SECRET;
  const sig = request.headers.get('x-skimlinks-signature') ?? '';
  if (secret) {
    if (!sig) return NextResponse.json({ error: 'missing_signature' }, { status: 401 });
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    if (!constantTimeHexEquals(expected, sig)) {
      return NextResponse.json({ error: 'bad_signature' }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 });
  }

  // 3. Parse + validate
  const parsed = SkimlinksPayloadSchema.safeParse(
    Object.fromEntries(new URLSearchParams(rawBody))
  );
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }
  const d = parsed.data;

  // 4. Replay window: [-60s, +7d] clock-skew tolerance
  const tsMs = Date.parse(d.timestamp);
  const ageMs = Date.now() - tsMs;
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  if (!Number.isFinite(tsMs) || ageMs < -60_000 || ageMs > SEVEN_DAYS_MS) {
    return NextResponse.json({ error: 'stale_timestamp' }, { status: 400 });
  }

  // 5. Idempotent INSERT — UNIQUE INDEX (xcust, intent, payload_timestamp) dedupes Skimlinks retries.
  const sb = createAdminSupabaseClient();
  const productSlug = d.xcust.startsWith('shopifind-')
    ? d.xcust.slice('shopifind-'.length)
    : null;

  // Hash the sender IP for storage; raw IP is GDPR/PECR sensitive and we never persist it.
  const ipHash = await hashSaltedIp(ip);

  // Strip the raw IP from raw_payload (defence in depth: even if HMAC is bypassed,
  // an attacker can't get us to dump raw IPs into the JSONB blob).
  const sanitizedPayload = { ...d };
  // (No `ip` field in the schema to begin with — but if Skimlinks sends it anyway,
  // ensure it never reaches raw_payload.)
  delete (sanitizedPayload as Record<string, unknown>).ip;

  const insertRow = {
    xcust: d.xcust,
    product_slug: productSlug,
    source_url: d.url && d.url.length > 0 ? d.url : null,
    merchant_id: d.merchantId ?? null,
    intent: d.intent,
    paid: d.paid === '1',
    commission_cents: d.commission ? parseInt(d.commission, 10) : null,
    country_code: d.countryCode ?? null,
    ip_hash: ipHash,
    raw_payload: sanitizedPayload,
    payload_timestamp: d.timestamp,
    received_at: new Date().toISOString(),
    paid_at: d.intent === 'buys' && d.paid === '1' ? new Date().toISOString() : null,
  };

  const { error } = await sb.from('click_attribution').insert(insertRow as never);
  // 23505 = unique violation; treat as duplicate ack (idempotent).
  if (error && error.code !== '23505') {
    console.error('[skimlinks-webhook] insert error:', error.message);
    return NextResponse.json({ error: 'insert_failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
