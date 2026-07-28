'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { Bell, BellOff, CheckCircle2 } from 'lucide-react';
import {
  disablePriceAlert,
  savePriceAlert,
  type PriceAlertActionResult,
} from '@/actions/priceAlerts';
import type { PriceAlertMode } from '@/lib/alerts/input';
import type { PriceAlertState } from '@/lib/alerts/read';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatPrice } from '@/lib/utils';

const ERROR_MESSAGES: Record<
  Exclude<PriceAlertActionResult, { ok: true }>['error'],
  string
> = {
  unauthenticated: 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
  invalid_input: 'Los datos de la alerta no son válidos.',
  invalid_target: 'Indica un precio objetivo válido.',
  invalid_percentage: 'El porcentaje debe estar entre 1 y 99.',
  target_not_below_current: 'El objetivo debe ser menor que el precio actual.',
  product_unavailable: 'Este producto ya no está disponible.',
  alerts_unavailable: 'Las alertas todavía no están disponibles.',
  save_failed: 'No hemos podido guardar la alerta. Inténtalo de nuevo.',
};

export function PriceAlertCard({
  productId,
  productSlug,
  currentPriceCents,
  currency,
  initialState,
}: {
  productId: string;
  productSlug: string;
  currentPriceCents: number;
  currency: string;
  initialState: PriceAlertState;
}) {
  const initialAlert = initialState.alert?.active ? initialState.alert : null;
  const [mode, setMode] = useState<PriceAlertMode>(
    initialAlert?.mode ?? 'any_drop',
  );
  const [targetPrice, setTargetPrice] = useState(
    initialAlert?.targetPriceCents
      ? String(initialAlert.targetPriceCents / 100)
      : '',
  );
  const [percentage, setPercentage] = useState(
    initialAlert?.percentageDrop ? String(initialAlert.percentageDrop) : '10',
  );
  const [active, setActive] = useState(Boolean(initialAlert));
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!initialState.available) {
    return (
      <section className="mt-4 rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2 font-medium text-foreground">
          <Bell className="h-4 w-4" /> Alertas de precio en preparación
        </div>
        <p className="mt-1 text-xs">
          Estamos terminando el histórico que permitirá avisarte sin falsas
          alarmas.
        </p>
      </section>
    );
  }

  if (!initialState.authenticated) {
    return (
      <section className="mt-4 rounded-2xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium">
              <Bell className="h-4 w-4" /> Avísame cuando baje
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Inicia sesión para configurar una alerta sobre este producto.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/login?next=/product/${productSlug}`}>Entrar</Link>
          </Button>
        </div>
      </section>
    );
  }

  function submit() {
    setMessage(null);
    startTransition(async () => {
      const result = await savePriceAlert({
        productId,
        mode,
        targetPrice,
        percentageDrop: percentage,
      });
      if (!result.ok) {
        setMessage(ERROR_MESSAGES[result.error]);
        return;
      }
      setActive(true);
      setMessage('Alerta guardada. Te avisaremos cuando se cumpla.');
    });
  }

  function disable() {
    setMessage(null);
    startTransition(async () => {
      const result = await disablePriceAlert(productId);
      if (!result.ok) {
        setMessage(ERROR_MESSAGES[result.error]);
        return;
      }
      setActive(false);
      setMessage('Alerta desactivada.');
    });
  }

  return (
    <section className="mt-4 rounded-2xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium">
            <Bell className="h-4 w-4" /> Avísame cuando baje
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Precio actual: {formatPrice(currentPriceCents, currency)}
          </p>
        </div>
        {active && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Activa
          </span>
        )}
      </div>

      <label className="mt-4 block text-xs font-medium">
        Cuándo avisarme
        <select
          value={mode}
          onChange={(event) => setMode(event.target.value as PriceAlertMode)}
          className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="any_drop">Ante cualquier bajada</option>
          <option value="target_price">Al llegar a un precio objetivo</option>
          <option value="percentage_drop">Al bajar un porcentaje</option>
        </select>
      </label>

      {mode === 'target_price' && (
        <label className="mt-3 block text-xs font-medium">
          Precio objetivo ({currency})
          <Input
            className="mt-1"
            inputMode="decimal"
            value={targetPrice}
            onChange={(event) => setTargetPrice(event.target.value)}
            placeholder="Ej. 19,99"
          />
        </label>
      )}
      {mode === 'percentage_drop' && (
        <label className="mt-3 block text-xs font-medium">
          Porcentaje de bajada
          <Input
            className="mt-1"
            type="number"
            min={1}
            max={99}
            value={percentage}
            onChange={(event) => setPercentage(event.target.value)}
          />
        </label>
      )}

      {message && (
        <p
          className={`mt-3 text-xs ${message.startsWith('Alerta ') ? 'text-emerald-700' : 'text-rose-700'}`}
          role="status"
        >
          {message}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={submit} disabled={isPending}>
          {isPending
            ? 'Guardando…'
            : active
              ? 'Actualizar alerta'
              : 'Crear alerta'}
        </Button>
        {active && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="gap-1"
            onClick={disable}
            disabled={isPending}
          >
            <BellOff className="h-3.5 w-3.5" /> Desactivar
          </Button>
        )}
      </div>
    </section>
  );
}
