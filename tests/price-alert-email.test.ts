import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPriceAlertEmail } from '../src/lib/email/resend';

test('price alert email escapes merchant text and keeps links on Shopifind', () => {
  const email = buildPriceAlertEmail({
    to: 'buyer@example.test',
    productTitle: '<img src=x onerror=alert(1)> Lamp',
    oldPriceCents: 3000,
    newPriceCents: 2500,
    productPath: '/go/safe-lamp',
    idempotencyKey: 'price-alert/delivery-id',
  });
  assert.match(email.html, /&lt;img src=x onerror=alert\(1\)&gt; Lamp/);
  assert.doesNotMatch(email.html, /<img src=x/);
  assert.match(email.html, /https:\/\/shopifind\.app\/go\/safe-lamp/);
  assert.match(email.text, /30,00/);
  assert.match(email.text, /25,00/);
});

test('price alert email rejects external CTA URLs', () => {
  assert.throws(() =>
    buildPriceAlertEmail({
      to: 'buyer@example.test',
      productTitle: 'Lamp',
      oldPriceCents: 3000,
      newPriceCents: 2500,
      productPath: 'https://attacker.test/phish',
      idempotencyKey: 'price-alert/delivery-id',
    }),
  );
});
