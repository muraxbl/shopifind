import type { PriceAlertMode } from '@/lib/alerts/input';

export type PriceHistoryEvent = {
  id: number;
  price_cents: number;
  in_stock: boolean;
};

export type AlertEvaluationInput = {
  mode: PriceAlertMode;
  baselinePriceCents: number;
  targetPriceCents: number | null;
  percentageDrop: number | null;
  events: PriceHistoryEvent[];
};

export type AlertEvaluation = {
  triggerHistoryId: number | null;
  lastHistoryId: number | null;
  nextBaselinePriceCents: number;
  deactivate: boolean;
};

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
      deactivate: false,
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
    deactivate: matches && input.mode !== 'any_drop',
  };
}
