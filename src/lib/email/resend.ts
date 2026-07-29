import { SITE_CONFIG } from '@/lib/config';

export type AlertEmailInput = {
  to: string;
  productTitle: string;
  oldPriceCents: number;
  newPriceCents: number;
  productPath: string;
  idempotencyKey: string;
  currency?: string;
};

export type BuiltAlertEmail = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function absoluteShopifindUrl(path: string): string {
  const base = new URL(SITE_CONFIG.url);
  const candidate = new URL(path, base);
  if (candidate.origin !== base.origin) {
    throw new Error('Alert email URL must remain on Shopifind.');
  }
  return candidate.toString();
}

export function buildPriceAlertEmail(input: AlertEmailInput): BuiltAlertEmail {
  const from =
    process.env.RESEND_FROM_EMAIL ??
    'Shopifind <alertas@notify.shopifind.app>';
  const currency = input.currency ?? 'EUR';
  const formatCents = (cents: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(
      cents / 100,
    );
  const title = input.productTitle
    .trim()
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 180);
  const safeTitle = escapeHtml(title);
  const productUrl = absoluteShopifindUrl(input.productPath);
  const safeProductUrl = escapeHtml(productUrl);
  const oldPrice = formatCents(input.oldPriceCents);
  const newPrice = formatCents(input.newPriceCents);
  const subject = `📉 Bajada de precio: ${title}`;
  const footer = `Recibes este email porque configuraste una alerta para “${title}”. Puedes desactivarla desde tu cuenta. Shopifind es una plataforma independiente y no está afiliada a Shopify Inc.`;

  return {
    from,
    to: input.to,
    subject,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">
        <h2 style="font-family:Georgia,serif;color:#0a0a0a;margin:0 0 16px">Buenas noticias</h2>
        <p>Una alerta de precio que configuraste acaba de cumplirse.</p>
        <div style="border:1px solid #e5e5e5;border-radius:12px;padding:16px;margin:16px 0">
          <strong style="display:block;font-size:18px;margin-bottom:8px">${safeTitle}</strong>
          <div>
            <span style="text-decoration:line-through;color:#888">${escapeHtml(oldPrice)}</span>
            <strong style="color:#16a34a;margin-left:8px;font-size:18px">${escapeHtml(newPrice)}</strong>
          </div>
        </div>
        <a href="${safeProductUrl}" style="display:inline-block;background:#0a0a0a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;margin-top:8px">Ver producto</a>
        <hr style="margin:32px 0;border:none;border-top:1px solid #e5e5e5" />
        <p style="font-size:12px;color:#888">${escapeHtml(footer)}</p>
      </div>
    `,
    text: `Buenas noticias: “${title}” ha pasado de ${oldPrice} a ${newPrice}. Ver producto: ${productUrl}\n\n${footer}`,
  };
}

export async function sendPriceAlertEmail(input: AlertEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { data: null, error: { message: 'RESEND_API_KEY is missing' } };
  }
  const email = buildPriceAlertEmail(input);
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        'idempotency-key': input.idempotencyKey.slice(0, 256),
      },
      body: JSON.stringify(email),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await response.json().catch(() => null)) as {
      id?: string;
      message?: string;
    } | null;
    if (!response.ok || !body?.id) {
      return {
        data: null,
        error: { message: body?.message ?? `Resend HTTP ${response.status}` },
      };
    }
    return { data: { id: body.id }, error: null };
  } catch {
    return { data: null, error: { message: 'Resend request failed' } };
  }
}

export async function subscribeToNewsletter(email: string) {
  // TODO: insert into a `newsletter_subscribers` table or Resend Audiences.
  return { ok: true, email };
}
