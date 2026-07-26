import { Resend } from 'resend';

let cached: Resend | null = null;
function getResend(): Resend {
  if (cached) return cached;
  cached = new Resend(process.env.RESEND_API_KEY);
  return cached;
}

export type AlertEmailInput = {
  to: string;
  productTitle: string;
  oldPriceCents: number;
  newPriceCents: number;
  productUrl: string;       // /go/[slug]
  currency?: string;
};

const DISCLAIMER_FOOTER = `
Shopifind · Less Amazon, more you.
Recibes este email porque guardaste "${'{productTitle}'}" en tu wishlist.
Puedes desactivar las alertas en tu perfil.
Shopifind es una plataforma independiente. No estamos afiliados a Shopify Inc.
`.trim();

/**
 * Send a "your wishlist price dropped" alert.
 */
export async function sendWishlistPriceAlert(input: AlertEmailInput) {
  const from = process.env.RESEND_FROM_EMAIL ?? 'hello@shopifind.com';
  const { oldPriceCents, newPriceCents, productTitle, productUrl, currency = 'EUR', to } = input;

  const formatCents = (c: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(c / 100);

  const subject = `📉 Bajada de precio: ${productTitle}`;

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <h2 style="font-family:Georgia,serif;color:#0a0a0a;margin:0 0 16px">Buenas noticias</h2>
      <p>El producto que tienes guardado ha bajado de precio.</p>
      <div style="border:1px solid #e5e5e5;border-radius:12px;padding:16px;margin:16px 0">
        <strong style="display:block;font-size:18px;margin-bottom:8px">${productTitle}</strong>
        <div>
          <span style="text-decoration:line-through;color:#888">${formatCents(oldPriceCents)}</span>
          <strong style="color:#16a34a;margin-left:8px;font-size:18px">${formatCents(newPriceCents)}</strong>
        </div>
      </div>
      <a href="${productUrl}" style="display:inline-block;background:#0a0a0a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;margin-top:8px">Ver producto</a>
      <hr style="margin:32px 0;border:none;border-top:1px solid #e5e5e5" />
      <p style="font-size:12px;color:#888">${DISCLAIMER_FOOTER.replace('{productTitle}', productTitle)}</p>
    </div>
  `;

  return getResend().emails.send({ from, to, subject, html });
}

/**
 * Subscribe an email to the weekly newsletter.
 * (Real implementation: insert into newsletter_subscribers table.)
 */
export async function subscribeToNewsletter(email: string) {
  // TODO: insert into a `newsletter_subscribers` table or push to Resend Audiences.
  return { ok: true, email };
}
