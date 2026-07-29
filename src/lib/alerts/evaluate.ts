import type { PriceAlertMode } from '@/lib/alerts/input';

export type PriceHistoryEvent = {
  id: number;
  price_cents: number;
  currency: string;
  in_stock: boolean;
};

export type AlertEvaluationInput = {
  mode: PriceAlertMode;
  baselinePriceCents: number;
  baselineCurrency: string;
  targetPriceCents: number | null;
  percentageDrop: number | null;
  events: PriceHistoryEvent[];
};

export type AlertEvaluation = {
  triggerHistoryId: number | null;
  lastHistoryId: number | null;
  nextBaselinePriceCents: number;
  nextBaselineCurrency: string;
  deactivate: boolean;
};

export type PriceAlertDeliverySnapshot = {
  referenceCurrency: string;
  history: { priceCents: number; currency: string; inStock: boolean };
  product: { priceCents: number; currency: string; inStock: boolean };
};

export function isPriceAlertDeliveryCurrent(
  snapshot: PriceAlertDeliverySnapshot,
): boolean {
  return (
    snapshot.history.inStock &&
    snapshot.product.inStock &&
    snapshot.history.currency === snapshot.referenceCurrency &&
    snapshot.product.currency === snapshot.history.currency &&
    snapshot.product.priceCents === snapshot.history.priceCents
  );
}

export function evaluatePriceAlert(
  input: AlertEvaluationInput,
): AlertEvaluation {
  const lastEvent = input.events.at(-1) ?? null;
  const lastHistoryId = lastEvent?.id ?? null;
  if (!lastEvent?.in_stock) {
    return {
      triggerHistoryId: null,
      lastHistoryId,
      nextBaselinePriceCents: input.baselinePriceCents,
      nextBaselineCurrency: input.baselineCurrency,
      deactivate: false,
    };
  }

  // A numeric target only has meaning in the currency in which the user
  // created it. Reset relative alerts when a merchant changes currency and
  // deactivate fixed-price targets instead of comparing unrelated cents.
  if (lastEvent.currency !== input.baselineCurrency) {
    return {
      triggerHistoryId: null,
      lastHistoryId,
      nextBaselinePriceCents: lastEvent.price_cents,
      nextBaselineCurrency: lastEvent.currency,
      deactivate: input.mode === 'target_price',
    };
  }

  let matches = false;
  if (input.mode === 'any_drop') {
    matches = lastEvent.price_cents < input.baselinePriceCents;
  } else if (input.mode === 'target_price' && input.targetPriceCents !== null) {
    matches = lastEvent.price_cents <= input.targetPriceCents;
  } else if (
    input.mode === 'percentage_drop' &&
    input.percentageDrop !== null
  ) {
    const threshold = Math.floor(
      input.baselinePriceCents * (1 - input.percentageDrop / 100),
    );
    matches = lastEvent.price_cents <= threshold;
  }

  return {
    triggerHistoryId: matches ? lastEvent.id : null,
    lastHistoryId,
    nextBaselinePriceCents:
      input.mode === 'any_drop'
        ? lastEvent.price_cents
        : input.baselinePriceCents,
    nextBaselineCurrency: input.baselineCurrency,
    deactivate: matches && input.mode !== 'any_drop',
  };
}
