'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { disablePriceAlert } from '@/actions/priceAlerts';
import type { PriceAlertMode } from '@/lib/alerts/input';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/utils';

export type AccountPriceAlert = {
  productId: string;
  productSlug: string | null;
  productTitle: string;
  currency: string;
  currentPriceCents: number | null;
  baselinePriceCents: number;
  mode: PriceAlertMode;
  targetPriceCents: number | null;
  percentageDrop: number | null;
};

function conditionLabel(alert: AccountPriceAlert): string {
  if (alert.mode === 'target_price' && alert.targetPriceCents !== null) {
    return `Objetivo: ${formatPrice(alert.targetPriceCents, alert.currency)}`;
  }
  if (alert.mode === 'percentage_drop' && alert.percentageDrop !== null) {
    return `Bajada de ${alert.percentageDrop}%`;
  }
  return 'Cualquier bajada';
}

export function PriceAlertList({
  available,
  initialAlerts,
}: {
  available: boolean;
  initialAlerts: AccountPriceAlert[];
}) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!available) {
    return (
      <section className="mt-6 rounded-2xl border border-dashed p-5">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Bell className="h-4 w-4" /> Alertas de precio en preparación
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Aparecerán aquí cuando esté activo el histórico de precios.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm md:p-7">
      <div className="mb-5">
        <h2 className="flex items-center gap-2 font-display text-xl">
          <Bell className="h-5 w-5 text-primary" /> Alertas activas
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Gestiona los avisos que has configurado desde las fichas de producto.
        </p>
      </div>

      {alerts.length === 0 ? (
        <p className="rounded-xl bg-secondary/40 p-4 text-sm text-muted-foreground">
          No tienes alertas activas. Puedes crear una desde cualquier producto.
        </p>
      ) : (
        <div className="divide-y">
          {alerts.map((alert) => (
            <div
              key={alert.productId}
              className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                {alert.productSlug ? (
                  <Link
                    href={`/product/${alert.productSlug}`}
                    className="line-clamp-1 text-sm font-medium hover:text-primary"
                  >
                    {alert.productTitle}
                  </Link>
                ) : (
                  <p className="line-clamp-1 text-sm font-medium">
                    {alert.productTitle}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {conditionLabel(alert)}
                  {alert.currentPriceCents !== null && (
                    <>
                      {' · '}Ahora{' '}
                      {formatPrice(alert.currentPriceCents, alert.currency)}
                    </>
                  )}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="gap-1"
                disabled={isPending}
                onClick={() => {
                  setError(null);
                  startTransition(async () => {
                    const result = await disablePriceAlert(alert.productId);
                    if (!result.ok) {
                      setError('No hemos podido desactivar la alerta.');
                      return;
                    }
                    setAlerts((current) =>
                      current.filter(
                        (item) => item.productId !== alert.productId,
                      ),
                    );
                  });
                }}
              >
                <BellOff className="h-3.5 w-3.5" /> Desactivar
              </Button>
            </div>
          ))}
        </div>
      )}
      {error && (
        <p className="mt-4 text-xs text-rose-700" role="status">
          {error}
        </p>
      )}
    </section>
  );
}
