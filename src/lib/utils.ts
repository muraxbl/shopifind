import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind class names with conflict resolution.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a price in cents into a localized string with currency symbol.
 */
export function formatPrice(cents: number, currency = "EUR", locale = "es-ES") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/**
 * Build a friendly eco-score badge label & color class.
 */
export function formatEcoScore(score: number) {
  if (score <= 0)
    return {
      label: "Sin evaluar",
      variant: "bg-stone-100 text-stone-700",
      evaluated: false,
    };
  if (score >= 85)
    return {
      label: "Excelente",
      variant: "bg-emerald-100 text-emerald-800",
      evaluated: true,
    };
  if (score >= 70)
    return {
      label: "Bueno",
      variant: "bg-lime-100 text-lime-800",
      evaluated: true,
    };
  if (score >= 50)
    return {
      label: "Aceptable",
      variant: "bg-amber-100 text-amber-800",
      evaluated: true,
    };
  return {
    label: "Bajo",
    variant: "bg-stone-100 text-stone-700",
    evaluated: true,
  };
}
