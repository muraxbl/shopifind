import { NextResponse, type NextRequest } from 'next/server';
import {
  evaluatePriceAlert,
  isPriceAlertDeliveryCurrent,
} from '@/lib/alerts/evaluate';
import type { PriceAlertMode } from '@/lib/alerts/input';
import { sendPriceAlertEmail } from '@/lib/email/resend';
import { hasValidBearerSecret } from '@/lib/http/secrets';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_ALERTS_PER_RUN = 500;
const MAX_EVENTS_PER_ALERT = 100;
const MAX_DELIVERIES_PER_RUN = 25;
const MAX_DELIVERY_ATTEMPTS = 5;

type AlertRow = {
  id: string;
  user_id: string;
  product_id: string;
  mode: PriceAlertMode;
  baseline_price_cents: number;
  baseline_currency: string;
  target_price_cents: number | null;
  percentage_drop: number | null;
  last_evaluated_history_id: number | null;
};

type DeliveryRow = {
  id: string;
  alert_id: string;
  price_history_id: number;
  reference_price_cents: number;
  reference_currency: string;
  status: 'pending' | 'failed';
  attempt_count: number;
};

function sanitizedError(message: string): string {
  return message.replace(/[\r\n]+/g, ' ').slice(0, 500);
}

export async function GET(request: NextRequest) {
  if (
    !hasValidBearerSecret(
      request.headers.get('authorization'),
      process.env.CRON_SECRET,
    )
  ) {
    return NextResponse.json(
      { ok: false, error: 'unauthorized' },
      { status: 401 },
    );
  }
  if (
    !process.env.SUPABASE_SERVICE_ROLE_KEY ||
    !process.env.RESEND_API_KEY ||
    !process.env.RESEND_FROM_EMAIL
  ) {
    return NextResponse.json(
      { ok: false, error: 'worker_not_configured' },
      { status: 503 },
    );
  }

  const sb = createAdminSupabaseClient();
  const schemaChecks = await Promise.all([
    sb.from('price_history').select('id, currency').limit(1),
    sb.from('price_alerts').select('id, baseline_currency').limit(1),
    sb
      .from('price_alert_deliveries')
      .select('id, reference_currency')
      .limit(1),
  ]);
  if (schemaChecks.some((result) => result.error)) {
    return NextResponse.json(
      { ok: false, error: 'price_alerts_not_ready' },
      { status: 503 },
    );
  }

  const alertResult = await sb
    .from('price_alerts')
    .select(
      'id, user_id, product_id, mode, baseline_price_cents, baseline_currency, target_price_cents, percentage_drop, last_evaluated_history_id',
    )
    .eq('active', true)
    .order('updated_at', { ascending: true })
    .limit(MAX_ALERTS_PER_RUN);
  if (alertResult.error) {
    return NextResponse.json(
      { ok: false, error: 'alerts_read_failed' },
      { status: 502 },
    );
  }

  let alertsEvaluated = 0;
  let deliveriesQueued = 0;
  let evaluationFailures = 0;

  for (const alert of (alertResult.data ?? []) as AlertRow[]) {
    let historyQuery = sb
      .from('price_history')
      .select('id, price_cents, currency, in_stock')
      .eq('product_id', alert.product_id)
      .order('id', { ascending: true })
      .limit(MAX_EVENTS_PER_ALERT + 1);
    if (alert.last_evaluated_history_id !== null) {
      historyQuery = historyQuery.gt('id', alert.last_evaluated_history_id);
    }
    const historyResult = await historyQuery;
    if (historyResult.error) {
      evaluationFailures++;
      continue;
    }
    const rawEvents = (historyResult.data ?? []) as Array<{
      id: number;
      price_cents: number;
      currency: string;
      in_stock: boolean;
    }>;
    const hasMoreEvents = rawEvents.length > MAX_EVENTS_PER_ALERT;
    const events = rawEvents.slice(0, MAX_EVENTS_PER_ALERT);
    if (events.length === 0) {
      alertsEvaluated++;
      continue;
    }

    const evaluation = evaluatePriceAlert({
      mode: alert.mode,
      baselinePriceCents: alert.baseline_price_cents,
      baselineCurrency: alert.baseline_currency,
      targetPriceCents: alert.target_price_cents,
      percentageDrop: alert.percentage_drop,
      events,
    });

    const triggerHistoryId = hasMoreEvents ? null : evaluation.triggerHistoryId;
    if (triggerHistoryId !== null) {
      const deliveryResult = await sb.from('price_alert_deliveries').upsert(
        {
          alert_id: alert.id,
          price_history_id: triggerHistoryId,
          reference_price_cents: alert.baseline_price_cents,
          reference_currency: alert.baseline_currency,
          status: 'pending',
        } as never,
        {
          onConflict: 'alert_id,price_history_id',
          ignoreDuplicates: true,
        },
      );
      if (deliveryResult.error) {
        evaluationFailures++;
        continue;
      }
      deliveriesQueued++;
    }

    const updateResult = await sb
      .from('price_alerts')
      .update({
        last_evaluated_history_id: evaluation.lastHistoryId,
        baseline_price_cents: evaluation.nextBaselinePriceCents,
        baseline_currency: evaluation.nextBaselineCurrency,
        active: hasMoreEvents ? true : !evaluation.deactivate,
        ...(evaluation.nextBaselineCurrency !== alert.baseline_currency
          ? {
              last_notified_price_cents: null,
              last_notified_at: null,
            }
          : {}),
      } as never)
      .eq('id', alert.id);
    if (updateResult.error) {
      evaluationFailures++;
      continue;
    }
    alertsEvaluated++;
  }

  const staleBefore = new Date(Date.now() - 15 * 60 * 1_000).toISOString();
  await sb
    .from('price_alert_deliveries')
    .update({
      status: 'failed',
      error_message: 'processing_timeout',
    } as never)
    .eq('status', 'processing')
    .lt('attempted_at', staleBefore);

  const deliveryResult = await sb
    .from('price_alert_deliveries')
    .select(
      'id, alert_id, price_history_id, reference_price_cents, reference_currency, status, attempt_count',
    )
    .in('status', ['pending', 'failed'])
    .lt('attempt_count', MAX_DELIVERY_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(MAX_DELIVERIES_PER_RUN);
  if (deliveryResult.error) {
    return NextResponse.json(
      { ok: false, error: 'deliveries_read_failed' },
      { status: 502 },
    );
  }

  let deliveriesSent = 0;
  let deliveriesSkipped = 0;
  let deliveryFailures = 0;

  for (const delivery of (deliveryResult.data ?? []) as DeliveryRow[]) {
    const attemptedAt = new Date().toISOString();
    const claimResult = await sb
      .from('price_alert_deliveries')
      .update({
        status: 'processing',
        attempt_count: delivery.attempt_count + 1,
        attempted_at: attemptedAt,
        error_message: null,
      } as never)
      .eq('id', delivery.id)
      .eq('status', delivery.status)
      .select('id')
      .maybeSingle();
    if (claimResult.error || !claimResult.data) continue;

    const [alertDetails, historyDetails] = await Promise.all([
      sb
        .from('price_alerts')
        .select('user_id, product_id, mode, baseline_price_cents')
        .eq('id', delivery.alert_id)
        .maybeSingle(),
      sb
        .from('price_history')
        .select('id, price_cents, currency, in_stock')
        .eq('id', delivery.price_history_id)
        .maybeSingle(),
    ]);
    const alert = alertDetails.data as {
      user_id: string;
      product_id: string;
      mode: PriceAlertMode;
      baseline_price_cents: number;
    } | null;
    const history = historyDetails.data as {
      id: number;
      price_cents: number;
      currency: string;
      in_stock: boolean;
    } | null;

    if (alertDetails.error || historyDetails.error || !alert || !history) {
      await markSkipped(sb, delivery.id, 'missing_alert_or_history');
      deliveriesSkipped++;
      continue;
    }

    const [productDetails, userDetails] = await Promise.all([
      sb
        .from('products')
        .select('slug, title, price_cents, currency, in_stock')
        .eq('id', alert.product_id)
        .maybeSingle(),
      sb.auth.admin.getUserById(alert.user_id),
    ]);
    const product = productDetails.data as {
      slug: string;
      title: string;
      price_cents: number;
      currency: string;
      in_stock: boolean;
    } | null;
    const email = userDetails.data.user?.email ?? null;
    if (
      productDetails.error ||
      !product ||
      !email ||
      !isPriceAlertDeliveryCurrent({
        referenceCurrency: delivery.reference_currency,
        history: {
          priceCents: history.price_cents,
          currency: history.currency,
          inStock: history.in_stock,
        },
        product: {
          priceCents: product.price_cents,
          currency: product.currency,
          inStock: product.in_stock,
        },
      })
    ) {
      await markSkipped(sb, delivery.id, 'delivery_obsolete_or_unavailable');
      deliveriesSkipped++;
      continue;
    }

    const sendResult = await sendPriceAlertEmail({
      to: email,
      productTitle: product.title,
      oldPriceCents: delivery.reference_price_cents,
      newPriceCents: history.price_cents,
      currency: history.currency,
      productPath: `/go/${product.slug}`,
      idempotencyKey: `price-alert/${delivery.id}`,
    });
    if (sendResult.error || !sendResult.data) {
      await sb
        .from('price_alert_deliveries')
        .update({
          status: 'failed',
          error_message: sanitizedError(
            sendResult.error?.message ?? 'email_send_failed',
          ),
        } as never)
        .eq('id', delivery.id)
        .eq('status', 'processing');
      deliveryFailures++;
      continue;
    }

    const sentAt = new Date().toISOString();
    let markedSent = false;
    for (let attempt = 0; attempt < 3 && !markedSent; attempt++) {
      const sentUpdate = await sb
        .from('price_alert_deliveries')
        .update({
          status: 'sent',
          provider_message_id: sendResult.data.id,
          error_message: null,
          sent_at: sentAt,
        } as never)
        .eq('id', delivery.id)
        .eq('status', 'processing');
      markedSent = !sentUpdate.error;
    }
    if (!markedSent) {
      deliveryFailures++;
      continue;
    }
    await sb
      .from('price_alerts')
      .update({
        last_notified_price_cents: history.price_cents,
        last_notified_at: sentAt,
      } as never)
      .eq('id', delivery.alert_id);
    deliveriesSent++;
  }

  return NextResponse.json({
    ok: evaluationFailures === 0 && deliveryFailures === 0,
    alerts_evaluated: alertsEvaluated,
    deliveries_queued: deliveriesQueued,
    deliveries_sent: deliveriesSent,
    deliveries_skipped: deliveriesSkipped,
    evaluation_failures: evaluationFailures,
    delivery_failures: deliveryFailures,
  });
}

async function markSkipped(
  sb: ReturnType<typeof createAdminSupabaseClient>,
  deliveryId: string,
  reason: string,
) {
  await sb
    .from('price_alert_deliveries')
    .update({ status: 'skipped', error_message: reason } as never)
    .eq('id', deliveryId)
    .eq('status', 'processing');
}
