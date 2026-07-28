import { z } from 'zod';

export const PRICE_ALERT_MODES = [
  'any_drop',
  'target_price',
  'percentage_drop',
] as const;

export type PriceAlertMode = (typeof PRICE_ALERT_MODES)[number];

const BaseSchema = z.object({
  productId: z.string().uuid(),
  mode: z.enum(PRICE_ALERT_MODES),
  targetPrice: z.unknown().optional(),
  percentageDrop: z.unknown().optional(),
});

export type NormalizedPriceAlertInput = {
  productId: string;
  mode: PriceAlertMode;
  targetPriceCents: number | null;
  percentageDrop: number | null;
};

export type PriceAlertInputResult =
  | { success: true; data: NormalizedPriceAlertInput }
  | {
      success: false;
      error: 'invalid_input' | 'invalid_target' | 'invalid_percentage';
    };

function parseTargetPriceCents(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const normalized =
    typeof value === 'string' ? value.trim().replace(',', '.') : value;
  if (normalized === '') return null;
  const euros = Number(normalized);
  if (!Number.isFinite(euros) || euros <= 0) return null;
  const cents = Math.round(euros * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

function parsePercentage(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 99
    ? parsed
    : null;
}

export function normalizePriceAlertInput(
  value: unknown,
): PriceAlertInputResult {
  const parsed = BaseSchema.safeParse(value);
  if (!parsed.success) return { success: false, error: 'invalid_input' };

  if (parsed.data.mode === 'target_price') {
    const targetPriceCents = parseTargetPriceCents(parsed.data.targetPrice);
    if (targetPriceCents === null) {
      return { success: false, error: 'invalid_target' };
    }
    return {
      success: true,
      data: {
        productId: parsed.data.productId,
        mode: parsed.data.mode,
        targetPriceCents,
        percentageDrop: null,
      },
    };
  }

  if (parsed.data.mode === 'percentage_drop') {
    const percentageDrop = parsePercentage(parsed.data.percentageDrop);
    if (percentageDrop === null) {
      return { success: false, error: 'invalid_percentage' };
    }
    return {
      success: true,
      data: {
        productId: parsed.data.productId,
        mode: parsed.data.mode,
        targetPriceCents: null,
        percentageDrop,
      },
    };
  }

  return {
    success: true,
    data: {
      productId: parsed.data.productId,
      mode: 'any_drop',
      targetPriceCents: null,
      percentageDrop: null,
    },
  };
}
