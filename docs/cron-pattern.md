# Cron de precios y catálogo

## Estado

Los dos jobs están programados en `vercel.json` una vez al día:

- `GET /api/cron/refresh-masterled`, a las 03:15 UTC.
- `GET /api/cron/process-price-alerts`, a las 04:15 UTC.

La hora de margen permite que el catálogo termine de refrescar antes de
evaluar bajadas.

## Contrato de seguridad

- Vercel envía `Authorization: Bearer $CRON_SECRET` a los cron registrados.
- El handler compara el secreto en tiempo constante y falla cerrado si falta.
- `MASTERLED_FEED_URL` sólo acepta HTTPS bajo `masterled.es`; su token se trata
  como secreto y nunca se devuelve ni registra.
- El feed se limita a 8 MiB, 20 segundos y un mínimo de 1.000 filas válidas o
  el 80 % del catálogo existente, lo que sea mayor.
- Antes de descargar o escribir, el handler comprueba que `price_history`
  exista. Así no puede refrescar precios sin conservar snapshots.
- Sólo marca como agotados los productos ausentes después de que todos los
  lotes del feed hayan terminado correctamente.
- El catálogo público de Masterled pasa primero por una selección humana de 50
  variantes. Ventiladores de techo y la categoría `Carril Enchufes
  Deslizantes` están protegidos dinámicamente; el cron aborta antes de ocultar
  filas si no puede completar la selección.
- El trigger de `price_history` registra únicamente cambios de precio, moneda
  o stock, por lo que una invocación duplicada no duplica snapshots.
- El worker evalúa el último estado disponible, encola mediante una clave
  única alerta/snapshot, reclama cada entrega con estado `processing` y usa
  `Idempotency-Key` en Resend. Los target/percentage son one-shot; any-drop
  mantiene como nueva referencia el último precio evaluado.
- La moneda forma parte de la referencia y del ledger. Nunca se comparan
  céntimos de divisas distintas: un cambio de moneda reinicia alertas relativas
  y desactiva objetivos de precio fijo, cuyo importe deja de ser interpretable.
- Un email pendiente se omite si el producto ya está agotado o su precio actual
  o moneda ya no coinciden con el snapshot, evitando avisos obsoletos.

## Prerrequisitos de activación

1. ✅ `supabase/migrations/20260728190000_price_history_alerts.sql` aplicada en
   Supabase Cloud el 2026-07-29; tipos regenerados y 1.613 snapshots baseline
   verificados.
2. ✅ Configurados en Vercel, sin compartir valores por chat:
   `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `MASTERLED_FEED_URL`,
   `RESEND_API_KEY` y `RESEND_FROM_EMAIL`. El dominio remitente está
   verificado en Resend.
3. ✅ Invocado manualmente el refresh del deployment de producción desde un
   terminal seguro el 2026-07-29:

   ```bash
   curl --fail-with-body \
     -H "Authorization: Bearer $CRON_SECRET" \
     https://shopifind.app/api/cron/refresh-masterled

   ```

   Resultado: 1.562 filas vistas, 1.438 en stock y 9 referencias ausentes
   marcadas como agotadas. La auditoría final confirmó 9 productos nuevos,
   14 cambios de stock, ningún cambio de precio/moneda, 23 snapshots, 2 alertas
   activas intactas y 0 entregas. Smoke público: 17/17.

4. ✅ Resend validado y worker ejecutado manualmente desde un terminal seguro:

   ```bash
   curl --fail-with-body \
     -H "Authorization: Bearer $CRON_SECRET" \
     https://shopifind.app/api/cron/process-price-alerts
   ```

   El primer intento conservó la entrega como `failed` al detectar una clave
   inválida. Tras rotarla, el mismo asiento pasó a `sent` en su segundo intento,
   guardó el identificador del proveedor y actualizó el cursor de la alerta a
   90 EUR. Una invocación adicional evaluó las 3 alertas sin volver a enviar.

5. ✅ JSON y ledger verificados. Queda únicamente la confirmación humana de
   llegada al buzón y, después, borrar el fixture oculto de producción.
6. ✅ Curación Masterled aplicada el 2026-07-29 sobre el feed live: 1.562
   candidatas, 50 seleccionadas, 8 protegidas y 1.388 filas puestas fuera de
   stock sin borrado. La vista pública quedó en 82 productos; detalles y
   criterios en `docs/masterled-curation.md`.
7. ✅ Ambos jobs están añadidos a `vercel.json`:

   ```json
   {
     "crons": [
       {
         "path": "/api/cron/refresh-masterled",
         "schedule": "15 3 * * *"
       },
       {
         "path": "/api/cron/process-price-alerts",
         "schedule": "15 4 * * *"
       }
     ]
   }
   ```

## Frecuencia

En Vercel Hobby la frecuencia mínima actual es una ejecución diaria y la hora
puede variar dentro de la franja seleccionada. Un refresco cada 12 horas exige
Vercel Pro o mover el scheduler a Supabase `pg_cron`/otro servicio. Vercel
también advierte que un evento cron puede entregarse más de una vez; el diseño
del trigger y los upserts toleran ese caso.

Fuentes oficiales consultadas el 2026-07-28:

- https://vercel.com/docs/cron-jobs/usage-and-pricing
- https://vercel.com/docs/cron-jobs/manage-cron-jobs
- https://resend.com/docs/dashboard/emails/idempotency-keys
